import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from google import genai
from config.settings import settings
from agent.providers.base import LLMProvider

logger = logging.getLogger("torch.providers.gemini")

# Tool definitions for Gemini
AVAILABLE_TOOLS = [
    {"name": "respond", "description": "Reply conversationally to the user (greetings, questions, chitchat, explanations — NO tool execution needed)", "params": ["message"]},
    {"name": "find_file", "description": "Search for a file by name on the filesystem", "params": ["name", "path"]},
    {"name": "find_file_fuzzy", "description": "Search for a file with fuzzy matching when exact name is unknown", "params": ["name", "path"]},
    {"name": "list_directory", "description": "List all files and folders in a directory", "params": ["path"]},
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
    {"name": "download_file", "description": "Download a file from a URL", "params": ["url", "path"], "hitl": True},
    {"name": "open_app", "description": "Open an application by name", "params": ["name"]},
    {"name": "vision_control", "description": "Visually control any application by clicking, typing, scrolling, and navigating", "params": ["task"]},
    {"name": "post_social", "description": "Post content to a social media platform", "params": ["platform", "message", "image"], "hitl": True},
    {"name": "send_message", "description": "Send a message on a messaging platform", "params": ["platform", "contact", "message"], "hitl": True},
    {"name": "run_terminal", "description": "Run a terminal/command-line command", "params": ["command"]},
    {"name": "move_file", "description": "Move a file from one location to another", "params": ["src", "dst"]},
    {"name": "delete_file", "description": "Delete a file (irreversible)", "params": ["filepath"], "hitl": True},
    {"name": "create_folder", "description": "Create a new directory", "params": ["path"]},
    {"name": "zip_files", "description": "Compress files into a zip archive", "params": ["files", "output"]},
]

# Simple conversational phrases that should NEVER trigger tool calls
CONVERSATIONAL_PATTERNS = [
    r"^(hey|hi|hello|sup|yo|howdy|hiya|what'?s up|wassup|greetings)\b",
    r"^how are you",
    r"^(good morning|good afternoon|good evening|good night)",
    r"^(thanks|thank you|ty|thx|cheers)",
    r"^(ok|okay|cool|got it|got you|understood|sure|alright|sounds good)",
    r"^(bye|goodbye|see you|cya|later)",
    r"^(nice|great|awesome|perfect|wonderful|excellent|amazing|fantastic)",
    r"^what (can|could) you do",
    r"^who are you",
    r"^what are you",
    r"^help$",
]

