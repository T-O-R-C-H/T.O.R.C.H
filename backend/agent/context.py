"""
TORCH Conversation Context Manager
Stores rolling conversation history per client with optional database persistence.
"""

import logging
import sqlite3
from typing import List, Dict, Any
from pathlib import Path

logger = logging.getLogger("torch.context")


class ConversationContext:
    # In-memory dictionary keyed by client_id holding a list of exchanges.
    # Each exchange is a dict:
    # {
    #   "user_command": str,
    #   "reply_summary": str,
    #   "step_results": List[Dict[str, Any]]
    # }
    _contexts: Dict[str, List[Dict[str, Any]]] = {}
    _db_path = Path("./data/torch.db")

    @classmethod
    def get_context(cls, client_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve the conversation context history (list of exchanges) for a given client_id.
        """
        if not client_id:
            return []
        if client_id not in cls._contexts:
            cls._contexts[client_id] = []
        return cls._contexts[client_id]

    @classmethod
    def add_exchange(
        cls,
        client_id: str,
        user_command: str,
        reply_summary: str,
        step_results: List[Dict[str, Any]],
    ) -> None:
        """
        Append a new exchange to the client's context and keep only the last 10 exchanges.
        Also persist to database for voice/context awareness.
        """
        if not client_id:
            return

        context = cls.get_context(client_id)
        
        # Strip/sanitize step results for storage
        sanitized_results = []
        for step in step_results:
            sanitized_results.append({
                "tool": step.get("tool", "unknown"),
                "label": step.get("label", ""),
                "status": step.get("status", "unknown"),
                "result": step.get("result", ""),
                "error": step.get("error", ""),
            })

        exchange = {
            "user_command": user_command,
            "reply_summary": reply_summary,
            "step_results": sanitized_results,
        }
        context.append(exchange)

        # Retain only the last 10 exchanges in memory
        if len(context) > 10:
            cls._contexts[client_id] = context[-10:]
        
        # Persist to database for voice/context awareness
        try:
            cls._persist_to_db(client_id, exchange)
        except Exception as e:
            logger.warning(f"Failed to persist context to database: {e}")
            
        logger.info(f"Updated conversation context for client {client_id}: {len(cls._contexts[client_id])} exchanges stored.")

    @classmethod
    def _persist_to_db(cls, client_id: str, exchange: Dict[str, Any]) -> None:
        """Persist exchange to SQLite for voice context awareness."""
        try:
            if not cls._db_path.exists():
                return
            
            conn = sqlite3.connect(str(cls._db_path))
            cursor = conn.cursor()
            
            # Insert exchange for voice/context awareness
            cursor.execute("""
                INSERT INTO activity_log (timestamp, description, metadata)
                VALUES (datetime('now'), ?, ?)
            """, (
                f"[{client_id}] {exchange.get('user_command', '')[:100]}",
                exchange.get('reply_summary', ''),
            ))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.debug(f"Database persistence not available: {e}")

    @classmethod
    def clear_context(cls, client_id: str) -> None:
        """
        Clear the conversation context for a client when they disconnect.
        """
        if client_id in cls._contexts:
            cls._contexts.pop(client_id)
            logger.info(f"Cleared conversation context for client {client_id}")
