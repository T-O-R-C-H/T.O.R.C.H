"""
TORCH Agent Brain — Gemini 2.5 Flash Integration
Converts user commands into structured execution plans.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from config.settings import settings

logger = logging.getLogger("torch.brain")

# Tool definitions for Gemini
AVAILABLE_TOOLS = [
    {"name": "find_file", "description": "Search for a file by name on the filesystem", "params": ["name", "path"]},
    {"name": "read_pdf", "description": "Extract text content from a PDF file", "params": ["filepath"]},
    {"name": "read_word", "description": "Extract text content from a Word document", "params": ["filepath"]},
    {"name": "read_excel", "description": "Extract data from an Excel spreadsheet", "params": ["filepath"]},
    {"name": "send_email", "description": "Send an email via Gmail SMTP", "params": ["to", "subject", "body", "attachment"], "hitl": True},
    {"name": "read_inbox", "description": "Read recent emails from Gmail inbox", "params": ["count"]},
    {"name": "open_browser", "description": "Open a URL in a browser", "params": ["url"]},
    {"name": "click", "description": "Click at a screen position", "params": ["x", "y"]},
    {"name": "type_text", "description": "Type text using keyboard", "params": ["text"]},
    {"name": "screenshot", "description": "Take a screenshot of the screen", "params": []},
    {"name": "analyse_screen", "description": "Analyze the current screen content using AI vision", "params": []},
    {"name": "search_web", "description": "Search the web and return results", "params": ["query"]},
    {"name": "download_file", "description": "Download a file from a URL", "params": ["url", "path"]},
    {"name": "open_app", "description": "Open an application by name", "params": ["name"]},
    {"name": "post_social", "description": "Post content to a social media platform", "params": ["platform", "message", "image"], "hitl": True},
    {"name": "send_message", "description": "Send a message on a messaging platform", "params": ["platform", "contact", "message"], "hitl": True},
    {"name": "run_terminal", "description": "Run a terminal/command-line command", "params": ["command"]},
    {"name": "move_file", "description": "Move a file from one location to another", "params": ["src", "dst"]},
    {"name": "delete_file", "description": "Delete a file (irreversible)", "params": ["filepath"], "hitl": True},
    {"name": "create_folder", "description": "Create a new directory", "params": ["path"]},
    {"name": "zip_files", "description": "Compress files into a zip archive", "params": ["files", "output"]},
]

SYSTEM_PROMPT = """You are TORCH, a powerful AI agent that controls the user's computer.
You can search files, send emails, browse the web, control the mouse and keyboard,
take screenshots, analyze screen content, post on social media, and execute system commands.

The user is currently running on a **Windows Operating System**. 
When using the 'run_terminal' tool, you MUST use Windows CMD or PowerShell commands (e.g., use 'dir' instead of 'ls').

When the user gives you a command, break it down into a sequence of tool calls.

Available tools:
{tools}

CRITICAL RULES:
1. Always return a valid JSON array of steps.
2. Each step must have: "tool" (tool name), "label" (human-readable description), "args" (dict of arguments).
3. Steps are executed sequentially. Each step can reference results from previous steps.
4. For irreversible actions (send_email, post_social, send_message, delete_file), set "requires_approval": true.
5. Be specific in your labels — the user sees these in real-time.
6. Use the minimum number of steps needed.
7. If you need to find information before acting, add a search/read step first.

Respond ONLY with a JSON array. No markdown, no explanation, just the JSON.

Example response:
[
  {{"tool": "find_file", "label": "Searching for Sales.pdf in Documents", "args": {{"name": "Sales.pdf", "path": "~/Documents"}}, "requires_approval": false}},
  {{"tool": "read_pdf", "label": "Extracting text from Sales.pdf", "args": {{"filepath": "{{{{step_0_result}}}}"}}, "requires_approval": false}},
  {{"tool": "send_email", "label": "Sending summary to john@company.com", "args": {{"to": "john@company.com", "subject": "Sales Report Summary", "body": "{{{{step_1_result}}}}"}}, "requires_approval": true}}
]
"""


async def plan_command(user_command: str, context: Optional[List[Dict]] = None) -> List[Dict[str, Any]]:
    """
    Send user command to Gemini and receive a structured execution plan.

    Args:
        user_command: The user's natural language command
        context: Optional list of previous messages for context

    Returns:
        List of step dictionaries with tool, label, args, requires_approval
    """
    try:
        from google import genai

        if not settings.gemini_api_key:
            return [{
                "tool": "error",
                "label": "No Gemini API key configured",
                "args": {},
                "requires_approval": False,
                "error": "Please add your Gemini API key in Settings"
            }]

        client = genai.Client(api_key=settings.gemini_api_key)

        # Build tools description
        tools_desc = "\n".join(
            f"- {t['name']}({', '.join(t['params'])}): {t['description']}"
            + (" [REQUIRES APPROVAL]" if t.get('hitl') else "")
            for t in AVAILABLE_TOOLS
        )

        system = SYSTEM_PROMPT.format(tools=tools_desc)

        # Build message contents
        contents = system + "\n\nUser command: " + user_command
        if context:
            ctx_text = "\n".join(
                f"{'User' if m.get('role') == 'user' else 'TORCH'}: {m.get('content', '')}"
                for m in context[-10:]
            )
            contents = system + "\n\nConversation context:\n" + ctx_text + "\n\nUser command: " + user_command

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config={
                "temperature": 0.1,
                "max_output_tokens": 4096,
            },
        )

        # Parse response
        text = response.text.strip()
        # Remove markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

        steps = json.loads(text)

        if not isinstance(steps, list):
            steps = [steps]

        # Validate and normalize steps
        validated = []
        for i, step in enumerate(steps):
            validated.append({
                "tool": step.get("tool", "unknown"),
                "label": step.get("label", f"Step {i + 1}"),
                "args": step.get("args", {}),
                "requires_approval": step.get("requires_approval", False),
            })

        logger.info(f"Planned {len(validated)} steps for: {user_command[:80]}")
        return validated

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        return [{
            "tool": "error",
            "label": "Failed to parse AI response",
            "args": {},
            "requires_approval": False,
            "error": str(e),
        }]
    except Exception as e:
        logger.error(f"Brain error: {e}")
        return [{
            "tool": "error",
            "label": f"AI planning failed: {str(e)[:100]}",
            "args": {},
            "requires_approval": False,
            "error": str(e),
        }]