SYSTEM_PROMPT = """You are TORCH, a powerful AI agent that controls the user's computer.
You can search files, send emails, browse the web, control the mouse and keyboard,
take screenshots, analyze screen content, post on social media, and execute system commands.

The user is currently running on a **Windows Operating System**.
When using the 'run_terminal' tool, you MUST use Windows CMD or PowerShell commands (e.g., 'dir' instead of 'ls').

Available tools:
{tools}

━━━ CRITICAL APPROVAL RULES ━━━
requires_approval: true MUST ONLY be set for these exact 6 tools:
  - send_email    (sends a real email — cannot be undone)
  - post_social   (posts publicly on social media — cannot be undone)
  - send_message  (sends a message to a real person — cannot be undone)
  - delete_file   (permanently deletes a file — cannot be undone)
  - download_file (downloads a file from internet)
  - run_terminal  (runs a system command)

ALL OTHER TOOLS must have requires_approval: false — including:
  - read_inbox, find_file, screenshot, open_app, open_browser, search_web,
    move_file, create_folder, zip_files, analyse_screen, vision_control, respond

NEVER set requires_approval: true on any tool not in the list of 6 above.

━━━ CONVERSATIONAL RESPONSES ━━━
For greetings (hey, hi, hello), small talk, "what can you do?", "who are you?",
thanks, or any message that does NOT require computer actions, use ONLY the 'respond' tool.
Always call yourself an "AI agent", never "AI assistant":
  [{{"tool": "respond", "label": "Replying to greeting", "args": {{"message": "Hey! I'm TORCH, your AI agent. What can I help you with today?"}}, "requires_approval": false}}]

When the user asks to learn, understand, or be taught a topic, teach it directly and confidently.
Do not say you cannot teach because you are not a human instructor. Start with a useful first lesson,
explain at the user's level, include a practical exercise, and ask one focused follow-up question.
Only offer web tutorials as an optional supplement, never as a substitute for your own explanation.

NEVER use 'respond' when the user asks you to move, create, delete, open, find, read, run,
or change anything on their computer. Those requests MUST use the real tools below.

When answering questions about connections (email, AI, etc.), ONLY use the LIVE CONNECTION STATUS
block if provided. Never guess. If Gmail is NOT CONNECTED, say the user must add Gmail + App Password in Settings.

━━━ FILE & FOLDER RULES ━━━
- move_file, create_folder, delete_file require exact paths. Use find_file first if unsure.
- For "Torch folder on desktop": find_file with name "TORCH" and path "~/Desktop", then use the path from step_0_result.
- create_folder path examples: "~/Desktop/TORCH", "C:/Users/Name/Desktop/TORCH"
- Never claim a file action is done without calling move_file or create_folder.

━━━ OPEN APP RULES ━━━
- open_app opens apps by name (e.g. "code" for VS Code, "notepad", "explorer").
- To open VS Code with a folder: find_file or list_directory first, then run_terminal with: code "FULL_PATH"
- Do not use respond to ask for a path if you can search for it with find_file or list_directory.

- Use vision_control for application interactions that require visual clicking, typing, scrolling, or navigation.
- search_web is background-only. If the user explicitly says Chrome, Google, Edge, Firefox, or
  "the browser", do not substitute search_web. Open the named browser with open_app and then use
  vision_control so the requested search visibly happens in that application.
- For Spotify requests, first open Chrome with open_app, then use vision_control to navigate to
  open.spotify.com, search for the requested song and artist, and play it.

Example - play music on Spotify:
[
  {{"tool": "open_app", "label": "Opening Chrome", "args": {{"name": "chrome"}}, "requires_approval": false}},
  {{"tool": "vision_control", "label": "Finding and playing your track on Spotify", "args": {{"task": "Navigate to open.spotify.com, search for Doja by Central Cee, and play the track"}}, "requires_approval": false}}
]

Example — create folder:
[
  {{"tool": "create_folder", "label": "Creating TORCH folder on Desktop", "args": {{"path": "~/Desktop/TORCH"}}, "requires_approval": false}}
]

Example — open VS Code with project:
[
  {{"tool": "find_file", "label": "Finding project folder", "args": {{"name": "TORCH", "path": "~/Desktop"}}, "requires_approval": false}},
  {{"tool": "run_terminal", "label": "Opening in VS Code", "args": {{"command": "code \\"{{{{step_0_result}}}}\\""}}, "requires_approval": false}}
]

Example — read screen:
[
  {{"tool": "analyse_screen", "label": "Looking at your screen", "args": {{}}, "requires_approval": false}}
]

━━━ GENERAL RULES ━━━
1. Return a valid JSON array of steps. No markdown, no explanation.
2. Each step: {{"tool": "...", "label": "...", "args": {{}}, "requires_approval": false}}
3. Steps run sequentially. Reference prior results with {{{{step_0_result}}}}, {{{{step_1_result}}}}, etc.
4. Be specific and human-friendly in labels.
5. Use minimum steps needed.

FILE RULES:
- Always try find_file first, then find_file_fuzzy if not found.
- Never silently fail — always report what was found.

Example for a real task:
[
  {{"tool": "find_file", "label": "Searching for Sales.pdf", "args": {{"name": "Sales.pdf", "path": "~/Documents"}}, "requires_approval": false}},
  {{"tool": "read_pdf", "label": "Reading Sales.pdf", "args": {{"filepath": "{{{{step_0_result}}}}"}}, "requires_approval": false}},
  {{"tool": "send_email", "label": "Emailing summary to john@company.com", "args": {{"to": "john@company.com", "subject": "Sales Summary", "body": "{{{{step_1_result}}}}"}}, "requires_approval": true}}
]
"""

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = genai.Client(api_key=self.api_key)

    async def plan_command(self, user_command: str, context: Optional[List[Dict[str, Any]]] = None, model: Optional[str] = None) -> List[Dict[str, Any]]:
        # Trial Cloud Fallback (ADD-6)
        if self.api_key == "AIzaSyTrialCloudKeyPlaceholder":
            cmd = user_command.lower()
            if "file" in cmd or "find" in cmd:
                return [
                    {"tool": "find_file", "label": "Looking for files", "args": {"name": "report.pdf"}, "requires_approval": False},
                    {"tool": "read_pdf", "label": "Reading document", "args": {"filepath": "report.pdf"}, "requires_approval": False}
                ]
            elif "email" in cmd or "inbox" in cmd:
                return [
                    {"tool": "read_inbox", "label": "Checking your inbox", "args": {"count": 3}, "requires_approval": False}
                ]
            elif "search" in cmd or "web" in cmd:
                return [
                    {"tool": "search_web", "label": "Searching the web", "args": {"query": user_command}, "requires_approval": False}
                ]
            else:
                return [
                    {"tool": "respond", "label": "Replying", "args": {"message": f"I'm running in cloud trial mode. You asked me to: '{user_command}'. Add your own API key in Settings to run custom tasks!"}, "requires_approval": False}
                ]

        try:
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
                ctx_parts = []
                for ex in context:
                    user_cmd = ex.get("user_command", "")
                    reply = ex.get("reply_summary", "")
                    step_res = ex.get("step_results", [])
                    
                    # Format step results into a readable string
                    step_details = []
                    for idx, step in enumerate(step_res):
                        tool = step.get("tool", "unknown")
                        label = step.get("label", "")
                        status = step.get("status", "unknown")
                        res = step.get("result", "")
                        err = step.get("error", "")
                        
                        detail = f"  - Step {idx}: {label} (tool: {tool}) -> {status}"
                        if status == "done" and res:
                            detail += f", result: {res}"
                        elif status == "failed" and err:
                            detail += f", error: {err}"
                        step_details.append(detail)
                    
                    steps_text = "\n".join(step_details)
                    
                    exchange_str = (
                        f"User command: {user_cmd}\n"
                        f"TORCH response: {reply}\n"
                        f"Execution steps & outcomes:\n{steps_text}"
                    )
                    ctx_parts.append(exchange_str)
                
                ctx_text = "\n\n".join(ctx_parts)
                contents = system + "\n\nConversation context:\n" + ctx_text + "\n\nUser command: " + user_command

            # Call Gemini
            active_model = model if model and model != "auto" else settings.gemini_model
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=active_model,
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
            logger.error(f"Gemini planning failed: {e}")
            raise e

    async def generate_text(self, prompt: str) -> str:
        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                # Keep conversational/teaching replies on the low-latency model;
                # the heavier configured model remains available for agent planning.
                model="gemini-3.5-flash-lite",
                contents=prompt,
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini generate_text failed: {e}")
            raise e
