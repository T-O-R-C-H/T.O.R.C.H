"""
TORCH Plain-Language Error Translator (HIDE-2)
Converts technical exceptions/errors into calm, plain-English explanations with next steps.
"""

def translate_error(error_str: str) -> dict:
    """
    Translates a raw exception or error message into user-friendly terms.
    Returns a dictionary with 'what_happened' and 'what_to_do'.
    """
    err = str(error_str).lower()
    
    # 1. File Not Found
    if any(marker in err for marker in ["file not found", "no such file", "cannot find the file", "filenotfounderror"]):
        return {
            "what_happened": "I couldn't find the file you requested.",
            "what_to_do": "Please double-check the file name and make sure it exists."
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
        
    # 4. API Key/Quota issues
    if any(marker in err for marker in ["api key", "quota", "rate limit", "credentials", "authentication", "unauthenticated", "429"]):
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

    # 6. Unknown tool / capability error
    if any(marker in err for marker in ["unknown tool", "tool not registered", "not found in"]):
        return {
            "what_happened": "I wasn't able to check that folder.",
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
