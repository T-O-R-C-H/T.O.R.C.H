"""
TORCH Rollback Manager (ADD-4)
Creates and restores backups for file actions to allow user-driven undo operations.
"""

import os
import shutil
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger("torch.rollback")

REVERSIBLE_TOOLS = {"move_file", "delete_file", "create_folder", "zip_files"}

class RollbackManager:
    def __init__(self):
        self.backups = {}  # message_id -> list of rollback actions
        self.backup_dir = Path("./data/backups")

    def register_step(self, message_id: str, tool_name: str, args: Dict[str, Any]):
        if tool_name not in REVERSIBLE_TOOLS:
            return

        if message_id not in self.backups:
            self.backups[message_id] = []

        try:
            self.backup_dir.mkdir(parents=True, exist_ok=True)
            if tool_name == "delete_file":
                filepath = Path(args.get("filepath", "")).expanduser().resolve()
                if filepath.exists():
                    backup_path = self.backup_dir / f"{message_id}_{filepath.name}"
                    if filepath.is_dir():
                        shutil.copytree(str(filepath), str(backup_path))
                        self.backups[message_id].append({
                            "tool": "delete_file",
                            "type": "directory",
                            "original_path": str(filepath),
                            "backup_path": str(backup_path)
                        })
                    else:
                        shutil.copy2(str(filepath), str(backup_path))
                        self.backups[message_id].append({
                            "tool": "delete_file",
                            "type": "file",
                            "original_path": str(filepath),
                            "backup_path": str(backup_path)
                        })
            elif tool_name == "move_file":
                src = str(Path(args.get("src", "")).expanduser().resolve())
                dst = str(Path(args.get("dst", "")).expanduser().resolve())
                dst_path = Path(dst)
                dst_backup_path = None
                if dst_path.exists():
                    dst_backup_path = self.backup_dir / f"{message_id}_overwrite_{dst_path.name}"
                    if dst_path.is_dir():
                        shutil.copytree(str(dst_path), str(dst_backup_path))
                    else:
                        shutil.copy2(str(dst_path), str(dst_backup_path))
                self.backups[message_id].append({
                    "tool": "move_file",
                    "src": src,
                    "dst": dst,
                    "dst_backup_path": str(dst_backup_path) if dst_backup_path else None
                })
            elif tool_name == "create_folder":
                path = str(Path(args.get("path", "")).expanduser().resolve())
                exists = Path(path).exists()
                self.backups[message_id].append({
                    "tool": "create_folder",
                    "path": path,
                    "already_existed": exists
                })
            elif tool_name == "zip_files":
                output = str(Path(args.get("output", "")).expanduser().resolve())
                exists = Path(output).exists()
                output_backup_path = None
                if exists:
                    output_backup_path = self.backup_dir / f"{message_id}_zip_overwrite_{Path(output).name}"
                    shutil.copy2(output, str(output_backup_path))
                self.backups[message_id].append({
                    "tool": "zip_files",
                    "output": output,
                    "already_existed": exists,
                    "output_backup_path": str(output_backup_path) if output_backup_path else None
                })
        except Exception as e:
            logger.error(f"Failed to register step for rollback: {e}")

    def has_reversible_actions(self, message_id: str) -> bool:
        return len(self.backups.get(message_id, [])) > 0

    def rollback(self, message_id: str) -> Dict[str, Any]:
        """Rollback all actions for message_id in reverse order."""
        actions = self.backups.get(message_id, [])
        if not actions:
            return {"status": "error", "message": "No actions to undo or undo window expired"}

        reversed_actions = list(reversed(actions))
        success_list = []
        fail_list = []

        for action in reversed_actions:
            tool = action.get("tool")
            try:
                if tool == "delete_file":
                    orig = action["original_path"]
                    backup = action["backup_path"]
                    if action["type"] == "directory":
                        if os.path.exists(orig):
                            shutil.rmtree(orig)
                        shutil.copytree(backup, orig)
                        success_list.append(f"Restored directory {Path(orig).name}")
                    else:
                        if os.path.exists(orig):
                            os.remove(orig)
                        shutil.copy2(backup, orig)
                        success_list.append(f"Restored file {Path(orig).name}")
                elif tool == "move_file":
                    src = action["src"]
                    dst = action["dst"]
                    dst_backup = action.get("dst_backup_path")
                    if os.path.exists(dst):
                        shutil.move(dst, src)
                        success_list.append(f"Moved {Path(dst).name} back to original location")
                    if dst_backup and os.path.exists(dst_backup):
                        if os.path.isdir(dst_backup):
                            shutil.copytree(dst_backup, dst)
                        else:
                            shutil.copy2(dst_backup, dst)
                elif tool == "create_folder":
                    path = action["path"]
                    if not action["already_existed"] and os.path.exists(path):
                        shutil.rmtree(path)
                        success_list.append(f"Removed created directory {Path(path).name}")
                elif tool == "zip_files":
                    output = action["output"]
                    dst_backup = action.get("output_backup_path")
                    if os.path.exists(output):
                        os.remove(output)
                    if dst_backup and os.path.exists(dst_backup):
                        shutil.copy2(dst_backup, output)
                    success_list.append(f"Removed zip archive {Path(output).name}")
            except Exception as e:
                logger.error(f"Failed to rollback action {action}: {e}")
                fail_list.append(f"Failed to restore {action.get('original_path') or action.get('path') or action.get('dst')}")

        # Clean up backups immediately after undo
        self.clean_backup(message_id)

        return {
            "status": "success" if not fail_list else "partial",
            "reversed": success_list,
            "failed": fail_list
        }

    def clean_backup(self, message_id: str):
        actions = self.backups.pop(message_id, [])
        for action in actions:
            backup_path = action.get("backup_path") or action.get("dst_backup_path") or action.get("output_backup_path")
            if backup_path and os.path.exists(backup_path):
                try:
                    if os.path.isdir(backup_path):
                        shutil.rmtree(backup_path)
                    else:
                        os.remove(backup_path)
                except Exception:
                    pass

    async def schedule_cleanup(self, message_id: str, delay_seconds: float = 300.0):
        """Asynchronously cleans up backups after a delay (default 5 minutes)."""
        await asyncio.sleep(delay_seconds)
        if message_id in self.backups:
            logger.info(f"Expiring undo window for message: {message_id}")
            self.clean_backup(message_id)

rollback_manager = RollbackManager()
