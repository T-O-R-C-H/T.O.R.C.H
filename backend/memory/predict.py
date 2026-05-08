"""
TORCH Memory — Prediction Engine
Predicts what the user needs based on habits and history.
"""

import json
import logging
from typing import List, Dict, Optional
from datetime import datetime

from memory.storage import db
from memory.habits import get_habits_summary

logger = logging.getLogger("torch.memory.predict")


async def predict_next_actions(count: int = 3) -> List[Dict]:
    """
    Predict what the user likely needs to do next.
    Uses recent history + time patterns + Gemini for intelligent suggestions.
    """
    try:
        habits = get_habits_summary()
        recent_tasks = db.get_tasks(limit=50)

        # If not enough data, return defaults
        if len(recent_tasks) < 5:
            return _default_predictions()

        # Try Gemini-powered prediction
        return await _gemini_predict(habits, recent_tasks, count)

    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return _default_predictions()


async def _gemini_predict(
    habits: Dict,
    recent_tasks: List[Dict],
    count: int,
) -> List[Dict]:
    """Use Gemini to generate intelligent predictions."""
    try:
        import google.generativeai as genai
        from config.settings import settings

        if not settings.gemini_api_key:
            return _default_predictions()

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)

        current_time = datetime.now().strftime("%H:%M")
        current_day = datetime.now().strftime("%A")

        prompt = f"""Based on this user's habits and task history, predict what they need to do right now.

Current time: {current_time} ({current_day})

Frequent commands: {json.dumps(habits.get('frequent_commands', [])[:5])}
Time patterns: {json.dumps(habits.get('time_patterns', [])[:5])}
Recent tasks (last 10): {json.dumps([t.get('command', '') for t in recent_tasks[:10]])}

Return a JSON array of {count} predictions. Each must have:
- "label": short description (max 50 chars)
- "action": the command to execute
- "confidence": 0.0-1.0
- "timeEstimate": estimated time (e.g., "~30s")

Return ONLY the JSON array, no other text."""

        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        predictions = json.loads(text)

        # Add IDs
        import uuid
        for p in predictions:
            p["id"] = str(uuid.uuid4())

        return predictions[:count]

    except Exception as e:
        logger.error(f"Gemini prediction failed: {e}")
        return _default_predictions()


def _default_predictions() -> List[Dict]:
    """Default predictions when there's not enough data."""
    import uuid
    return [
        {
            "id": str(uuid.uuid4()),
            "label": "Check email inbox",
            "action": "Read my latest emails",
            "confidence": 0.6,
            "timeEstimate": "~10s",
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Review today's tasks",
            "action": "What did I work on today?",
            "confidence": 0.5,
            "timeEstimate": "~5s",
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Search for recent files",
            "action": "Find files I modified today",
            "confidence": 0.4,
            "timeEstimate": "~15s",
        },
    ]
