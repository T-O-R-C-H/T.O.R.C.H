"""
TORCH Tools — System Operations
OS-level control: open apps, run terminal commands, download files.
"""

import os
import sys
import subprocess
import logging
import platform
import time
from pathlib import Path
from typing import Dict, Optional

from errors.plain_language import UserFacingError

import requests

logger = logging.getLogger("torch.tools.system")

# What people call an app, mapped to what Windows actually launches.
#
# Spoken names rarely match executables: "calculator" is calc, and on Windows
# 11 the reliable route to a Store app is its URI rather than a stale shim in
# System32. Without this a request becomes `start "" calculator`, which Windows
# cannot resolve and answers with an error dialog.
WINDOWS_APP_COMMANDS = {
    # Store apps — the URI is what actually works on Windows 10/11.
    "calculator": "ms-calculator:",
    "calc": "ms-calculator:",
    "settings": "ms-settings:",
    "system settings": "ms-settings:",
    "windows settings": "ms-settings:",
    "photos": "ms-photos:",
    "camera": "microsoft.windows.camera:",
    "maps": "bingmaps:",
    "store": "ms-windows-store:",
    "microsoft store": "ms-windows-store:",
    "clock": "ms-clock:",
    "alarms": "ms-clock:",
    "mail": "outlookmail:",

    # Classic desktop executables.
    "notepad": "notepad",
    "wordpad": "write",
    "paint": "mspaint",
    "ms paint": "mspaint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "files": "explorer",
    "task manager": "taskmgr",
    "control panel": "control",
    "command prompt": "cmd",
    "cmd": "cmd",
    "powershell": "powershell",
    "terminal": "wt",
    "windows terminal": "wt",
    "registry editor": "regedit",
    "character map": "charmap",
    "snipping tool": "snippingtool",
    "magnifier": "magnify",
    "on-screen keyboard": "osk",

    # Editors and browsers.
    "vs code": "code",
    "visual studio code": "code",
    "vscode": "code",
    "code": "code",
    "chrome": "chrome",
    "google chrome": "chrome",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "firefox": "firefox",

    # Office.
    "word": "winword",
    "microsoft word": "winword",
    "excel": "excel",
    "microsoft excel": "excel",
    "powerpoint": "powerpnt",
    "microsoft powerpoint": "powerpnt",
    "outlook": "outlook",
}

# How long to wait for a window before deciding the launch failed. Store apps
# are the slow case; classic executables appear well inside this.
LAUNCH_TIMEOUT_SECONDS = 3.0

# Launched apps must not inherit TORCH's stdio. A child that holds those pipes
# keeps them open for its whole lifetime, which blocks anything reading the
# backend's output.
_DETACHED = {
    "stdin": subprocess.DEVNULL,
    "stdout": subprocess.DEVNULL,
    "stderr": subprocess.DEVNULL,
}


# Windows shows "Windows cannot find ..." in a standard dialog whose title is
# the app name you asked for, so a naive window check counts the failure as a
# success. Dialogs never mean "the app opened".
DIALOG_CLASS_NAMES = {"#32770"}


def _visible_windows() -> Dict[int, "tuple[str, str]"]:
    """
    Titled, visible top-level windows as handle -> (title, class name).

    Implemented with ctypes so this costs nothing and adds no dependency.
    """
    if platform.system() != "Windows":
        return {}

    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    user32.EnumWindows.argtypes = [ctypes.c_void_p, wintypes.LPARAM]
    user32.EnumWindows.restype = wintypes.BOOL
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]

    windows: Dict[int, "tuple[str, str]"] = {}
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def collect(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        title_buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title_buffer, length + 1)
        class_buffer = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buffer, 256)
        title = title_buffer.value.strip()
        if title:
            windows[int(hwnd)] = (title, class_buffer.value)
        return True

    # The callback must outlive the call: passing callback_type(collect) inline
    # lets Python collect it mid-enumeration, which hangs the process.
    proc = callback_type(collect)
    try:
        user32.EnumWindows(proc, 0)
    except Exception as exc:
        logger.warning(f"Could not enumerate windows: {exc}")
    return windows


