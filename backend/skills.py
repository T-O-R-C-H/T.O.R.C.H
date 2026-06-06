import uuid
import logging
from typing import List, Dict, Any, Optional
from memory.storage import db

logger = logging.getLogger("torch.skills")


def save_skill(name: str, command: str) -> str:
    """Save a command as a skill in the database."""
    skill_id = str(uuid.uuid4())
    with db._connect() as conn:
        conn.execute(
            "INSERT INTO skills (id, name, command, run_count) VALUES (?, ?, ?, 0)",
            (skill_id, name, command),
        )
    logger.info(f"Saved skill: {name} (ID: {skill_id})")
    return skill_id


def get_skills() -> List[Dict[str, Any]]:
    """Get all saved skills ordered by run_count DESC."""
    with db._connect() as conn:
        rows = conn.execute(
            "SELECT id, name, command, created_at, run_count FROM skills ORDER BY run_count DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def run_skill(skill_id: str) -> Optional[str]:
    """Increment run_count and return the skill's command."""
    with db._connect() as conn:
        # Check if skill exists
        row = conn.execute(
            "SELECT command FROM skills WHERE id = ?", (skill_id,)
        ).fetchone()
        if not row:
            logger.warning(f"Skill ID {skill_id} not found")
            return None

        # Increment run_count
        conn.execute(
            "UPDATE skills SET run_count = run_count + 1 WHERE id = ?", (skill_id,)
        )
        logger.info(f"Executed skill ID {skill_id}, run_count incremented")
        return row["command"]


def delete_skill(skill_id: str) -> None:
    """Permanently delete a skill by ID."""
    with db._connect() as conn:
        conn.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
    logger.info(f"Deleted skill ID {skill_id}")
