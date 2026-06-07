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
    return {
        "status": "running",
        "version": "1.0.0",
        "gemini_configured": bool(settings.gemini_api_key),
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


@app.get("/api/settings")
async def get_settings():
    """Get current settings (sanitized — no secrets)."""
    active_provider = None
    if settings.gemini_api_key:
        active_provider = "gemini"
    elif settings.openai_api_key:
        active_provider = "openai"
    elif settings.anthropic_api_key:
        active_provider = "anthropic"

    return {
        "gemini_model": settings.gemini_model,
        "gemini_configured": bool(settings.gemini_api_key),
        "openai_configured": bool(settings.openai_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
        "active_provider": active_provider,
        "gmail_configured": bool(settings.gmail_address),
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
    
    # Update in memory
    for key, value in data.items():
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
    
    for key, value in data.items():
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


@app.get("/api/metrics")
async def get_metrics():
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
        logger.info(f"Command received: {content[:80]}")
        asyncio.create_task(process_command(content, client_id))

    elif msg_type == "hitl_response":
        step_id = message.get("stepId")
        action = message.get("action", "cancel")
        logger.info(f"HITL response: {step_id} → {action}")
        executor.submit_approval(step_id, action)

    elif msg_type == "overlay_command":
        content = message.get("content", "")
        logger.info(f"Overlay command: {content[:80]}")
        asyncio.create_task(process_overlay_command(content, client_id))

    else:
        logger.warning(f"Unknown message type: {msg_type}")


async def process_command(command: str, client_id: str) -> None:
    """Process a user command through the full agent pipeline."""
    try:
        # 1. Set status to processing
        await ws_manager.send_status("processing", client_id)
        await ws_manager.send_terminal_line(f"Processing: {command[:80]}", "info", client_id)

        # Get conversation context
        from agent.context import ConversationContext
        context = ConversationContext.get_context(client_id)

        # 2. Plan with Gemini
        await ws_manager.send_terminal_line("Planning execution steps via Gemini...", "info", client_id)
        raw_steps = await plan_command(command, context=context)

        # 3. Validate plan
        validated_steps = validate_plan(raw_steps)

        # 4. Create response message and send to frontend
        step_labels = [s["label"] for s in validated_steps[:2]]
        if len(step_labels) == 1:
            natural_response = f"On it. {step_labels[0]}."
        elif len(step_labels) >= 2:
            natural_response = f"Got it. Here's my plan:"
        else:
            natural_response = "Working on it."

        response_msg = create_response_message(natural_response, validated_steps)
        await ws_manager.send_agent_response(response_msg, client_id)
        await ws_manager.send_terminal_line(
            f"Plan: {len(validated_steps)} steps", "info", client_id
        )

        # 5. Execute plan
        message_id = response_msg["id"]
        executed_steps = await executor.execute_plan(message_id, validated_steps, client_id)

        # Save exchange to context
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command=command,
            reply_summary=natural_response,
            step_results=executed_steps
        )

        # 6. Send completion
        await ws_manager.send_terminal_line("Task completed", "success", client_id)

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
            db.save_task(command, [], "failed") # Duration is 0 for failed tasks
            metrics_data = await get_current_metrics()
            await ws_manager.send_metrics(metrics_data, client_id)
        except Exception as db_err:
            logger.warning(f"Failed to log task failure: {db_err}")

        await ws_manager.send_status("idle", client_id)
        await ws_manager.send_terminal_line(f"Error: {e}", "error", client_id)

        # Send error message
        error_msg = {
            "id": str(uuid.uuid4()),
            "role": "torch",
            "content": f"I encountered an error: {str(e)[:200]}",
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
        response_msg = create_response_message(f"Executing: {command}", validated_steps)
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
        await ws_manager.send_overlay_event(
            status="speaking",
            reply=f"Sorry, something went wrong: {str(e)[:100]}",
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
