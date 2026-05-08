"""
TORCH Memory — Habit Detection
Analyzes user patterns from stored data.
"""

import logging
from typing import List, Dict
from datetime import datetime, timedelta
from collections import Counter

from memory.storage import db

logger = logging.getLogger("torch.memory.habits")


def detect_time_patterns() -> List[Dict]:
    """Detect what commands user runs at what times of day."""
    tasks = db.get_tasks(limit=200)

    time_buckets: Dict[str, List[str]] = {}

    for task in tasks:
        try:
            created = datetime.fromisoformat(task["created_at"])
            hour = created.strftime("%H:00")
            command = task["command"]

            if hour not in time_buckets:
                time_buckets[hour] = []
            time_buckets[hour].append(command)
        except (KeyError, ValueError):
            continue

    patterns = []
    for time_slot, commands in sorted(time_buckets.items()):
        most_common = Counter(commands).most_common(3)
        for cmd, count in most_common:
            if count >= 2:  # Only report if seen 2+ times
                patterns.append({
                    "timeOfDay": time_slot,
                    "action": cmd,
                    "frequency": count,
                    "category": _categorize_command(cmd),
                })

    return patterns


def get_habits_summary() -> Dict:
    """Get a summary of all detected habits."""
    return {
        "frequent_commands": db.get_frequent_commands(10),
        "frequent_contacts": db.get_frequent_contacts(10),
        "time_patterns": detect_time_patterns(),
    }


def _categorize_command(command: str) -> str:
    """Simple command categorization."""
    cmd_lower = command.lower()
    if any(w in cmd_lower for w in ["email", "mail", "send"]):
        return "email"
    if any(w in cmd_lower for w in ["file", "find", "search", "pdf", "document"]):
        return "files"
    if any(w in cmd_lower for w in ["browser", "web", "search", "url"]):
        return "web"
    if any(w in cmd_lower for w in ["post", "social", "tweet", "linkedin"]):
        return "social"
    if any(w in cmd_lower for w in ["terminal", "command", "run"]):
        return "system"
    return "other"
