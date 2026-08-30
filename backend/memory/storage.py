"""
TORCH Memory — Storage Layer
SQLite for structured data + ChromaDB for vector embeddings.
"""

import os
import sqlite3
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path

from config.settings import settings

logger = logging.getLogger("torch.memory.storage")

# Tool families for the insights breakdown. Grouped by what the user was
# trying to do rather than by which module implements the tool, so the chart
# answers "what do I use TORCH for". Tools with no meaningful family
# (`respond`, `error`) are absent on purpose and are not counted.
TOOL_CATEGORIES = {
    "find_file": "Files",
    "find_file_fuzzy": "Files",
    "list_directory": "Files",
    "read_pdf": "Files",
    "read_word": "Files",
    "read_excel": "Files",
    "move_file": "Files",
    "delete_file": "Files",
    "create_folder": "Files",
    "zip_files": "Files",
    "download_file": "Files",
    "send_email": "Email",
    "read_inbox": "Email",
    "open_browser": "Web",
    "search_web": "Web",
    "post_social": "Messaging",
    "send_message": "Messaging",
    "open_app": "Apps",
    "run_terminal": "Apps",
    "screenshot": "Screen",
    "analyse_screen": "Screen",
    "read_screen": "Screen",
    "describe_screen": "Screen",
    "click": "Screen",
    "click_element": "Screen",
    "type_text": "Screen",
    "type_into": "Screen",
    "vision_control": "Screen",
}


