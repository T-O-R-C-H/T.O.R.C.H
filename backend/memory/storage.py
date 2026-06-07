"""
TORCH Memory — Storage Layer
SQLite for structured data + ChromaDB for vector embeddings.
"""

import os
import sqlite3
import json
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from config.settings import settings

logger = logging.getLogger("torch.memory.storage")


class TorchDatabase:
    """SQLite storage for tasks, activity, contacts, and file access."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Create tables by executing the schema.sql file."""
        schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql")
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            with self._connect() as conn:
                conn.executescript(schema_sql)
            logger.info("Database initialized successfully from schema.sql")
        except Exception as e:
            logger.error(f"Failed to initialize database from schema.sql: {e}")
            # Fallback inline schema in case file read fails
            # Matches the 8 tables required in Issue 02
            with self._connect() as conn:
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS tasks (
                        id TEXT PRIMARY KEY,
                        command TEXT,
                        status TEXT,
                        steps_json TEXT,
                        duration_ms INTEGER,
                        created_at TEXT,
                        completed_at TEXT
                    );
                    CREATE TABLE IF NOT EXISTS steps (
                        id TEXT PRIMARY KEY, task_id TEXT, tool TEXT, label TEXT, 
                        status TEXT, result TEXT, error TEXT, created_at TEXT
                    );
                    CREATE TABLE IF NOT EXISTS habits (
                        id TEXT PRIMARY KEY,
                        command TEXT,
                        count INTEGER DEFAULT 1,
                        last_used TEXT,
                        hour_of_day INTEGER,
                        day_of_week TEXT
                    );
                    CREATE TABLE IF NOT EXISTS contacts (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        email TEXT,
                        platform TEXT,
                        interaction_count INTEGER DEFAULT 0,
                        last_interaction TEXT
                    );
                    CREATE TABLE IF NOT EXISTS files_accessed (
                        id TEXT PRIMARY KEY, filepath TEXT, action TEXT, 
                        access_count INTEGER DEFAULT 0, last_accessed TEXT
                    );
                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY, type TEXT, title TEXT, 
                        message TEXT, dismissed INTEGER DEFAULT 0, created_at TEXT
                    );
                    CREATE TABLE IF NOT EXISTS scheduled_tasks (
                        id TEXT PRIMARY KEY, command TEXT, cron_expression TEXT, 
                        last_run TEXT, next_run TEXT, active INTEGER DEFAULT 1
                    );
                    CREATE TABLE IF NOT EXISTS skills (
                        id TEXT PRIMARY KEY, name TEXT, command TEXT, 
                        created_at TEXT, run_count INTEGER DEFAULT 0
                    );
                """)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ─── Tasks ───

    def save_task(self, command: str, steps: List[Dict], status: str, duration_ms: int = 0) -> str:
        task_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO tasks (id, command, status, steps_json, duration_ms, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (task_id, command, status, json.dumps(steps), duration_ms, now, now),
            )
        return task_id

    def get_tasks(self, limit: int = 50) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Activity ───

    def log_activity(self, app: str, description: str, screenshot_path: Optional[str] = None) -> str:
        entry_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO activity_log (id, app, description, screenshot_path) VALUES (?, ?, ?, ?)",
                (entry_id, app, description, screenshot_path),
            )
        return entry_id

    def get_activity(self, limit: int = 50) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Commands frequency / Habits ───

    def log_command(self, command: str) -> None:
        now = datetime.now()
        hour_of_day = now.hour
        day_of_week = now.strftime("%A")
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id, count FROM habits WHERE command = ?", (command,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE habits SET count = count + 1, last_used = ?, hour_of_day = ?, day_of_week = ? WHERE id = ?",
                    (now.isoformat(), hour_of_day, day_of_week, existing["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO habits (id, command, count, last_used, hour_of_day, day_of_week) VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), command, 1, now.isoformat(), hour_of_day, day_of_week),
                )

    def get_frequent_commands(self, limit: int = 10) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT command, count FROM habits ORDER BY count DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Contacts ───

    def update_contact(self, name: str, email: str = "", platform: str = "") -> None:
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM contacts WHERE name = ? OR email = ?", (name, email)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE contacts SET interaction_count = interaction_count + 1, last_interaction = ? WHERE id = ?",
                    (datetime.now().isoformat(), existing["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO contacts (id, name, email, platform) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), name, email, platform),
                )

    def get_frequent_contacts(self, limit: int = 10) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM contacts ORDER BY interaction_count DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Metrics ───

    def get_stats_for_date(self, date_prefix: str) -> Dict[str, Any]:
        """Fetch counts and action sums for a specific date prefix (YYYY-MM-DD)."""
        with self._connect() as conn:
            # Completed tasks count
            completed = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND created_at LIKE ?",
                (f"{date_prefix}%",)
            ).fetchone()[0]
            
            # Total tasks count (attempts)
            total = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE created_at LIKE ?",
                (f"{date_prefix}%",)
            ).fetchone()[0]
            
            # Sum of actions (step counts)
            actions = 0
            rows = conn.execute(
                "SELECT steps_json FROM tasks WHERE status = 'completed' AND created_at LIKE ?",
                (f"{date_prefix}%",)
            ).fetchall()
            for row in rows:
                steps = json.loads(row["steps_json"]) if row["steps_json"] else []
                actions += len(steps)
                    
            return {"completed": completed, "total": total, "actions": actions}

    # ─── Clear ───

    def clear_all(self) -> None:
        with self._connect() as conn:
            for table in ["tasks", "steps", "habits", "contacts", "files_accessed", "notifications", "scheduled_tasks", "skills", "activity_log"]:
                try:
                    conn.execute(f"DELETE FROM {table}")
                except Exception:
                    pass


# Singleton
db = TorchDatabase()
