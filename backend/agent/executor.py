"""
TORCH Agent Executor
Runs validated execution plans step-by-step with HITL support.
"""

import asyncio
import logging
import importlib
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable

from websocket import manager as ws_manager
from config.settings import settings

logger = logging.getLogger("torch.executor")

NON_BLOCKING_FAILURE_TOOLS = {"screenshot"}
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
        self._is_cancelled = False

        await ws_manager.send_status("executing", client_id)

        from agent.step_phrasing import get_plain_phrase
        from errors.plain_language import translate_error
        from agent.rollback import rollback_manager

        for i, step in enumerate(steps):
            if self._is_cancelled:
                # Mark remaining steps as failed
                for remaining_step in steps[i:]:
                    remaining_step["status"] = "failed"
                    remaining_step["error"] = "Task stopped by user"
                    await ws_manager.send_step_update(
                        message_id, remaining_step["id"], "failed",
                        error="Task stopped by user",
                        client_id=client_id,
                    )
                break

            step_id = step["id"]
            tool_name = step["tool"]
            args = step.get("args", {})

            # Resolve step references in args (e.g., {{step_0_result}})
            resolved_args = self._resolve_references(args, results)

            # Update step label dynamically to present tense
            plain_label = get_plain_phrase(tool_name, resolved_args, "active")
            step["label"] = plain_label

            # Handle error steps
            if tool_name == "error":
                step["status"] = "failed"
                err_text = step.get("error", "Unknown error")
                translated = translate_error(err_text)
                translated_err = f"{translated['what_happened']} {translated['what_to_do']}"
                step["error"] = translated_err
                await ws_manager.send_step_update(
                    message_id, step_id, "failed",
                    error=translated_err,
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"Error: {translated_err}", "error", client_id
                )
                results.append("")
                break

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

                if self._is_cancelled or approval == "cancel":
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
                    # Mark remaining steps as failed
                    for remaining_step in steps[i+1:]:
                        remaining_step["status"] = "failed"
                        remaining_step["error"] = "Task stopped by user"
                        await ws_manager.send_step_update(
                            message_id, remaining_step["id"], "failed",
                            error="Task stopped by user",
                            client_id=client_id,
                        )
                    break

                await ws_manager.send_terminal_line("Approved ✓", "success", client_id)
                await ws_manager.send_status("executing", client_id)

            # Register step for rollback before execution if reversible
            rollback_manager.register_step(message_id, tool_name, resolved_args)

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
                            translated = translate_error(error_msg)
                            plain_err = f"{translated['what_happened']} {translated['what_to_do']}"
                            step["status"] = "failed"
                            step["error"] = plain_err
                            results.append("")
                            await ws_manager.send_step_update(
                                message_id, step_id, "failed",
                                error=plain_err,
                                client_id=client_id,
                            )
                            await ws_manager.send_terminal_line(
                                f"Blocking failure: {plain_err}", "error", client_id
                            )
                            break
                    except Exception as e:
                        translated = translate_error(str(e))
                        plain_err = f"{translated['what_happened']} {translated['what_to_do']}"
                        step["status"] = "failed"
                        step["error"] = plain_err
                        results.append("")
                        await ws_manager.send_step_update(
                            message_id, step_id, "failed",
                            error=plain_err,
                            client_id=client_id,
                        )
                        await ws_manager.send_terminal_line(
                            f"Blocking failure: {plain_err}", "error", client_id
                        )
                        break
                    else:
                        if step["status"] == "failed":
                            break
                        if not result_recorded:
                            results.append(result_str)
                else:
                    if tool_name == "find_file" and result_str.startswith("Found"):
                        first_path = self._extract_first_path(result_str)
                        results.append(first_path or result_str)
                    elif tool_name in {"read_pdf", "read_word", "read_excel", "move_file", "delete_file"}:
                        results.append(result_str)
                    elif "Analysis failed:" in result_str or result_str.startswith("Command failed"):
                        raise RuntimeError(result_str)
                    else:
                        results.append(result_str)

                if step["status"] == "failed":
                    break

                step["status"] = "done"
                step["result"] = result_str
                step["label"] = get_plain_phrase(tool_name, resolved_args, "done")

                await ws_manager.send_step_update(
                    message_id, step_id, "done",
                    result=result_str[:200],  # Truncate for frontend
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"✓ {step['label']}", "success", client_id
                )

            except Exception as e:
                translated = translate_error(str(e))
                plain_err = f"{translated['what_happened']} {translated['what_to_do']}"
                step["status"] = "failed"
                step["error"] = plain_err
                results.append("")

                await ws_manager.send_step_update(
                    message_id, step_id, "failed",
                    error=plain_err,
                    client_id=client_id,
                )
                await ws_manager.send_terminal_line(
                    f"✗ {step['label']}: {plain_err}", "error", client_id  
                )

                logger.error(f"Step {step_id} failed: {e}", exc_info=True)

                if tool_name in NON_BLOCKING_FAILURE_TOOLS:
                    await ws_manager.send_terminal_line(
                        f"Continuing after non-blocking failure: {step['label']}",
                        "warning",
                        client_id,
                    )
                    continue

                break

        await ws_manager.send_status("idle", client_id)
        # Schedule auto-cleanup of backups after 5 minutes
        asyncio.create_task(rollback_manager.schedule_cleanup(message_id, 300))
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

    def submit_approval(self, step_id: str, action: str) -> bool:
        """Submit an approval response from the frontend."""
        if action not in {"approve", "edit", "cancel"}:
            return False
        event = self._approval_events.get(step_id)
        if not event or event.is_set():
            return False
        self._approval_results[step_id] = action
        event.set()
        return True

    def _extract_first_path(self, find_result: str) -> Optional[str]:
        """Pull the first file path from a find_file result string."""
        for line in find_result.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("Found"):
                continue
            path_part = stripped.split(" (", 1)[0].strip()
            if path_part:
                candidate = Path(path_part).expanduser()
                if ".." in candidate.parts or not candidate.is_absolute():
                    return None
                normalized = candidate.resolve()
                if not normalized.exists():
                    return None
                return str(normalized)
        return None

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