class TorchDatabase:
    """SQLite storage for tasks, activity, contacts, and file access."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path
        # A bare filename has no directory part, and makedirs("") raises.
        parent_dir = os.path.dirname(self.db_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Create tables by executing the schema.sql file."""
        schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql")
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            with self._connect() as conn:
                conn.executescript(schema_sql)
                self._apply_migrations(conn)
            logger.info("Database initialized successfully from schema.sql")
        except Exception as e:
            logger.error(f"Failed to initialize database from schema.sql: {e}")

    def _apply_migrations(self, conn: sqlite3.Connection) -> None:
        """Run column migration checks to ensure existing tables have all required fields."""
        migrations = [
            ("tasks", "duration_ms", "INTEGER DEFAULT 0"),
            ("tasks", "steps_json", "TEXT DEFAULT '[]'"),
            ("habits", "success_count", "INTEGER DEFAULT 0"),
            ("scheduled_tasks", "enabled", "INTEGER DEFAULT 1"),
        ]
        cursor = conn.cursor()
        for table, column, col_def in migrations:
            try:
                cursor.execute(f"PRAGMA table_info({table})")
                existing_cols = {row[1] for row in cursor.fetchall()}
                if column not in existing_cols:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
                    logger.info(f"Migrated DB: Added column {column} to {table}")
            except Exception as exc:
                logger.warning(f"Migration check failed for {table}.{column}: {exc}")
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

    def get_frequent_files(self, limit: int = 10) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT filepath as path, access_count as count FROM files_accessed ORDER BY access_count DESC LIMIT ?", (limit,)
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

    # ─── Audit log ───

    def log_action(
        self,
        tool: str,
        status: str,
        args: Optional[Dict[str, Any]] = None,
        result: str = "",
        error: str = "",
        client_id: str = "main",
        message_id: str = "",
    ) -> str:
        """Record one agent action (tool call + outcome) to the durable audit log."""
        entry_id = str(uuid.uuid4())
        args_json = json.dumps(args, default=str)[:4000] if args else ""
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO audit_log (id, client_id, message_id, tool, args_json, status, result, error) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (entry_id, client_id, message_id, tool, args_json, status, result[:4000], error[:4000]),
            )
        return entry_id

    def get_audit_log(self, limit: int = 200, tool: Optional[str] = None) -> List[Dict]:
        with self._connect() as conn:
            if tool:
                rows = conn.execute(
                    "SELECT * FROM audit_log WHERE tool = ? ORDER BY ts DESC LIMIT ?",
                    (tool, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [dict(r) for r in rows]

    def get_metrics(self, limit: int = 50) -> Dict[str, Any]:
        """Lightweight aggregate metrics from the audit log and tasks."""
        with self._connect() as conn:
            actions = conn.execute(
                "SELECT tool, status, COUNT(*) as count FROM audit_log GROUP BY tool, status"
            ).fetchall()
            recent = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE created_at LIKE ?",
                (f"{datetime.now():%Y-%m-%d}%",),
            ).fetchone()[0]
        return {
            "today_task_count": recent,
            "by_tool_status": [dict(r) for r in actions],
        }

    def get_insights(self, days: int = 7) -> Dict[str, Any]:
        """
        Aggregate what the task history actually records, and nothing else.

        Everything here is derived from rows in `tasks`: how many ran on each
        of the last `days` days, how many finished, which tool families they
        used, and how long they took. Figures the database cannot support -
        accuracy, time saved - are deliberately absent rather than estimated,
        because a plausible invented number is worse than a missing one.

        `success_rate` and `avg_duration_ms` are None when there is nothing to
        divide, so the caller shows an empty state instead of a confident 0%.
        """
        today = datetime.now().date()
        day_keys = [
            (today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)
        ]

        daily = {key: {"date": key, "total": 0, "completed": 0} for key in day_keys}
        categories: Dict[str, int] = {}
        total = 0
        completed = 0
        total_steps = 0
        durations: List[int] = []

        oldest = day_keys[0]
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT status, steps_json, duration_ms, created_at "
                "FROM tasks WHERE created_at >= ?",
                (oldest,),
            ).fetchall()

        for row in rows:
            created = (row["created_at"] or "")[:10]
            if created not in daily:
                continue

            total += 1
            daily[created]["total"] += 1
            is_done = row["status"] == "completed"
            if is_done:
                completed += 1
                daily[created]["completed"] += 1

            duration = row["duration_ms"] or 0
            if duration > 0:
                durations.append(duration)

            try:
                steps = json.loads(row["steps_json"]) if row["steps_json"] else []
            except (ValueError, TypeError):
                steps = []
            total_steps += len(steps)
            for step in steps:
                if not isinstance(step, dict):
                    continue
                family = TOOL_CATEGORIES.get(step.get("tool", ""))
                if family:
                    categories[family] = categories.get(family, 0) + 1

        return {
            "days": days,
            "daily": [daily[key] for key in day_keys],
            "total_tasks": total,
            "completed_tasks": completed,
            "total_steps": total_steps,
            "success_rate": round(completed / total * 100) if total else None,
            "avg_duration_ms": round(sum(durations) / len(durations)) if durations else None,
            "categories": [
                {"label": label, "count": count}
                for label, count in sorted(categories.items(), key=lambda kv: -kv[1])
            ],
        }

    # ─── Clear ───

    def clear_all(self) -> None:
        with self._connect() as conn:
            for table in ["tasks", "steps", "habits", "contacts", "files_accessed", "notifications", "scheduled_tasks", "skills", "activity_log", "audit_log"]:
                try:
                    conn.execute(f"DELETE FROM {table}")
                except Exception:
                    pass

    def _clear_tables(self, tables: List[str]) -> int:
        """Empty the named tables, returning how many rows went."""
        removed = 0
        with self._connect() as conn:
            for table in tables:
                try:
                    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                    conn.execute(f"DELETE FROM {table}")
                    removed += count
                except Exception as exc:
                    logger.warning(f"Could not clear {table}: {exc}")
        return removed

    def clear_memory(self) -> int:
        """
        Forget what TORCH has learned about the user.

        Task history is deliberately left alone: this clears the patterns, not
        the record of what was done.
        """
        return self._clear_tables(["habits", "contacts", "files_accessed"])

    def reset_habits(self) -> int:
        """Drop only the learned command frequencies."""
        return self._clear_tables(["habits"])


# Singleton
db = TorchDatabase()
