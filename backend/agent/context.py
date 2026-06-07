"""
TORCH Conversation Context Manager
Stores rolling conversation history per client.
"""

import logging
from typing import List, Dict, Any

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

        context.append({
            "user_command": user_command,
            "reply_summary": reply_summary,
            "step_results": sanitized_results,
        })

        # Retain only the last 10 exchanges
        if len(context) > 10:
            cls._contexts[client_id] = context[-10:]
            
        logger.info(f"Updated conversation context for client {client_id}: {len(cls._contexts[client_id])} exchanges stored.")

    @classmethod
    def clear_context(cls, client_id: str) -> None:
        """
        Clear the conversation context for a client when they disconnect.
        """
        if client_id in cls._contexts:
            cls._contexts.pop(client_id)
            logger.info(f"Cleared conversation context for client {client_id}")
