"""
TORCH Agent Executor
Runs validated execution plans step-by-step with HITL support.
"""

import asyncio
import logging
import importlib
from typing import List, Dict, Any, Optional, Callable

from websocket import manager as ws_manager

logger = logging.getLogger("torch.executor")


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

                # Call tool (support both sync and async)
                if asyncio.iscoroutinefunction(tool_func):
                    result = await tool_func(**resolved_args)
                else:
                    result = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: tool_func(**resolved_args)
                    )

                result_str = str(result) if result is not None else "Done"

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
                        else:
                            results.append(result_str)
                    except Exception:
                        results.append(result_str)
                else:
                    results.append(result_str)

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

        await ws_manager.send_status("idle", client_id)
        return steps

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
