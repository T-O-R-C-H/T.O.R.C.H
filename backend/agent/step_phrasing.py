"""
TORCH Step Phrasing Module (ADD-2)
Translates internal step identifiers and arguments into human-readable plain language.
"""

import os
from typing import Dict, Any

def get_plain_phrase(tool_name: str, args: Dict[str, Any], status: str = "active") -> str:
    """
    Translates internal tool name and arguments into a plain-English present-tense or past-tense action.
    """
    present = status in ("active", "pending", "hitl_required")
    
    # Extract clean name or file/subject/app details from args
    name = args.get("name") or args.get("filename") or args.get("query") or args.get("message") or args.get("filepath") or args.get("path") or args.get("url") or args.get("to")
    if name:
        name_str = os.path.basename(str(name))
    else:
        name_str = ""

    phrases = {
        "find_file": ("Looking for your file...", f"Found your file '{name_str}'." if name_str else "Found your file."),
        "find_file_fuzzy": ("Looking for your file...", f"Found your file '{name_str}'." if name_str else "Found your file."),
        "list_directory": ("Checking the folder contents...", "Checked the folder contents."),
        "read_pdf": ("Reading your PDF document...", "Read the PDF document."),
        "read_word": ("Reading your Word document...", "Read the Word document."),
        "read_excel": ("Reading your spreadsheet...", "Read the spreadsheet."),
        "send_email": ("Sending your email...", "Sent your email."),
        "read_inbox": ("Checking your inbox...", "Checked your inbox."),
        "open_browser": ("Opening your browser...", "Opened your browser."),
        "click": ("Clicking on the screen...", "Clicked on the screen."),
        "type_text": ("Typing text...", "Typed text."),
        "screenshot": ("Taking a picture of your screen...", "Took a picture of your screen."),
        "analyse_screen": ("Looking at the screen...", "Looked at the screen."),
        "search_web": ("Searching the web...", "Searched the web."),
        "download_file": ("Downloading a file...", "Downloaded the file."),
        "open_app": (f"Opening {name_str or 'app'}...", f"Opened {name_str or 'app'}."),
        "post_social": ("Posting to social media...", "Posted to social media."),
        "send_message": ("Sending your message...", "Sent your message."),
        "run_terminal": ("Running system command...", "Ran system command."),
        "move_file": ("Moving your file...", "Moved your file."),
        "delete_file": ("Deleting your file...", "Deleted your file."),
        "create_folder": ("Creating a folder...", "Created the folder."),
        "zip_files": ("Creating a compressed zip file...", "Created the compressed zip file."),
        "save_skill": ("Saving this as a shortcut...", "Saved shortcut."),
    }

    if tool_name in phrases:
        return phrases[tool_name][0] if present else phrases[tool_name][1]
    
    return "Working on it..." if present else "Completed."
