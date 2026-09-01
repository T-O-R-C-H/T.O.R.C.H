"""
TORCH Plain-Language Error Translator (HIDE-2)
Converts technical exceptions/errors into calm, plain-English explanations with next steps.
"""

import re

class UserFacingError(Exception):
    """
    An error whose message is already written for the user.

    Tools that know exactly what went wrong should raise this rather than a
    bare Exception, so the wording survives instead of being replaced by the
    generic fallback below.
    """


def translate_error(error_str: str) -> dict:
    """
    Translates a raw exception or error message into user-friendly terms.
    Returns a dictionary with 'what_happened' and 'what_to_do'.
    """
    err = str(error_str).lower()

    # Local vision model errors should remain specific and actionable rather than
    # being collapsed into the generic network message below.
    if "ollama" in err or "qwen2.5vl" in err:
        return {
            "what_happened": (
                "Vision control requires the local AI model. "
                "Ollama could not be reached or load qwen2.5vl:7b."
            ),
            "what_to_do": (
                "Make sure Ollama is running, run 'ollama pull qwen2.5vl:7b', "
                "then try again."
            ),
        }
    
    # 1. File Not Found
    if any(marker in err for marker in ["file not found", "no such file", "cannot find the file", "filenotfounderror"]):
        return {
            "what_happened": "I couldn't find the file you requested.",
            "what_to_do": "Please double-check the file name and make sure it exists."
        }

    # 1b. Search completed but no matching file exists
    if any(marker in err for marker in [
        "no files matching", "no exact match", "no file matching",
        "could not find a safe file match", "safe file match"
    ]):
        name = ""
        m = re.search(r"'([^']+)'", error_str)
        if m:
            name = m.group(1).strip()
        what_happened = (
            f"I searched the folder but couldn't find a file matching '{name}'."
            if name else "I searched the folder but couldn't find a matching file."
        )
        return {
            "what_happened": what_happened,
            "what_to_do": "Double-check the file name, or tell me another folder to look in (like Downloads or Desktop)."
        }
    
    # 2. Permission Denied
    if any(marker in err for marker in ["permission denied", "unauthorized", "access denied", "permissionerror"]):
        return {
            "what_happened": "I don't have permission to access that file or folder.",
            "what_to_do": "Make sure the file isn't open in another program, or try choosing a folder you own (like Documents or Downloads)."
        }
        
    # 3. Connection/Network Error
    if any(marker in err for marker in ["timeout", "timed out", "connection refused", "connection reset", "network", "httpstatuscode", "failed to establish a new connection"]):
        return {
            "what_happened": "I'm having trouble connecting to the network.",
            "what_to_do": "Please check your internet connection and try again in a moment."
        }
        
    # 4b. API Key/Quota issues
    # Quota is worth separating from a bad key: one is a plan limit the user
    # can lift, the other is a setting they can correct, and "check your
    # settings" is useless advice for the first.
    if any(marker in err for marker in ["quota", "rate limit", "resource_exhausted", "429"]):
        return {
            "what_happened": "This AI model has run out of allowance on your plan.",
            "what_to_do": "Wait a minute and try again, or pick a different model in Settings."
        }

    # 4a. The AI service is up but too busy to answer.
    #
    # Separate from the credentials branch below on purpose: a 503 is not the
    # user's fault and nothing in their settings will fix it, so telling them
    # to check their configuration sends them looking for a problem that is
    # not there. Waiting is the actual remedy.
    if any(marker in err for marker in [
        "503", "unavailable", "overloaded", "high demand", "try again later",
        "service unavailable", "capacity",
    ]):
        return {
            "what_happened": "The AI service is busy right now.",
            "what_to_do": "Nothing is wrong on your side — try again in a moment."
        }

    if any(marker in err for marker in ["api key", "credentials", "authentication", "unauthenticated"]):
        return {
            "what_happened": "There was an issue connecting to the AI helper service.",
            "what_to_do": "Please verify your connection settings or try again in a few minutes."
        }

    # 5. Email errors
    if any(marker in err for marker in ["smtp", "imap", "gmail", "login failure", "email credentials"]):
        return {
            "what_happened": "I couldn't sign into your email account.",
            "what_to_do": "Please double-check your email credentials and App Password in Settings."
        }

    # 5b. Web search refused (rate limiting / bot challenge)
    if "search is temporarily unavailable" in err:
        return {
            "what_happened": "Web search isn't responding at the moment.",
            "what_to_do": "Give it a minute and try again."
        }

    # 6. Unknown tool / capability error
    if any(marker in err for marker in ["unknown tool", "tool not registered", "not found in"]):
        return {
            "what_happened": "That isn't something I know how to do yet.",
            "what_to_do": "Want me to try a different way?"
        }

    # 7. Screen capture / vision
    if any(marker in err for marker in ["pyautogui", "mss", "screenshot failed", "screen capture", "screen analysis"]):
        return {
            "what_happened": "I couldn't capture or read your screen.",
            "what_to_do": "Restart TORCH, then run pip install pyautogui mss in the backend folder if this keeps happening."
        }

    # Fallback
    return {
        "what_happened": "Something didn't go as planned while running this step.",
        "what_to_do": "You can try rephrasing your request or retrying in a moment."
    }
