"""
Bundle the TORCH backend into a self-contained executable.

The installed app must run on a machine with no Python. Shipping the venv does
not achieve that: pyvenv.cfg points at the Python that created it, so the copy
is dead on any other machine. PyInstaller embeds the interpreter instead.

Usage:
    python backend/build_backend.py

Output: dist-backend/torch-backend/torch-backend.exe
"""

import os
import shutil
import sys

import PyInstaller.__main__

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DIST_DIR = os.path.join(PROJECT_ROOT, "dist-backend")

# The executor and provider factory import these by name at runtime, so nothing
# in the source graph references them and PyInstaller would leave them out.
TORCH_MODULES = [
    "tools.browser",
    "tools.email",
    "tools.files",
    "tools.screen",
    "tools.social",
    "tools.system",
    "tools.vision_control",
    "tools.voice",
    "agent.brain",
    "agent.companion",
    "agent.context",
    "agent.executor",
    "agent.planner",
    "agent.rollback",
    "agent.step_phrasing",
    "agent.voice_synthesis",
    "agent.providers",
    "agent.providers.base",
    "agent.providers.claude_provider",
    "agent.providers.deepseek_provider",
    "agent.providers.gemini_provider",
    "agent.providers.ollama_provider",
    "agent.providers.openai_provider",
    "errors.plain_language",
    "memory.storage",
    "memory.habits",
    "memory.predict",
    "auth",
    "websocket",
]

# uvicorn resolves these at runtime, so static analysis never sees them.
HIDDEN_IMPORTS = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "anyio._backends._asyncio",
]

# Pulled in transitively but never used by TORCH. Excluding them keeps the
# bundle from carrying a GUI toolkit and a plotting stack.
EXCLUDES = [
    "matplotlib",
    "tkinter",
    "PyQt5",
    "PySide2",
    "notebook",
    "IPython",
    "pytest",
]


def _data_arg(source: str, target: str) -> str:
    """PyInstaller --add-data uses os.pathsep between source and target."""
    return f"{source}{os.pathsep}{target}"


def main() -> int:
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)

    args = [
        os.path.join(BACKEND_DIR, "main.py"),
        "--name=torch-backend",
        # onedir starts noticeably faster than onefile, which unpacks to temp
        # on every launch - the user waits for that on every app start.
        "--onedir",
        "--noconfirm",
        "--clean",
        "--console",
        f"--distpath={DIST_DIR}",
        f"--workpath={os.path.join(PROJECT_ROOT, 'build-backend')}",
        f"--specpath={os.path.join(PROJECT_ROOT, 'build-backend')}",
        f"--paths={BACKEND_DIR}",
    ]

    for name in HIDDEN_IMPORTS + TORCH_MODULES:
        args.append(f"--hidden-import={name}")
    for name in EXCLUDES:
        args.append(f"--exclude-module={name}")

    schema = os.path.join(BACKEND_DIR, "schema.sql")
    if os.path.exists(schema):
        args.append(f"--add-data={_data_arg(schema, '.')}")

    config_dir = os.path.join(BACKEND_DIR, "config")
    if os.path.isdir(config_dir):
        args.append(f"--add-data={_data_arg(config_dir, 'config')}")

    print("[build_backend] running PyInstaller...", flush=True)
    PyInstaller.__main__.run(args)

    exe = os.path.join(DIST_DIR, "torch-backend", "torch-backend.exe")
    if not os.path.exists(exe):
        print(f"[build_backend] FAILED - expected {exe}", file=sys.stderr)
        return 1

    size_mb = round(os.path.getsize(exe) / (1024 * 1024), 1)
    print(f"[build_backend] built {exe} ({size_mb} MB launcher)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
