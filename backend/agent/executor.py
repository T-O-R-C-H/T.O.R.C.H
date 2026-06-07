"""
TORCH Agent Executor
Runs validated execution plans step-by-step with HITL support.
"""

import asyncio
import logging
import importlib
from typing import List, Dict, Any, Optional, Callable

from websocket import manager as ws_manager
from config.settings import settings

logger = logging.getLogger("torch.executor")

NON_BLOCKING_FAILURE_TOOLS = {"screenshot", "analyse_screen"}
NON_RETRYABLE_ERROR_MARKERS = (
    "authentication failed",
    "unauthorized",
    "permission denied",
    "cancelled",
    "canceled",
    "file not found",
    "no such file",
    "no files matching",
)
RETRYABLE_ERROR_MARKERS = (
    "timeout",
    "timed out",
    "connection refused",
    "connection reset",
    "network",
    "temporarily unavailable",
    "element not found",
    "smtp",
)


class Executor:
    """Sequential step executor with HITL pause/resume capability."""

    def __init__(self):
        self._approval_events: Dict[str, asyncio.Event] = {}
        self._approval_results: Dict[str, str] = {}
        self._tool_registry: Dict[str, Callable] = {}
        self._load_tools()

    def _load_tools(self) -> None:
        """Dynamically load all tool functions."""
        tool_modules = {
            "tools.files": [
                "find_file", "find_file_fuzzy", "read_pdf", "read_word", "read_excel",
                "move_file", "delete_file", "create_folder", "zip_files",
                "list_directory"
            ],
            "tools.email": ["send_email", "read_inbox"],
            "tools.browser": ["open_browser", "click", "type_text", "search_web"],
            "tools.screen": ["screenshot", "analyse_screen"],
            "tools.voice": ["speak", "listen"],
            "tools.social": ["post_social", "send_message"],
            "tools.system": ["open_app", "run_terminal", "download_file"],
        }

        for module_path, tool_names in tool_modules.items():
            try:
                module = importlib.import_module(module_path)
                for name in tool_names:
                    func = getattr(module, name, None)
                    if func:
                        self._tool_registry[name] = func
                    else:
                        logger.warning(f"Tool {name} not found in {module_path}")
            except ImportError as e:
                logger.warning(f"Could not load module {module_path}: {e}")

        # Load skill tools
        try:
            import skills
            self._tool_registry["save_skill"] = skills.save_skill
        except Exception as e:
            logger.warning(f"Could not load skills module: {e}")

        logger.info(f"Loaded {len(self._tool_registry)} tools")

    async def execute_plan(
        self,
        message_id: str,
        steps: List[Dict[str, Any]],
        client_id: str = "main",
    ) -> List[Dict[str, Any]]:
        """
        Execute a validated plan step by step.

        For each step:
        1. Mark as active, notify frontend
        2. If HITL required, pause and wait for approval
        3. Execute the tool function
        4. Mark as done/failed, notify frontend
        5. Store result for subsequent steps
        """
        results: List[str] = []

        await ws_manager.send_status("executing", client_id)

        for i, step in enumerate(steps):
            step_id = step["id"]
            tool_name = step["tool"]
            args = step.get("args", {})

            # Handle error steps
            if tool_name == "error":
                step["status"] = "failed"
                await ws_manager.send_step_update(
                    message_id, step_id, "failed",
                    error=step.get("error", "Unknown error"),
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"Error: {step.get('error', 'Unknown error')}", "error", client_id
                )
                results.append("")
                continue

            # Mark step as active
            step["status"] = "active"
            await ws_manager.send_step_update(message_id, step_id, "active", client_id=client_id)
            await ws_manager.send_terminal_line(f"{step['label']}...", "info", client_id)

            # HITL check
            if step.get("requires_approval"):
                step["status"] = "hitl_required"
                await ws_manager.send_step_update(
                    message_id, step_id, "hitl_required", client_id=client_id
                )
                await ws_manager.send_status("awaiting_approval", client_id)
                await ws_manager.send_terminal_line(
                    f"HITL: awaiting user approval — {step['label']}", "hitl", client_id
                )

                # Wait for approval
                approval = await self._wait_for_approval(step_id)

                if approval == "cancel":
                    step["status"] = "failed"
                    step["error"] = "Cancelled by user"
                    await ws_manager.send_step_update(
                        message_id, step_id, "failed",
                        error="Cancelled by user",
                        client_id=client_id,
                    )
                    await ws_manager.send_terminal_line("Cancelled by user", "warning", client_id)
                    await ws_manager.send_status("idle", client_id)
                    results.append("")
                    break

                await ws_manager.send_terminal_line("Approved ✓", "success", client_id)
                await ws_manager.send_status("executing", client_id)

            # Resolve step references in args (e.g., {{step_0_result}})
            resolved_args = self._resolve_references(args, results)

            # Execute the tool
            try:
                tool_func = self._tool_registry.get(tool_name)
                if not tool_func:
                    raise ValueError(f"Tool not registered: {tool_name}")

                result = await self._execute_tool_with_retry(
                    tool_name,
                    tool_func,
                    resolved_args,
                    client_id,
                )

                result_str = str(result) if result is not None else "Done"
                result_recorded = False

                if tool_name == "find_file" and result_str.startswith("No files matching"):
                    try:
                        import os
                        from tools.files import find_file_fuzzy
                        fuzzy = find_file_fuzzy(**resolved_args)
                        if fuzzy["suggestions"]:
                            suggestions = "\n".join([f"  • {os.path.basename(s)}" for s in fuzzy["suggestions"][:3]])
                            result_str = (
                                f"No exact match found for '{resolved_args.get('name')}'.\n"
                                f"Did you mean one of these?\n{suggestions}\n"
                                f"Full path: {fuzzy['suggestions'][0]}"
                            )
                            # Use first suggestion as the result for next steps
                            results.append(fuzzy["suggestions"][0])
                            result_recorded = True
                        else:
                            error_msg = (
                                f"No exact match found for '{resolved_args.get('name')}'. "
                                "I could not find a safe file match to continue."
                            )
                            step["status"] = "failed"
                            step["error"] = error_msg
                            results.append("")
                            await ws_manager.send_step_update(
                                message_id, step_id, "failed",
                                error=error_msg[:200],
                                client_id=client_id,
                            )
                            await ws_manager.send_terminal_line(
                                f"Blocking failure: {error_msg}", "error", client_id
                            )
                            # Send blocking failure explanation to chat
                            step_num = i + 1
                            completed_range = f"Steps 1\u2013{step_num - 1} completed" if step_num > 1 else "No steps completed"
                            await ws_manager.send_agent_response(
                                {
                                    "role": "assistant",
                                    "content": (
                                        f"Step {step_num} failed after 2 attempts: {error_msg}. "
                                        f"{completed_range}."
                                    ),
                                },
                                client_id,
                            )
                            break
                    except Exception as e:
                        error_msg = str(e)[:200]
                        step["status"] = "failed"
                        step["error"] = error_msg
                        results.append("")
                        await ws_manager.send_step_update(
                            message_id, step_id, "failed",
                            error=error_msg,
                            client_id=client_id,
                        )
                        await ws_manager.send_terminal_line(
                            f"Blocking failure: {error_msg}", "error", client_id
                        )
                        break
                    else:
                        if step["status"] == "failed":
                            break
                        if not result_recorded:
                            results.append(result_str)
                else:
                    results.append(result_str)

                if step["status"] == "failed":
                    break

                step["status"] = "done"
                step["result"] = result_str

                await ws_manager.send_step_update(
                    message_id, step_id, "done",
                    result=result_str[:200],  # Truncate for frontend
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"✓ {step['label']}", "success", client_id
                )

            except Exception as e:
                error_msg = str(e)[:200]
                step["status"] = "failed"
                step["error"] = error_msg
                results.append("")

                await ws_manager.send_step_update(
                    message_id, step_id, "failed",
                    error=error_msg,
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"✗ {step['label']}: {error_msg}", "error", client_id
                )

                logger.error(f"Step {step_id} failed: {e}", exc_info=True)

                if tool_name in NON_BLOCKING_FAILURE_TOOLS:
                    await ws_manager.send_terminal_line(
                        f"Continuing after non-blocking failure: {step['label']}",
                        "warning",
                        client_id,
                    )
                    continue

                # Send failure summary to chat with exact format
                step_num = i + 1
                completed_range = f"Steps 1\u2013{step_num - 1} completed" if step_num > 1 else "No steps completed"
                chat_failure_msg = (
                    f"Step {step_num} failed after 2 attempts: {error_msg}. "
                    f"{completed_range}."
                )
                await ws_manager.send_agent_response(
                    {
                        "role": "assistant",
                        "content": chat_failure_msg,
                    },
                    client_id,
                )
                await ws_manager.send_terminal_line(
                    f"Step {step_num} failed after retry handling. Stopping task so I do not continue with unsafe inputs.",
                    "error",
                    client_id,
                )
                break

        await ws_manager.send_status("idle", client_id)
        return steps

    async def _execute_tool_with_retry(
        self,
        tool_name: str,
        tool_func: Callable,
        resolved_args: Dict[str, Any],
        client_id: str,
    ) -> Any:
        """Execute a tool, retrying only tools configured as retry-safe."""
        retryable_tools = {
            name.strip()
            for name in settings.agent_retry_tools.split(",")
            if name.strip()
        }
        max_attempts = 1
        if settings.agent_retry_enabled and tool_name in retryable_tools:
            max_attempts = max(1, settings.agent_retry_attempts)

        last_error: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            try:
                if asyncio.iscoroutinefunction(tool_func):
                    return await tool_func(**resolved_args)

                return await asyncio.get_event_loop().run_in_executor(
                    None, lambda: tool_func(**resolved_args)
                )
            except Exception as e:
                last_error = e
                if not self._is_retryable_error(e) or attempt >= max_attempts:
                    break

                logger.warning(
                    "Tool %s failed on attempt %s/%s: %s",
                    tool_name,
                    attempt,
                    max_attempts,
                    e,
                )
                await ws_manager.send_terminal_line(
                    "Step failed, retrying in 2 seconds...",
                    "warning",
                    client_id,
                )
                await asyncio.sleep(max(0, settings.agent_retry_delay_seconds))

        if last_error:
            raise last_error

        return None

    def _is_retryable_error(self, error: Exception) -> bool:
        """Retry transient errors, but never retry destructive or user/auth failures."""
        message = str(error).lower()
        if "element not found" in message:
            return True
        if any(marker in message for marker in NON_RETRYABLE_ERROR_MARKERS):
            return False
        return any(marker in message for marker in RETRYABLE_ERROR_MARKERS)

    async def _wait_for_approval(self, step_id: str, timeout: float = 300) -> str:
        """Wait for HITL approval with timeout (default 5 minutes)."""
        event = asyncio.Event()
        self._approval_events[step_id] = event

        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return self._approval_results.pop(step_id, "cancel")
        except asyncio.TimeoutError:
            logger.warning(f"Approval timeout for step {step_id}")
            return "cancel"
        finally:
            self._approval_events.pop(step_id, None)

    def submit_approval(self, step_id: str, action: str) -> None:
        """Submit an approval response from the frontend."""
        self._approval_results[step_id] = action
        event = self._approval_events.get(step_id)
        if event:
            event.set()

    def _resolve_references(
        self, args: Dict[str, Any], results: List[str]
    ) -> Dict[str, Any]:
        """Replace {{step_N_result}} references with actual results."""
        resolved = {}
        for key, value in args.items():
            if isinstance(value, str):
                for i, result in enumerate(results):
                    placeholder = f"{{{{step_{i}_result}}}}"
                    if placeholder in value:
                        value = value.replace(placeholder, result)
            resolved[key] = value
        return resolved


# Singleton
executor = Executor()
