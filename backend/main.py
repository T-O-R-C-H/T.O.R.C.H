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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import settings
from websocket import manager as ws_manager
from agent.brain import plan_command
from agent.planner import validate_plan, create_response_message
from agent.executor import executor
from errors.plain_language import translate_error
from agent.rollback import rollback_manager

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

    # Check Playwright/Chromium
    try:
        from playwright.async_api import async_playwright
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                await browser.close()
            logger.info("Playwright: ready (Chromium found)")
        except Exception as e:
            logger.warning(f"Playwright: library found but browser not ready — {e}")
            logger.warning("Run: playwright install chromium")
    except ImportError:
        logger.warning("Playwright not installed — run: pip install playwright && playwright install chromium")

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


app = FastAPI(
    title="TORCH Backend",
    description="Thinking, Observing, Reasoning, Creating & Handling",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    playwright_installed = False
    try:
        from playwright.async_api import async_playwright
        playwright_installed = True
    except ImportError:
        pass
    return {
        "playwright_installed": playwright_installed
    }


@app.get("/api/models")
async def list_models():
    """Available AI models for the command input picker."""
    return {
        "models": [
            {"id": "auto", "label": "Auto"},
            {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
            {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
            {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
        ],
        "current": settings.gemini_model,
    }


@app.post("/api/email/test")
async def test_email_connection():
    """Verify Gmail credentials by signing into IMAP."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=400, detail="Add your Gmail address and App Password in Settings first.")
    try:
        import imaplib
        mail = imaplib.IMAP4_SSL(settings.gmail_imap_host)
        mail.login(settings.gmail_address, settings.gmail_app_password)
        mail.logout()
        return {"ok": True, "address": settings.gmail_address, "message": "Gmail connection works."}
    except Exception as e:
        logger.error(f"Gmail test failed: {e}")
        raise HTTPException(status_code=400, detail=f"Gmail sign-in failed: {e}")


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
        "active_provider": active_provider,
        "gmail_configured": bool(settings.gmail_address and settings.gmail_app_password),
        "gmail_password_set": bool(settings.gmail_app_password),
        "gmail_address": settings.gmail_address,
        "wake_word": settings.wake_word,
        "wake_word_sensitivity": settings.wake_word_sensitivity,
        "whisper_model_size": settings.whisper_model_size,
        "screen_watch_enabled": settings.screen_watch_enabled,
        "screen_watch_interval": settings.screen_watch_interval,
    }


@app.post("/api/settings")
async def update_settings(data: dict):
    """Update settings and persist to .env in the root directory."""
    import os
    # .env should be in the root (parent of backend)
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    # Update in memory and .env — never wipe secrets with empty strings
    secret_fields = {
        "gemini_api_key",
        "openai_api_key",
        "anthropic_api_key",
        "gmail_app_password",
    }
    filtered = {}
    for key, value in data.items():
        if key in secret_fields and (value is None or str(value).strip() == ""):
            continue
        filtered[key] = value
        if hasattr(settings, key):
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
                    
    # Map pydantic field names to env vars
    mapping = {
        "gemini_api_key": "GEMINI_API_KEY",
        "gemini_model": "GEMINI_MODEL",
        "openai_api_key": "OPENAI_API_KEY",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
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
    }
    
    for key, value in filtered.items():
        if key in mapping:
            env_vars[mapping[key]] = str(value)
            
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


@app.get("/api/skills")
async def api_get_skills():
    """Get all saved skills."""
    import skills
    return skills.get_skills()


@app.post("/api/skills")
async def api_create_skill(data: dict):
    """Create a new skill."""
    name = data.get("name")
    command = data.get("command")

    if not name or not str(name).strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if not command or not str(command).strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty")

    import skills
    skill_id = skills.save_skill(name, command)
    new_skill = skills.get_skill(skill_id)
    return new_skill


@app.post("/api/skills/{skill_id}/run")
async def api_run_skill(skill_id: str):
    """Run a skill (increment run_count and return the command)."""
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
    """Delete a skill permanently."""
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


# ─── WEBSOCKET ───


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication."""
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
        await ws_manager.disconnect(client_id)
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await ws_manager.disconnect(client_id)


async def handle_ws_message(message: dict, client_id: str) -> None:
    """Route incoming WebSocket messages."""
    msg_type = message.get("type")

    if msg_type == "command":
        content = message.get("content", "")
        model = message.get("model", "auto")
        logger.info(f"Command received: {content[:80]}")
        asyncio.create_task(process_command(content, client_id, model=model))

    elif msg_type == "hitl_response":
        step_id = message.get("stepId")
        action = message.get("action", "cancel")
        logger.info(f"HITL response: {step_id} → {action}")
        executor.submit_approval(step_id, action)

    elif msg_type == "stop_task":
        logger.info("Stop task received")
        executor.stop_task()

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
        asyncio.create_task(process_overlay_command(content, client_id))

    else:
        logger.warning(f"Unknown message type: {msg_type}")


async def process_command(command: str, client_id: str, model: str = "auto") -> None:
    """Process a user command through the full agent pipeline."""
    try:
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

        # Intercept respond tool for conversational replies (like greetings and clarifying questions)
        respond_steps = [s for s in raw_steps if s.get("tool") == "respond"]
        if respond_steps:
            natural_response = respond_steps[0].get("args", {}).get("message", "Hello! How can I help you today?")
            response_msg = create_response_message(natural_response, [])
            await ws_manager.send_agent_response(response_msg, client_id)
            await ws_manager.send_status("idle", client_id)
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
            natural_response = "I am not sure how to help with that. Try rephrasing."
            response_msg = create_response_message(natural_response, [])
            await ws_manager.send_agent_response(response_msg, client_id)
            await ws_manager.send_status("idle", client_id)
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
        executed_steps = await executor.execute_plan(message_id, validated_steps, client_id)

        if executor._is_cancelled:
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
            return

        # Check if execution failed
        failed_steps = [s for s in executed_steps if s["status"] == "failed"]
        if failed_steps:
            # Save exchange to context
            ConversationContext.add_exchange(
                client_id=client_id,
                user_command=command,
                reply_summary="Task execution failed.",
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
            await ws_manager.send_status("idle", client_id)
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

        failed_steps = [s for s in executed_steps if s["status"] == "failed"]
        completed_steps = [s for s in executed_steps if s["status"] == "done"]

        if failed_steps:
            failed_labels = [s.get("label") or s.get("tool", "step") for s in failed_steps[:3]]
            recap_sentence = (
                f"I couldn't finish everything. Problem with: {', '.join(failed_labels)}."
            )
        elif completed_steps:
            tools_used = {s["tool"] for s in completed_steps}
            last_result = (completed_steps[-1].get("result") or "").strip()
            if "send_email" in tools_used:
                recap_sentence = "Your email was sent."
            elif "read_inbox" in tools_used:
                recap_sentence = "I checked your inbox."
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

    except Exception as e:
        logger.error(f"Command processing failed: {e}", exc_info=True)
        
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


async def process_overlay_command(command: str, client_id: str) -> None:
    """Process a voice command from the Hey TORCH overlay."""
    try:
        await ws_manager.send_overlay_event(status="processing", client_id=client_id)

        # Get conversation context
        from agent.context import ConversationContext
        context = ConversationContext.get_context(client_id)

        # Plan and get simple response
        raw_steps = await plan_command(command, context=context)

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
        executed_steps = await executor.execute_plan(message_id, validated_steps, client_id)

        # Save exchange to context
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command=command,
            reply_summary=reply,
            step_results=executed_steps
        )

    except Exception as e:
        translated = translate_error(str(e))
        reply_err = f"Sorry, {translated['what_happened'].lower()} {translated['what_to_do']}"
        await ws_manager.send_overlay_event(
            status="speaking",
            reply=reply_err[:100],
            client_id=client_id,
        )


# ─── ENTRY POINT ───

if __name__ == "__main__":
    import uvicorn

    reload_enabled = os.getenv("TORCH_RELOAD", "true").lower() in {"1", "true", "yes"}

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=reload_enabled,
        log_level="info",
    )