def _await_new_window(before: Dict[int, "tuple[str, str]"], app_name: str) -> Optional[str]:
    """
    Wait for a real application window.

    Returns its title, or None if only an error dialog appeared or nothing did.
    Launching an app that is already running focuses the existing window rather
    than creating one, so an existing match counts.
    """
    needle = app_name.strip().lower()
    deadline = time.time() + LAUNCH_TIMEOUT_SECONDS

    while time.time() < deadline:
        time.sleep(0.25)
        current = _visible_windows()

        for handle, (title, class_name) in current.items():
            if handle in before:
                continue
            if class_name in DIALOG_CLASS_NAMES:
                # Windows telling the user it could not find the app.
                logger.warning(f"Launch produced an error dialog: {title!r}")
                return None
            return title

        # Already running: the launch focused it instead of opening a window.
        for title, class_name in current.values():
            if class_name in DIALOG_CLASS_NAMES:
                continue
            if needle and needle in title.lower():
                return title

    return None


def open_app(name: str) -> str:
    """
    Open an application by name.

    Verifies a window actually appeared. `cmd /c start` succeeds as long as cmd
    itself ran, so without this check a mistyped or missing app reported
    "Opened ..." while Windows showed the user an error dialog.
    """
    system = platform.system()
    normalized = name.strip().lower()
    command = WINDOWS_APP_COMMANDS.get(normalized, name.strip())

    before = _visible_windows()
    launched = False

    try:
        if system == "Windows":
            # A ms-*: URI has to go through the shell handler, not as a command.
            if ":" in command and not command.endswith(".exe"):
                os.startfile(command)  # type: ignore[attr-defined]
            else:
                subprocess.Popen(["cmd", "/c", "start", "", command], shell=False, **_DETACHED)
            launched = True
        elif system == "Darwin":
            subprocess.Popen(["open", "-a", name], **_DETACHED)
            launched = True
        else:
            subprocess.Popen([command], **_DETACHED)
            launched = True
    except Exception as e:
        logger.warning(f"Primary launch for '{name}' failed ({e}); trying the OS launcher")
        try:
            # `name` comes from a model-generated plan, so it never reaches a
            # shell: os.startfile hands it to the OS launcher directly, and the
            # other platforms use an argv list rather than a command string.
            if system == "Windows":
                os.startfile(command)  # type: ignore[attr-defined]
            elif system == "Darwin":
                subprocess.Popen(["open", name], **_DETACHED)
            else:
                subprocess.Popen(["xdg-open", command], **_DETACHED)
            launched = True
        except Exception as e2:
            logger.error(f"Failed to open app: {e2}")
            raise UserFacingError(
                f"I couldn't open {name}. Check the name is right, or tell me the "
                f"full path to the program."
            )

    if not launched or system != "Windows":
        # Window verification is Windows-only; elsewhere a clean launch stands.
        return f"Opened {name}."

    window_title = _await_new_window(before, normalized)
    if window_title:
        logger.info(f"Opened {name}: window '{window_title}'")
        return f"Opened {name}."

    # The launcher returned without error but nothing came up - usually a name
    # Windows could not resolve, which it reports in a dialog the agent cannot
    # see. Saying "Opened" here would be a plain untruth.
    logger.warning(f"No window appeared for '{name}' within {LAUNCH_TIMEOUT_SECONDS}s")
    raise UserFacingError(
        f"I tried to open {name}, but no window appeared. It may not be "
        f"installed under that name - try the exact name, or the full path."
    )


def run_terminal(command: str) -> str:
    """Run a terminal command and return output. Requires HITL for modifying commands."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(Path.home()),
        )

        output = result.stdout.strip()
        error = result.stderr.strip()

        if result.returncode != 0:
            return f"Command failed (exit {result.returncode}):\n{error or output}"

        return output if output else "Command executed successfully (no output)"

    except subprocess.TimeoutExpired:
        return "Command timed out (60s limit)"
    except Exception as e:
        logger.error(f"Terminal command failed: {e}")
        raise RuntimeError(f"Command failed: {e}")


def download_file(url: str, path: str = "~/Downloads") -> str:
    """Download a file from a URL."""
    try:
        download_dir = Path(path).expanduser().resolve()
        download_dir.mkdir(parents=True, exist_ok=True)

        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()

        # Get filename from URL or Content-Disposition
        filename = url.split("/")[-1].split("?")[0]
        content_disp = response.headers.get("Content-Disposition")
        if content_disp and "filename=" in content_disp:
            filename = content_disp.split("filename=")[-1].strip('"')

        if not filename:
            filename = "download"

        filepath = download_dir / filename

        total = 0
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)

        size_str = _format_size(total)
        logger.info(f"Downloaded {filepath} ({size_str})")
        return f"Downloaded: {filepath} ({size_str})"

    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise RuntimeError(f"Download failed: {e}")


def _format_size(size_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f}TB"
