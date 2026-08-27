"""
TORCH Backend — FastAPI Server Entry Point
Handles WebSocket communication and REST API endpoints.
"""

import sys
import os
import asyncio
import json
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ─── Pydantic Models ───


class SkillCreateRequest(BaseModel):
    """Request body for creating a new skill."""
    name: str = Field(..., description="Shortcut name (e.g. Morning Briefing)")
    command: str = Field(..., description="Command to execute (e.g. summarize my emails)")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import settings
from auth import verify_token, verify_ws_token
from websocket import manager as ws_manager
from agent.brain import plan_command
from agent.planner import validate_plan, create_response_message
from agent.executor import executor
from errors.plain_language import translate_error
from agent.rollback import rollback_manager
from system_checks import check_playwright_readiness

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("torch.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("═══════════════════════════════════════════")
    logger.info("  TORCH v1.0.0 — Starting backend server")
    logger.info("═══════════════════════════════════════════")
    logger.info(f"Server: http://{settings.host}:{settings.port}")
    logger.info(f"WebSocket: ws://{settings.host}:{settings.port}/ws")
    logger.info(f"Gemini model: {settings.gemini_model}")
    logger.info(f"Screen watch: {'enabled' if settings.screen_watch_enabled else 'disabled'}")

    # Create data directory
    os.makedirs(settings.data_dir, exist_ok=True)

    # Check Playwright/Chromium in the background so the server becomes healthy
    # immediately instead of blocking startup on a full Chromium launch.
    playwright_task = asyncio.create_task(_warm_playwright())

    # Warm up tool registry so the first command is faster
    try:
        from agent.executor import executor
        logger.info(f"Agent tools preloaded: {len(executor._tool_registry)}")
    except Exception as e:
        logger.warning(f"Agent tool preload failed: {e}")

    try:
        import pyautogui  # noqa: F401
        logger.info("Screen capture: pyautogui available")
    except ImportError:
        try:
            import mss  # noqa: F401
            logger.info("Screen capture: mss available")
        except ImportError:
            logger.warning("Screen capture: install pyautogui and mss — pip install pyautogui mss")

    yield

    logger.info("TORCH backend shutting down")
    if not playwright_task.done():
        playwright_task.cancel()
        try:
            await playwright_task
        except (asyncio.CancelledError, Exception):
            pass


async def _warm_playwright() -> None:
    """Verify Playwright + Chromium are installed without blocking server startup."""
    result = await check_playwright_readiness()
    if result["browser_automation_ready"]:
        logger.info("Playwright: ready (Chromium found)")
    else:
        logger.warning("Playwright: %s", result["message"])
        logger.warning("Run: playwright install chromium")


app = FastAPI(
    title="TORCH Backend",
    description="Thinking, Observing, Reasoning, Creating & Handling",
    version="1.0.0",
    lifespan=lifespan,
    # Every REST route requires the session token. The WebSocket route is not
    # covered by this and checks the token itself before accepting.
    dependencies=[Depends(verify_token)],
)

# CORS. Credentials stay off: auth rides on the Authorization header, not
# cookies, and "*" origins with credentials enabled is invalid per spec.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST API ───


@app.get("/api/status")
async def get_status() -> dict[str, str | bool | int]:
    """Get TORCH backend status."""
    is_gemini_configured = bool(settings.gemini_api_key and settings.gemini_api_key != "AIzaSyTrialCloudKeyPlaceholder")
    return {
        "status": "running",
        "version": "1.0.0",
        "gemini_configured": is_gemini_configured,
        "gmail_configured": bool(settings.gmail_address),
        "screen_watch": settings.screen_watch_enabled,
        "connections": len(ws_manager.active_connections),
    }


@app.get("/api/system-check")
async def system_check():
    """Check if Playwright browser automation is installed and ready."""
    return await check_playwright_readiness()


@app.get("/api/models")
async def list_models():
    """
    Speed/depth choices for the command input picker.

    Users never see model or vendor names, so these are labelled by what they
    do. The ids stay real model identifiers because get_provider() routes on
    them; only whichever provider is actually configured is offered.
    """
    tiers = [{"id": "auto", "label": "Automatic"}]

    if settings.gemini_api_key:
        tiers.append({"id": "gemini-2.5-flash", "label": "Faster"})
        tiers.append({"id": "gemini-2.5-pro", "label": "More thorough"})
    elif settings.deepseek_api_key:
        tiers.append({"id": "deepseek-v4-flash", "label": "Faster"})
        tiers.append({"id": "deepseek-v4-pro", "label": "More thorough"})
    elif settings.anthropic_api_key:
        tiers.append({"id": "claude-haiku-4-5", "label": "Faster"})
        tiers.append({"id": "claude-sonnet-4-6", "label": "More thorough"})

    return {"models": tiers, "current": "auto"}


@app.post("/api/email/test")
async def test_email_connection():
    """Verify Gmail credentials by signing into IMAP."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=400, detail="Add your Gmail address and App Password in Settings first.")
    try:
        import imaplib
        mail = imaplib.IMAP4_SSL(settings.gmail_imap_host)
        mail.login(settings.gmail_address, "".join(settings.gmail_app_password.split()))
        mail.logout()
        return {"ok": True, "address": settings.gmail_address, "message": "Gmail connection works."}
    except Exception as e:
        logger.error(f"Gmail test failed: {e}")
        raise HTTPException(status_code=400, detail=_friendly_email_error(e))


def _friendly_email_error(err: Exception) -> str:
    """Turn raw IMAP/SMTP exceptions into user-friendly messages."""
    message = str(err)
    low = message.lower()
    if "authenticationfailed" in low or "invalid credentials" in low or "login failed" in low:
        return (
            "Incorrect Gmail address or App Password. Re-check both in Settings, then generate a "
            "fresh App Password at myaccount.google.com/apppasswords and save it again."
        )
    if "timed out" in low or "timeout" in low:
        return "Gmail connection timed out. Check your internet connection and try again."
    if "name or service not known" in low or "getaddrinfo" in low:
        return "Could not reach Gmail's servers. Check your internet connection and try again."
    return f"Gmail connection failed: {message}"


def _structured_inbox_from_steps(completed_steps: list) -> list | None:
    """Re-fetch the inbox as structured messages for the chat recap card."""
    step = next((s for s in completed_steps if s.get("tool") == "read_inbox"), None)
    if not step:
        return None
    try:
        from tools.email import inbox_emails
        args = step.get("args") or {}
        count = args.get("count") or 10
        query = args.get("query") or ""
        return inbox_emails(count=int(count), query=str(query))
    except Exception as e:
        logger.warning(f"Could not build structured inbox recap: {e}")
        return None


@app.get("/api/email/inbox")
async def email_inbox(limit: int = 100, offset: int = 0):
    """List inbox messages (newest first) as structured JSON."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=400, detail="Add your Gmail address and App Password in Settings first.")
    try:
        from tools.email import fetch_inbox
        return fetch_inbox(limit=max(1, min(limit, 500)), offset=max(0, offset))
    except Exception as e:
        logger.error(f"Inbox fetch failed: {e}")
        raise HTTPException(status_code=400, detail=_friendly_email_error(e))


@app.get("/api/email/read")
async def email_read(uid: str):
    """Return the full content of a single inbox message."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=400, detail="Add your Gmail address and App Password in Settings first.")
    if not uid:
        raise HTTPException(status_code=400, detail="Missing uid.")
    try:
        from tools.email import fetch_email
        return fetch_email(uid)
    except Exception as e:
        logger.error(f"Email read failed: {e}")
        raise HTTPException(status_code=400, detail=_friendly_email_error(e))


@app.post("/api/email/mark-read")
async def email_mark_read(data: dict):
    """Mark a message as read or unread."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=400, detail="Add your Gmail address and App Password in Settings first.")
    uid = str(data.get("uid", ""))
    read = bool(data.get("read", True))
    if not uid:
        raise HTTPException(status_code=400, detail="Missing uid.")
    try:
        from tools.email import mark_email_read
        mark_email_read(uid, read)
        return {"ok": True, "uid": uid, "read": read}
    except Exception as e:
        logger.error(f"Mark-read failed: {e}")
        raise HTTPException(status_code=400, detail=_friendly_email_error(e))


_GREETING_MARKERS = (
    "help you with today",
    "help you with anything",
    "how can i help",
    "what can i do",
    "anything else",
    "anything i can help",
    "welcome back",
    "at your service",
    "what's up",
    "how are you",
    "how's it going",
    "good morning",
    "good afternoon",
    "good evening",
)


def _is_clarifying_question(text: str) -> bool:
    """True when a reply is a genuine clarifying question that needs an inline
    answer — not a greeting or chit-chat that merely happens to end with '?'."""
    t = (text or "").strip().lower()
    if not t.endswith("?"):
        return False
    return not any(marker in t for marker in _GREETING_MARKERS)


def _connection_status_block() -> str:
    """Live status injected into planner prompts so the model does not guess."""
    gemini_ok = bool(
        settings.gemini_api_key
        and settings.gemini_api_key != "AIzaSyTrialCloudKeyPlaceholder"
    )
    gmail_ok = bool(settings.gmail_address and settings.gmail_app_password)
    screen_ok = False
    try:
        import pyautogui  # noqa: F401
        screen_ok = True
    except ImportError:
        try:
            import mss  # noqa: F401
            screen_ok = True
        except ImportError:
            pass

    lines = [
        "LIVE CONNECTION STATUS (answer questions using ONLY this block):",
        f"- Gemini AI: {'CONNECTED' if gemini_ok else 'NOT CONNECTED. User must add API key in Settings.'}",
    ]
    if gmail_ok:
        lines.append(f"- Gmail: CONNECTED as {settings.gmail_address}. Email is on-demand, not always-on.")
    else:
        lines.append("- Gmail: NOT CONNECTED. User must add Gmail + App Password in Settings.")
    lines.append(
        f"- Screen capture: {'READY' if screen_ok else 'NOT READY. User must install pyautogui/mss in backend.'}"
    )
    lines.append(f"- Default AI model: {settings.gemini_model}")
    return "\n".join(lines)


# Settings the UI may change, mapped to the .env name each one is stored under.
# This doubles as the allowlist for POST /api/settings: anything absent here
# cannot be written, which keeps auth_token, host, db_path and data_dir out of
# reach of a request body.
EDITABLE_SETTINGS = {
    "gemini_api_key": "GEMINI_API_KEY",
    "gemini_model": "GEMINI_MODEL",
    "openai_api_key": "OPENAI_API_KEY",
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "deepseek_api_key": "DEEPSEEK_API_KEY",
    "deepseek_model": "DEEPSEEK_MODEL",
    "gmail_address": "GMAIL_ADDRESS",
    "gmail_app_password": "GMAIL_APP_PASSWORD",
    "gmail_smtp_host": "GMAIL_SMTP_HOST",
    "gmail_smtp_port": "GMAIL_SMTP_PORT",
    "gmail_imap_host": "GMAIL_IMAP_HOST",
    "wake_word": "WAKE_WORD",
    "wake_word_sensitivity": "WAKE_WORD_SENSITIVITY",
    "whisper_model_size": "WHISPER_MODEL_SIZE",
    "screen_watch_enabled": "SCREEN_WATCH_ENABLED",
    "screen_watch_interval": "SCREEN_WATCH_INTERVAL",
    "allow_files": "TORCH_ALLOW_FILES",
    "allow_apps": "TORCH_ALLOW_APPS",
    "allow_email": "TORCH_ALLOW_EMAIL",
}

_TRUTHY = {"1", "true", "yes", "on"}


def _env_file_path() -> str:
    """Where settings are persisted. Indirected so tests can redirect it."""
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def _coerce_setting(key: str, value):
    """
    Convert a JSON value to the type the settings field declares.

    JSON gives strings where the model wants bool or int, and assigning them
    raw is silently wrong: "false" is a truthy string, so a permission switched
    off would have stayed on.
    """
    field = type(settings).model_fields.get(key)
    if field is None:
        return value

    annotation = field.annotation
    if annotation is bool:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in _TRUTHY
    if annotation is int:
        return int(value)
    if annotation is float:
        return float(value)
    if annotation is str:
        return "" if value is None else str(value)
    return value


@app.get("/api/settings")
async def get_settings():
    """Get current settings (sanitized — no secrets)."""
    is_gemini_configured = bool(settings.gemini_api_key and settings.gemini_api_key != "AIzaSyTrialCloudKeyPlaceholder")
    active_provider = None
    if is_gemini_configured:
        active_provider = "gemini"
    elif settings.openai_api_key:
        active_provider = "openai"
    elif settings.anthropic_api_key:
        active_provider = "anthropic"

    return {
        "gemini_model": settings.gemini_model,
        "gemini_configured": is_gemini_configured,
        "openai_configured": bool(settings.openai_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
        "deepseek_configured": bool(settings.deepseek_api_key),
        "deepseek_model": settings.deepseek_model,
        "active_provider": active_provider,
        "gmail_configured": bool(settings.gmail_address and settings.gmail_app_password),
        "gmail_password_set": bool(settings.gmail_app_password),
        "gmail_address": settings.gmail_address,
        "wake_word": settings.wake_word,
        "wake_word_sensitivity": settings.wake_word_sensitivity,
        "whisper_model_size": settings.whisper_model_size,
        "screen_watch_enabled": settings.screen_watch_enabled,
        "screen_watch_interval": settings.screen_watch_interval,
        "allow_files": settings.allow_files,
        "allow_apps": settings.allow_apps,
        "allow_email": settings.allow_email,
    }


@app.post("/api/settings")
async def update_settings(data: dict):
    """Update settings and persist to .env in the root directory."""
    import os
    # .env should be in the root (parent of backend)
    env_path = _env_file_path()
    
    # Update in memory and .env — never wipe secrets with empty strings
    secret_fields = {
        "gemini_api_key",
        "openai_api_key",
        "anthropic_api_key",
        "deepseek_api_key",
        "gmail_app_password",
    }

    filtered = {}
    for key, value in data.items():
        # Only fields this endpoint is designed to manage may be written.
        # Assigning any attribute that happens to exist on settings would let a
        # caller reach auth_token, host, db_path and the rest.
        if key not in EDITABLE_SETTINGS:
            logger.warning(f"Ignoring attempt to set non-editable setting: {key}")
            continue
        if key in secret_fields:
            # Secrets are held in the OS keystore by the desktop app and passed
            # in as environment variables. Writing them back to .env would undo
            # that, so this endpoint no longer accepts them.
            logger.warning(f"Refusing to persist secret through settings API: {key}")
            continue

        try:
            value = _coerce_setting(key, value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Invalid value for {key}")

        filtered[key] = value
        setattr(settings, key, value)


    # Read existing env
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        k, v = parts
                        env_vars[k] = v
                    
    for key, value in filtered.items():
        env_vars[EDITABLE_SETTINGS[key]] = str(value)


    # Write back
    try:
        with open(env_path, "w") as f:
            f.write("# TORCH Environment Variables\n")
            f.write("# Generated/Updated via Settings UI\n\n")
            for k, v in sorted(env_vars.items()):
                f.write(f"{k}={v}\n")
        logger.info(f"Settings persisted to {env_path}")
    except Exception as e:
        logger.error(f"Failed to write .env file: {e}")
        return {"status": "error", "message": str(e)}
            
    return {"status": "updated"}


@app.get("/api/history")
async def get_history():
    """Get task execution history for the UI."""
    from memory.storage import db
    tasks = db.get_tasks(50)
    history_entries = []
    for task in tasks:
        try:
            steps = json.loads(task["steps_json"]) if task["steps_json"] else []
        except Exception:
            steps = []
        
        status = task["status"]
        if status not in ("completed", "failed", "cancelled"):
            status = "completed"
            
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(task["created_at"])
            timestamp = int(dt.timestamp() * 1000)
        except Exception:
            timestamp = int(__import__("time").time() * 1000)
            
        history_entries.append({
            "id": task["id"],
            "command": task["command"],
            "timestamp": timestamp,
            "status": status,
            "stepsCount": len(steps),
            "duration": int(task["duration_ms"] / 1000) if task["duration_ms"] else 0,
            "steps": [{"label": s.get("label", s.get("tool", "step")), "status": s.get("status", "done")} for s in steps]
        })
    return history_entries


@app.delete("/api/history")
async def delete_history():
    """Clear all task and step records from database."""
    from memory.storage import db
    with db._connect() as conn:
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM steps")
    return {"ok": True}


@app.delete("/api/memory")
async def clear_memory():
    """Forget learned habits, contacts and file patterns. Keeps task history."""
    from memory.storage import db

    removed = db.clear_memory()
    logger.info(f"Cleared learned memory: {removed} record(s)")
    return {"ok": True, "removed": removed}


@app.delete("/api/habits")
async def reset_habits():
    """Drop the learned command frequencies only."""
    from memory.storage import db

    removed = db.reset_habits()
    logger.info(f"Reset habits: {removed} record(s)")
    return {"ok": True, "removed": removed}


@app.get("/api/memory")
async def get_memory():
    """Get aggregated frequent commands, contacts, files, and habits."""
    from memory.storage import db
    from memory.habits import detect_time_patterns
    
    habits_list = []
    for i, p in enumerate(detect_time_patterns()):
        p["id"] = f"habit-{i}"
        p["lastOccurrence"] = int(__import__("time").time() * 1000)
        habits_list.append(p)
        
    return {
        "frequent_commands": db.get_frequent_commands(10),
        "frequent_contacts": db.get_frequent_contacts(10),
        "frequent_files": db.get_frequent_files(10),
        "habits": habits_list,
    }


@app.get("/api/skills")
async def api_get_skills():
    """Get all saved skills ordered by run_count DESC."""
    import skills
    return skills.get_skills()


@app.post("/api/skills", status_code=201)
async def api_create_skill(data: SkillCreateRequest):
    """Create a new skill.

    - **name**: Shortcut name (required)
    - **command**: Command to execute (required)

    Returns HTTP 400 if name or command is empty.
    """
    name = data.name
    command = data.command

    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if not command or not command.strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty")

    import skills
    skill_id = skills.save_skill(name, command)
    new_skill = skills.get_skill(skill_id)
    return new_skill


@app.post("/api/skills/{skill_id}/run")
async def api_run_skill(skill_id: str):
    """Run a skill by ID (increment run_count and return the stored command).

    Returns HTTP 404 if the skill does not exist.
    """
    import skills
    command = skills.run_skill(skill_id)
    if not command:
        raise HTTPException(status_code=404, detail="Skill not found")
    updated_skill = skills.get_skill(skill_id)
    return {
        "status": "success",
        "command": command,
        "skill": updated_skill
    }


@app.delete("/api/skills/{skill_id}")
async def api_delete_skill(skill_id: str):
    """Delete a skill permanently by ID."""
    import skills
    skills.delete_skill(skill_id)
    return {"deleted": True}


async def get_current_metrics():
    """Get real metrics from SQLite database."""
    from memory.storage import db
    from datetime import datetime, timedelta

    now = datetime.now()
    today_str = now.date().isoformat()
    yesterday_str = (now - timedelta(days=1)).date().isoformat()

    today_stats = db.get_stats_for_date(today_str)
    yesterday_stats = db.get_stats_for_date(yesterday_str)

    # Calculations
    tasks_today = today_stats["completed"]
    tasks_yesterday = yesterday_stats["completed"]
    
    time_saved = round(tasks_today * 8 / 60, 2)
    time_saved_yesterday = round(tasks_yesterday * 8 / 60, 2)
    
    actions_today = today_stats["actions"]
    actions_yesterday = yesterday_stats["actions"]
    
    # Success Rate (today's performance)
    success_rate = 100
    if today_stats["total"] > 0:
        success_rate = round((tasks_today / today_stats["total"]) * 100)
        
    success_rate_yesterday = 100
    if yesterday_stats["total"] > 0:
        success_rate_yesterday = round((tasks_yesterday / yesterday_stats["total"]) * 100)

    return {
        "tasksCompleted": tasks_today,
        "tasksDelta": tasks_today - tasks_yesterday,
        "timeSaved": time_saved,
        "timeDelta": round(time_saved - time_saved_yesterday, 2),
        "actionsExecuted": actions_today,
        "actionsDelta": actions_today - actions_yesterday,
        "successRate": success_rate,
        "successDelta": success_rate - success_rate_yesterday
    }


@app.get("/api/metrics")
async def get_metrics():
    """Get real metrics from SQLite database."""
    return await get_current_metrics()


@app.post("/api/voice/listen")
async def listen_for_companion_voice():
    """Capture one voice turn without blocking the FastAPI event loop."""
    from tools.voice import listen

    transcript = await asyncio.to_thread(listen, 8)
    if transcript.startswith("Listen failed:"):
        raise HTTPException(status_code=503, detail=transcript)
    return {"transcript": transcript}


@app.post("/api/voice/synthesize")
async def synthesize_companion_voice(data: dict):
    """Generate a neural companion voice, leaving the renderer free to fall back locally."""
    from agent.voice_synthesis import synthesize_voice

    text = str(data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    try:
        wav = await asyncio.wait_for(asyncio.to_thread(synthesize_voice, text), timeout=20)
    except Exception as error:
        logger.warning(f"Neural voice unavailable: {error}")
        raise HTTPException(status_code=503, detail="Neural voice unavailable") from error
    return Response(content=wav, media_type="audio/wav")


@app.post("/api/prompt/enhance")
async def enhance_prompt(data: dict):
    """
    Rewrite the user's command so the agent has more to work with.

    Returns the original text unchanged rather than inventing something when no
    provider is configured — the caller replaces the user's input with whatever
    comes back, so a canned answer would silently discard what they typed.
    """
    from agent.providers import get_provider

    text = str(data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    provider = get_provider("auto")
    if provider is None:
        raise HTTPException(status_code=503, detail="No AI provider is configured")

    instruction = (
        "Rewrite the following instruction for a computer assistant so it is "
        "specific and unambiguous. Keep the user's original intent and any names, "
        "paths or details exactly as given. Do not invent new requirements, do not "
        "add commentary, and do not answer the request. Reply with the rewritten "
        "instruction only.\n\n"
        f"Instruction: {text}"
    )

    try:
        improved = await asyncio.wait_for(provider.generate_text(instruction), timeout=20)
    except Exception as error:
        logger.warning(f"Prompt enhance failed: {error}")
        raise HTTPException(status_code=503, detail="Could not improve that just now") from error

    improved = str(improved or "").strip().strip('"')
    if not improved:
        raise HTTPException(status_code=503, detail="Could not improve that just now")

    return {"text": improved}


# ─── WEBSOCKET ───


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication."""
    # Reject before accept() so an unauthorized client never reaches the
    # message loop that can issue commands.
    if not verify_ws_token(websocket):
        logger.warning("Rejected WebSocket connection with missing or invalid token")
        await websocket.close(code=4401)
        return

    client_id = str(uuid.uuid4())[:8]
    await ws_manager.connect(websocket, client_id)

    await ws_manager.send_terminal_line("WebSocket connected to TORCH backend", "success", client_id)
    active_provider = None
    if settings.gemini_api_key:
        active_provider = "Gemini"
    elif settings.openai_api_key:
        active_provider = "OpenAI"
    elif settings.anthropic_api_key:
        active_provider = "Anthropic"

    provider_msg = f"Provider: {active_provider}" if active_provider else "No AI provider configured"
    await ws_manager.send_terminal_line(provider_msg, "info", client_id)
    await ws_manager.send_terminal_line("Ready — awaiting commands", "success", client_id)
    
    # Send initial metrics on connect
    try:
        metrics_data = await get_current_metrics()
        await ws_manager.send_metrics(metrics_data, client_id)
    except Exception as e:
        logger.warning(f"Failed to send initial metrics on connect: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_ws_message(message, client_id)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # A command is processed in a background task, so closing its owning
        # socket does not cancel it automatically. Signal the executor before
        # removing the connection: this covers active execution/vision/HITL as
        # well as commands that are still waiting for the planner to return.
        executor.stop_task(client_id)
        await ws_manager.disconnect(client_id)


async def handle_ws_message(message: dict, client_id: str) -> None:
    """Route incoming WebSocket messages."""
    msg_type = message.get("type")

    if msg_type == "command":
        content = message.get("content", "")
        model = message.get("model", "auto")
        request_id = message.get("requestId")
        if not isinstance(request_id, str) or not request_id or len(request_id) > 128:
            request_id = None
        logger.info(f"Command received: {content[:80]}")
        planning_id = str(uuid.uuid4())
        executor.begin_planning(client_id, planning_id, "command")
        asyncio.create_task(
            process_command(
                content,
                client_id,
                model=model,
                planning_id=planning_id,
                request_id=request_id,
            )
        )

    elif msg_type == "hitl_response":
        message_id = message.get("messageId")
        step_id = message.get("stepId")
        action = message.get("action", "cancel")
        edited = message.get("editedData")
        logger.info(f"HITL response: {step_id} → {action}")
        accepted = bool(step_id) and executor.submit_approval(
            step_id, action, edited if isinstance(edited, dict) else None
        )
        await ws_manager.send_message({
            "type": "approval_result",
            "messageId": message_id,
            "stepId": step_id,
            "accepted": accepted,
            "error": None if accepted else "Approval request is invalid or has expired",
        }, client_id)

    elif msg_type == "clarification_response":
        task_id = str(message.get("taskId") or "")
        response = str(message.get("response") or "")
        from tools.vision_control import submit_vision_clarification

        accepted = submit_vision_clarification(client_id, task_id, response)
        logger.info("Clarification response for %s accepted=%s", task_id, accepted)
        await ws_manager.send_message({
            "type": "clarification_result",
            "taskId": task_id,
            "accepted": accepted,
            "error": None if accepted else "That question is no longer active",
        }, client_id)

    elif msg_type == "stop_task":
        logger.info("Stop task received")
        cancelled_channels = executor.stop_task(client_id) or set()
        # A planner call runs in a worker thread and cannot be force-killed, but
        # the UI should stop waiting immediately. Its eventual result is
        # discarded by the scoped check in the command pipeline below.
        await ws_manager.send_status("idle", client_id)
        if "overlay" in cancelled_channels:
            await ws_manager.send_overlay_event(
                status="idle",
                reply="Stopped.",
                client_id=client_id,
            )

    elif msg_type == "undo_task":
        message_id = message.get("messageId")
        logger.info(f"Undo task received for message {message_id}")
        res = rollback_manager.rollback(message_id)
        await ws_manager.send_message({
            "type": "undo_result",
            "messageId": message_id,
            "status": res["status"],
            "reversed": res["reversed"],
            "failed": res["failed"]
        }, client_id)

    elif msg_type == "overlay_command":
        content = message.get("content", "")
        logger.info(f"Overlay command: {content[:80]}")
        planning_id = str(uuid.uuid4())
        executor.begin_planning(client_id, planning_id, "overlay")
        asyncio.create_task(
            process_overlay_command(content, client_id, planning_id=planning_id)
        )

    elif msg_type == "companion_command":
        content = message.get("content", "")
        screenshots = message.get("screenshots", [])
        audio = message.get("audio")
        logger.info(f"Visual companion command: {content[:80]} ({len(screenshots)} screens)")
        asyncio.create_task(process_companion_command(content, screenshots, client_id, audio))

    elif msg_type == "ping":
        # Latency probe. Echo the client's timestamp back so it can measure the
        # round trip; the frontend sends one of these every 10 seconds.
        await ws_manager.send_message(
            {"type": "pong", "ts": message.get("ts")}, client_id
        )

    else:
        logger.warning(f"Unknown message type: {msg_type}")


async def _discard_cancelled_plan(
    client_id: str,
    planning_id: str,
    channel: str,
    request_id: str | None = None,
) -> bool:
    """Discard a late planner result after Stop without resurfacing task state."""
    if not executor.consume_pending_cancellation(client_id, planning_id):
        return False

    await ws_manager.send_status("idle", client_id)
    if channel == "command":
        await _send_task_outcome(
            client_id,
            request_id,
            "cancelled",
            "The task was stopped before it finished.",
        )
    if channel == "overlay":
        await ws_manager.send_overlay_event(
            status="idle",
            reply="Stopped.",
            client_id=client_id,
        )
    return True


async def _send_task_outcome(
    client_id: str,
    request_id: str | None,
    status: str,
    summary: str,
) -> None:
    """Send one correlated terminal result for clients that gate on completion."""
    if not request_id:
        return
    await ws_manager.send_message(
        {
            "type": "task_outcome",
            "requestId": request_id,
            "status": status,
            "summary": summary,
        },
        client_id,
    )


async def process_command(
    command: str,
    client_id: str,
    model: str = "auto",
    planning_id: str | None = None,
    request_id: str | None = None,
) -> None:
    """Process a user command through the full agent pipeline."""
    planning_id = planning_id or str(uuid.uuid4())
    executor.begin_planning(client_id, planning_id, "command")
    try:
        # The WebSocket handler registers the planning id before scheduling
        # this coroutine, so an immediately-following Stop can arrive first.
        if await _discard_cancelled_plan(
            client_id, planning_id, "command", request_id=request_id
        ):
            return

        # 1. Set status to processing
        await ws_manager.send_status("processing", client_id)
        await ws_manager.send_terminal_line(f"Processing: {command[:80]}", "info", client_id)

        # Get conversation context
        from agent.context import ConversationContext
        context = ConversationContext.get_context(client_id)

        connection_status = _connection_status_block()

        # 2. Plan with Gemini
        await ws_manager.send_terminal_line("Planning execution steps...", "info", client_id)
        raw_steps = await plan_command(
            f"{command}\n\n{connection_status}",
            context=context,
            model=model,
        )

        if await _discard_cancelled_plan(
            client_id, planning_id, "command", request_id=request_id
        ):
            return

        # Intercept respond tool for conversational replies (like greetings and clarifying questions)
        respond_steps = [s for s in raw_steps if s.get("tool") == "respond"]
        if respond_steps:
            executor.finish_planning(client_id, planning_id)
            natural_response = respond_steps[0].get("args", {}).get("message", "Hello! How can I help you today?")
            response_msg = create_response_message(natural_response, [])
            if _is_clarifying_question(natural_response):
                response_msg["needsAnswer"] = True
            await ws_manager.send_agent_response(response_msg, client_id)
            await ws_manager.send_status("idle", client_id)
            await _send_task_outcome(
                client_id, request_id, "completed", natural_response
            )
            ConversationContext.add_exchange(
                client_id=client_id,
                user_command=command,
                reply_summary=natural_response,
                step_results=[]
            )
            return

        # 3. Validate plan
        validated_steps = validate_plan(raw_steps)

        # 4. Create response message and send to frontend
        step_labels = [s["label"] for s in validated_steps]
        if len(step_labels) == 0:
            executor.finish_planning(client_id, planning_id)
            natural_response = "I am not sure how to help with that. Try rephrasing."
            response_msg = create_response_message(natural_response, [])
            await ws_manager.send_agent_response(response_msg, client_id)
            await ws_manager.send_status("idle", client_id)
            await _send_task_outcome(
                client_id,
                request_id,
                "failed",
                "I couldn't turn that request into a task. Try rephrasing it.",
            )
            ConversationContext.add_exchange(
                client_id=client_id,
                user_command=command,
                reply_summary=natural_response,
                step_results=[]
            )
            return
        
        natural_response = "Got it. Here is my plan:" if len(step_labels) > 1 else f"On it. {step_labels[0]}."
        
        response_msg = create_response_message(natural_response, validated_steps)
        await ws_manager.send_agent_response(response_msg, client_id)
        await ws_manager.send_terminal_line(
            f"Plan: {len(validated_steps)} steps", "info", client_id
        )

        # 5. Execute plan
        message_id = response_msg["id"]
        if await _discard_cancelled_plan(
            client_id, planning_id, "command", request_id=request_id
        ):
            return
        executor.finish_planning(client_id, planning_id)
        executed_steps = await executor.execute_plan(
            message_id,
            validated_steps,
            client_id,
            channel="command",
        )

        if executor.is_cancelled(client_id, message_id):
            completed_count = sum(1 for s in executed_steps if s["status"] == "done")
            cancelled_count = len(executed_steps) - completed_count
            recap_sentence = f"I've stopped the task. Completed {completed_count} step(s) and cancelled the remaining {cancelled_count} step(s)."
            await ws_manager.send_status("idle", client_id)
            recap_msg = {
                "id": str(uuid.uuid4()),
                "role": "torch",
                "content": recap_sentence,
                "timestamp": __import__("time").time() * 1000,
                "steps": executed_steps,
            }
            await ws_manager.send_agent_response(recap_msg, client_id)
            await _send_task_outcome(
                client_id, request_id, "cancelled", recap_sentence
            )
            return

        # Check if execution failed
        failed_steps = [s for s in executed_steps if s["status"] == "failed"]
        if failed_steps:
            # Say what went wrong in the chat. Without this the task simply
            # stops and the only trace is the inline step card, which reads as
            # the agent having ignored the request.
            # Step errors are already plain language: the executor runs them
            # through translate_error() before reporting a step as failed.
            first_error = (failed_steps[0].get("error") or "").strip()
            if first_error:
                recap_sentence = f"I couldn't finish that. {first_error}"
            else:
                failed_labels = [s.get("label") or s.get("tool", "step") for s in failed_steps[:3]]
                recap_sentence = (
                    f"I couldn't finish everything. Problem with: {', '.join(failed_labels)}."
                )

            # Save exchange to context
            ConversationContext.add_exchange(
                client_id=client_id,
                user_command=command,
                reply_summary=recap_sentence,
                step_results=executed_steps
            )
            # Log failure in database for accurate metrics
            try:
                from memory.storage import db
                db.save_task(command, validated_steps, "failed")
                metrics_data = await get_current_metrics()
                await ws_manager.send_metrics(metrics_data, client_id)
            except Exception as db_err:
                logger.warning(f"Failed to log task failure: {db_err}")

            await ws_manager.send_agent_response({
                "id": str(uuid.uuid4()),
                "role": "torch",
                "content": recap_sentence,
                "timestamp": __import__("time").time() * 1000,
                "steps": [],
            }, client_id)
            await ws_manager.send_status("idle", client_id)
            await _send_task_outcome(
                client_id, request_id, "failed", recap_sentence
            )
            return

        # Save exchange to context
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command=command,
            reply_summary=natural_response,
            step_results=executed_steps
        )

        # 6. Send completion
        await ws_manager.send_terminal_line("Task completed", "success", client_id)

        # Failures returned above, so everything from here on succeeded.
        completed_steps = [s for s in executed_steps if s["status"] == "done"]
        recap_emails = None
        last_result = ""

        if completed_steps:
            tools_used = {s["tool"] for s in completed_steps}
            last_result = (completed_steps[-1].get("result") or "").strip()
            if "send_email" in tools_used:
                recap_sentence = "Your email was sent."
            elif "read_inbox" in tools_used:
                recap_sentence = "Here's what I found in your inbox."
                recap_emails = _structured_inbox_from_steps(completed_steps)
            elif "move_file" in tools_used:
                recap_sentence = last_result if last_result else "Your file was moved."
            elif "create_folder" in tools_used:
                recap_sentence = last_result if last_result else "Your folder is ready."
            elif "open_app" in tools_used:
                recap_sentence = last_result if last_result else "The app was opened."
            elif "analyse_screen" in tools_used or "screenshot" in tools_used:
                recap_sentence = "Here's what I saw on your screen."
            elif "find_file" in tools_used or "find_file_fuzzy" in tools_used:
                if "read_pdf" in tools_used or "read_word" in tools_used or "read_excel" in tools_used:
                    recap_sentence = "I found your document and pulled out the key details."
                else:
                    recap_sentence = last_result if last_result else "I found the file."
            elif "search_web" in tools_used:
                recap_sentence = "Web search finished."
            elif "run_terminal" in tools_used:
                recap_sentence = last_result if last_result and last_result != "Command executed successfully (no output)" else "The command ran."
            else:
                recap_sentence = None
        else:
            recap_sentence = None

        if recap_sentence:
            recap_msg = {
                "id": str(uuid.uuid4()),
                "role": "torch",
                "content": recap_sentence,
                "timestamp": __import__("time").time() * 1000,
                "steps": [],
            }
            if recap_emails is not None:
                recap_msg["emails"] = recap_emails
            await ws_manager.send_agent_response(recap_msg, client_id)

        # Notify if task is reversible
        if rollback_manager.has_reversible_actions(message_id):
            await ws_manager.send_message({
                "type": "task_completed_metadata",
                "messageId": message_id,
                "reversible": True
            }, client_id)

        # Update metrics after task completion
        try:
            from memory.storage import db
            db.save_task(command, validated_steps, "completed")
            db.log_command(command)
            metrics_data = await get_current_metrics()
            await ws_manager.send_metrics(metrics_data, client_id)
        except Exception as e:
            logger.warning(f"Metrics update failed: {e}")

        await _send_task_outcome(
            client_id,
            request_id,
            "completed",
            recap_sentence or last_result or "The task completed.",
        )

    except Exception as e:
        if await _discard_cancelled_plan(
            client_id, planning_id, "command", request_id=request_id
        ):
            return
        logger.error(f"Command processing failed: {e}", exc_info=True)
        # An exception must not leave the screen-control border covering the
        # user's display for the rest of the session.
        await executor.clear_screen_control(client_id)
        
        # Record failure in database for accurate success rate metrics
        try:
            from memory.storage import db
            db.save_task(command, [], "failed")
            metrics_data = await get_current_metrics()
            await ws_manager.send_metrics(metrics_data, client_id)
        except Exception as db_err:
            logger.warning(f"Failed to log task failure: {db_err}")

        await ws_manager.send_status("idle", client_id)
        
        translated = translate_error(str(e))
        plain_err = f"{translated['what_happened']} {translated['what_to_do']}"
        await ws_manager.send_terminal_line(f"Error: {plain_err}", "error", client_id)

        # Send error message
        error_msg = {
            "id": str(uuid.uuid4()),
            "role": "torch",
            "content": f"Sorry, {translated['what_happened'].lower()} {translated['what_to_do']}",
            "timestamp": __import__("time").time() * 1000,
            "steps": [],
        }
        await ws_manager.send_agent_response(error_msg, client_id)
        await _send_task_outcome(
            client_id, request_id, "failed", error_msg["content"]
        )
    finally:
        executor.finish_planning(client_id, planning_id)


async def process_overlay_command(
    command: str,
    client_id: str,
    planning_id: str | None = None,
) -> None:
    """Process a voice command from the Hey TORCH overlay."""
    planning_id = planning_id or str(uuid.uuid4())
    executor.begin_planning(client_id, planning_id, "overlay")
    try:
        if await _discard_cancelled_plan(client_id, planning_id, "overlay"):
            return

        await ws_manager.send_overlay_event(status="processing", client_id=client_id)

        # Get conversation context
        from agent.context import ConversationContext
        context = ConversationContext.get_context(client_id)

        # Plan and get simple response
        raw_steps = await plan_command(command, context=context)

        if await _discard_cancelled_plan(client_id, planning_id, "overlay"):
            return

        # Intercept respond tool for conversational replies (like greetings)
        respond_steps = [s for s in raw_steps if s.get("tool") == "respond"]
        if respond_steps:
            reply = respond_steps[0].get("args", {}).get("message", "Hello! How can I help you today?")
            validated_steps = []
        else:
            validated_steps = validate_plan(raw_steps)
            # For overlay, provide a brief response
            if validated_steps:
                labels = [s["label"] for s in validated_steps]
                reply = f"I'll {labels[0].lower()}"
                if len(labels) > 1:
                    reply += f" and then {labels[1].lower()}"
                reply += ". Working on it now."
            else:
                reply = "I'm not sure how to help with that. Try asking differently."

        await ws_manager.send_overlay_event(status="speaking", reply=reply, client_id=client_id)

        # Execute in background
        response_msg = create_response_message(reply, validated_steps)
        await ws_manager.send_agent_response(response_msg, client_id)
        message_id = response_msg["id"]
        if await _discard_cancelled_plan(client_id, planning_id, "overlay"):
            return
        executor.finish_planning(client_id, planning_id)
        executed_steps = await executor.execute_plan(
            message_id,
            validated_steps,
            client_id,
            channel="overlay",
        )

        # Save exchange to context
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command=command,
            reply_summary=reply,
            step_results=executed_steps
        )

    except Exception as e:
        if await _discard_cancelled_plan(client_id, planning_id, "overlay"):
            return
        translated = translate_error(str(e))
        reply_err = f"Sorry, {translated['what_happened'].lower()} {translated['what_to_do']}"
        await ws_manager.send_overlay_event(
            status="speaking",
            reply=reply_err[:100],
            client_id=client_id,
        )
    finally:
        executor.finish_planning(client_id, planning_id)


async def process_companion_command(
    command: str,
    screenshots: list[dict],
    client_id: str,
    audio: dict | None = None,
) -> None:
    """Answer a contextual question and optionally point to a visible desktop element."""
    try:
        await ws_manager.send_overlay_event(status="processing", client_id=client_id)
        from agent.companion import answer_with_screen
        from agent.context import ConversationContext

        context = ConversationContext.get_context(client_id)
        result = await answer_with_screen(command, screenshots, context, audio)
        reply = result["speech"]
        await ws_manager.send_overlay_event(
            status="speaking",
            reply=reply,
            guidance=result.get("guidance"),
            client_id=client_id,
        )
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command=command,
            reply_summary=reply,
            step_results=[],
        )
    except Exception as error:
        logger.error(f"Visual companion failed: {error}", exc_info=True)
        error_text = str(error).lower()
        if "gemini api 401" in error_text or "gemini api 403" in error_text:
            reply = "Gemini rejected the API key. Replace it in Settings, then try again."
        elif "gemini api 429" in error_text:
            reply = "Gemini is rate-limiting this key right now. Wait briefly and try again."
        elif "timeout" in error_text or "timed out" in error_text:
            reply = "Gemini took too long to respond. I stopped the request so TORCH stays responsive."
        elif "connection" in error_text or "resolve" in error_text:
            reply = "I could not reach Gemini. Check this laptop's internet connection and try again."
        else:
            reply = "I read the screen but could not finish the visual answer. Please try that once more."
        await ws_manager.send_overlay_event(
            status="speaking",
            reply=reply,
            guidance={"type": "none"},
            client_id=client_id,
        )


# ─── ENTRY POINT ───

if __name__ == "__main__":
    import uvicorn
    import socket

    def find_available_port(start_port: int, host: str = "127.0.0.1", max_attempts: int = 10) -> int:
        for p in range(start_port, start_port + max_attempts):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind((host, p))
                    return p
            except OSError:
                continue
        return start_port

    target_port = find_available_port(settings.port, settings.host)
    frozen = getattr(sys, "frozen", False)
    reload_enabled = (
        not frozen and os.getenv("TORCH_RELOAD", "true").lower() in {"1", "true", "yes"}
    )

    logger.info(f"Starting server process on port {target_port}")
    # A packaged build has no main.py on disk, so "main:app" cannot be imported
    # by name. Hand uvicorn the application object instead. Reload needs the
    # import string, so it is only available when running from source.
    uvicorn.run(
        app if frozen else "main:app",
        host=settings.host,
        port=target_port,
        reload=reload_enabled,
        log_level="info",
    )
