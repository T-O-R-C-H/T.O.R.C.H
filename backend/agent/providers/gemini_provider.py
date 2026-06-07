import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from config.settings import settings
from agent.providers.base import LLMProvider

logger = logging.getLogger("torch.providers.gemini")

# Tool definitions for Gemini
AVAILABLE_TOOLS = [
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
8. Resolve pronouns like 'it', 'that', or references like 'the file', 'the PDF', 'the folder' from recent conversation context (provided under 'Conversation context'). For instance, if a file search in a previous turn successfully returned a path (shown in 'Execution steps & outcomes'), use that path when the user refers to it in the next command.

FILE MATCHING RULES:
- When searching for files, always use find_file tool first
- If the exact filename is not found, use find_file_fuzzy to get suggestions
- If fuzzy matches are found, include them in your response:
  "I couldn't find '[original name]' exactly. I found '[suggestion]' — is that what you meant?"
- Never silently fail on file searches — always report what was found or suggest alternatives
- Common user mistakes: wrong extension (.docs instead of .docx), reversed words, missing numbers

Respond ONLY with a JSON array. No markdown, no explanation, just the JSON.

Example response:
[
  {{"tool": "find_file", "label": "Searching for Sales.pdf in Documents", "args": {{"name": "Sales.pdf", "path": "~/Documents"}}, "requires_approval": false}},
  {{"tool": "read_pdf", "label": "Extracting text from Sales.pdf", "args": {{"filepath": "{{{{step_0_result}}}}"}}, "requires_approval": false}},
  {{"tool": "send_email", "label": "Sending summary to john@company.com", "args": {{"to": "john@company.com", "subject": "Sales Report Summary", "body": "{{{{step_1_result}}}}"}}, "requires_approval": true}}
]
"""

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = genai.Client(api_key=self.api_key)

    async def plan_command(self, user_command: str, context: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
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
            response = self.client.models.generate_content(
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
            logger.error(f"Gemini planning failed: {e}")
            raise e

    async def generate_text(self, prompt: str) -> str:
        try:
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini generate_text failed: {e}")
            raise e
