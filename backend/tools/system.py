"""
TORCH Tools — System Operations
OS-level control: open apps, run terminal commands, download files.
"""

import os
import sys
import subprocess
import logging
import platform
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger("torch.tools.system")

WINDOWS_APP_COMMANDS = {
    "vs code": "code",
    "visual studio code": "code",
    "vscode": "code",
    "notepad": "notepad",
    "explorer": "explorer",
    "file explorer": "explorer",
    "chrome": "chrome",
    "edge": "msedge",
    "firefox": "firefox",
}


def open_app(name: str) -> str:
    """Open an application by name."""
    system = platform.system()
    normalized = name.strip().lower()

    try:
        if system == "Windows":
            command = WINDOWS_APP_COMMANDS.get(normalized, name)
            if command == "code":
                subprocess.Popen(["cmd", "/c", "start", "", "code"], shell=False)
                return "Opened VS Code."
            subprocess.Popen(["cmd", "/c", "start", "", command], shell=False)
            return f"Opened {name}."
        elif system == "Darwin":
            subprocess.Popen(["open", "-a", name])
            return f"Opened {name}."
        else:
            subprocess.Popen([name])
            return f"Opened {name}."
    except Exception as e:
        try:
            if system == "Windows":
                subprocess.Popen(f'start "" "{name}"', shell=True)
            else:
                subprocess.Popen(name, shell=True)
            return f"Opened {name}."
        except Exception as e2:
            logger.error(f"Failed to open app: {e2}")
            raise RuntimeError(f"Could not open '{name}'. Try the exact app name or use run_terminal.")


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
