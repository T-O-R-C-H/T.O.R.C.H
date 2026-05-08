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
        """Create tables if they don't exist."""
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    command TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    steps_json TEXT,
                    duration_ms INTEGER,
                    created_at TEXT DEFAULT (datetime('now')),
                    completed_at TEXT
                );

                CREATE TABLE IF NOT EXISTS activity_log (
                    id TEXT PRIMARY KEY,
                    app TEXT,
                    description TEXT,
                    screenshot_path TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS contacts (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    email TEXT,
                    platform TEXT,
                    interaction_count INTEGER DEFAULT 0,
                    last_interaction TEXT
                );

                CREATE TABLE IF NOT EXISTS file_access (
                    id TEXT PRIMARY KEY,
                    filepath TEXT NOT NULL,
                    action TEXT,
                    access_count INTEGER DEFAULT 0,
                    last_accessed TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS commands_log (
                    id TEXT PRIMARY KEY,
                    command TEXT NOT NULL,
                    count INTEGER DEFAULT 1,
                    last_used TEXT DEFAULT (datetime('now'))
                );
            """)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ─── Tasks ───

    def save_task(self, command: str, steps: List[Dict], status: str, duration_ms: int) -> str:
        task_id = str(uuid.uuid4())
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO tasks (id, command, status, steps_json, duration_ms, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
                (task_id, command, status, json.dumps(steps), duration_ms, datetime.now().isoformat()),
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

    # ─── Commands frequency ───

    def log_command(self, command: str) -> None:
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id, count FROM commands_log WHERE command = ?", (command,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE commands_log SET count = count + 1, last_used = ? WHERE id = ?",
                    (datetime.now().isoformat(), existing["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO commands_log (id, command) VALUES (?, ?)",
                    (str(uuid.uuid4()), command),
                )

    def get_frequent_commands(self, limit: int = 10) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT command, count FROM commands_log ORDER BY count DESC LIMIT ?", (limit,)
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

    # ─── Clear ───

    def clear_all(self) -> None:
        with self._connect() as conn:
            for table in ["tasks", "activity_log", "contacts", "file_access", "commands_log"]:
                conn.execute(f"DELETE FROM {table}")


# Singleton
db = TorchDatabase()
