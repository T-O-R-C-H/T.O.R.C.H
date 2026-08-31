"""
TORCH Agent Brain — Refactored to use LLMProvider
Converts user commands into structured execution plans using the active LLM provider.
"""

import logging
import re
from typing import List, Dict, Any, Optional
from config.settings import settings
from agent.providers import get_provider
from errors.plain_language import translate_error

logger = logging.getLogger("torch.brain")


_SPOTIFY_PLAY_REQUEST = re.compile(
    r"^(?:(?:please\s+)?(?:can|could|would|will)\s+you\s+)?"
    r"(?:please\s+)?play\s+(?P<query>.+?)\s+on\s+spotify"
    r"(?:\s+please)?[.!?]*$",
    re.IGNORECASE,
)

_BROWSER_SURFACE = (
    r"google\s+chrome|chrome|microsoft\s+edge|edge|firefox|google|(?:the\s+)?browser"
)
_VISIBLE_BROWSER_SEARCH_PATTERNS = (
    re.compile(
        rf"^(?:please\s+)?(?:search|look\s+up|find)\s+(?:for\s+)?"
        rf"(?P<query>.+?)\s+(?:(?:on|in|using|with)\s+)?"
        rf"(?P<browser>{_BROWSER_SURFACE})[.!?]*$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?:please\s+)?(?:open\s+)?(?P<browser>{_BROWSER_SURFACE})"
        rf"(?:\s+and)?\s+(?:search|look\s+up|find)\s+(?:for\s+)?"
        rf"(?P<query>.+?)[.!?]*$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?:please\s+)?search\s+(?P<browser>{_BROWSER_SURFACE})\s+for\s+"
        rf"(?P<query>.+?)[.!?]*$",
        re.IGNORECASE,
    ),
)

_LOGIN_NAVIGATION_PREFIX = (
    r"\b(?:go\s+to|navigate\s+to|open|visit|take\s+me\s+to)\b.*"
)
_ONLINE_ORDER_PATTERNS = (
    re.compile(
        r"^(?:please\s+)?(?:can\s+you\s+)?go\s+online\s+and\s+"
        r"(?:order|buy)\s+(?P<query>.+?)[.!?]*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:please\s+)?(?:can\s+you\s+)?(?:order|buy)\s+"
        r"(?P<query>.+?)\s+(?:for\s+me|online)[.!?]*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:please\s+)?(?:can\s+you\s+)?buy\s+(?P<query>.+?)\s*"
        r"(?:online)?\s*(?:for\s+me)?[.!?]*$",
        re.IGNORECASE,
    ),
)

_GREETING_PREFIX = re.compile(
    r"^(?:hey|hi|hello|sup|yo|howdy|hiya|what'?s up|wassup|greetings)\b",
    re.IGNORECASE,
)
_HOW_ARE_YOU_PREFIX = re.compile(r"^how are you\b", re.IGNORECASE)
_TIMEOFDAY_PREFIX = re.compile(
    r"^(?:good morning|good afternoon|good evening|good night)\b",
    re.IGNORECASE,
)
_CAPABILITY_PREFIX = re.compile(
    r"^(?:what (?:can|could) you do|who are you|what are you)\b",
    re.IGNORECASE,
)
_LOCAL_HOME_LIST_REQUEST = re.compile(
    r"^(?:please\s+)?(?:list|show)(?:\s+me)?\s+(?:the\s+)?files(?:\s+and\s+folders)?\s+"
    r"in\s+my\s+home\s+folder[.!?]*$",
    re.IGNORECASE,
)
_FULL_SENTENCE_PATTERNS = (
    re.compile(r"^(?:thanks|thank you|ty|thx|cheers)[.!]*$", re.IGNORECASE),
    re.compile(r"^(?:bye|goodbye|see you|cya|later)[.!]*$", re.IGNORECASE),
    re.compile(r"^(?:ok|okay|cool|got it|got you|understood|sure|alright|sounds good)[.!]*$", re.IGNORECASE),
    re.compile(r"^(?:nice|great|awesome|perfect|wonderful|excellent|amazing|fantastic)[.!]*$", re.IGNORECASE),
    re.compile(r"^help[.!]*$", re.IGNORECASE),
)

_CONVERSATIONAL_REPLIES = {
    "greeting": "Hey! I'm TORCH, your AI agent. What can I help you with today?",
    "how_are_you": "I'm running great. What can I do for you?",
    "timeofday": "Hello! I'm TORCH, your AI agent. What can I help you with today?",
    "capability": "I'm TORCH, your AI agent. I can find and read files, send emails, search the web, and control your browser and apps. What would you like to do?",
    "thanks": "You're welcome! Anything else I can do for you?",
    "bye": "Goodbye! Ping me anytime you need something done.",
    "ok": "Got it. Let me know what you need next.",
    "nice": "Glad to hear it! What's next?",
    "help": "I can help with tasks like finding files, sending emails, searching the web, and controlling apps. Just tell me what you want to do.",
}


def _canned_conversational_reply(user_command: str) -> Optional[str]:
    """Return a local, offline reply for pure chit-chat so a greeting never
    depends on (or fails because of) the AI API connection."""
    if not user_command:
        return None
    if _GREETING_PREFIX.match(user_command):
        return _CONVERSATIONAL_REPLIES["greeting"]
    if _HOW_ARE_YOU_PREFIX.match(user_command):
        return _CONVERSATIONAL_REPLIES["how_are_you"]
    if _TIMEOFDAY_PREFIX.match(user_command):
        return _CONVERSATIONAL_REPLIES["timeofday"]
    if _CAPABILITY_PREFIX.match(user_command):
        return _CONVERSATIONAL_REPLIES["capability"]
    for index, pattern in enumerate(_FULL_SENTENCE_PATTERNS):
        if pattern.match(user_command):
            key = ("thanks", "bye", "ok", "nice", "help")[index]
            return _CONVERSATIONAL_REPLIES[key]
    return None
_KNOWN_LOGIN_DESTINATIONS = (
    (
        re.compile(
            _LOGIN_NAVIGATION_PREFIX
            + r"\bfacebook\b.*\b(?:login|log\s+in|sign\s+in)\b",
            re.IGNORECASE,
        ),
        "Facebook login",
        "https://www.facebook.com/login/",
    ),
    (
        re.compile(
            _LOGIN_NAVIGATION_PREFIX
            + r"\bcanva\b.*\b(?:login|log\s+in|sign\s+in)\b",
            re.IGNORECASE,
        ),
        "Canva login",
        "https://www.canva.com/login/",
    ),
)


def _visible_browser_search_plan(user_command: str) -> Optional[List[Dict[str, Any]]]:
    """Route explicit visible-browser searches through desktop control.

    `search_web` is deliberately background-only. When a user names Chrome,
    Google, Edge, Firefox, or "the browser", they expect to see that browser
    open and be controlled. This deterministic route prevents an LLM from
    silently replacing that request with an invisible HTTP search.
    """
    request_line = user_command.splitlines()[0].strip() if user_command else ""
    match = None
    for pattern in _VISIBLE_BROWSER_SEARCH_PATTERNS:
        match = pattern.fullmatch(request_line)
        if match:
            break
    if not match:
        return None

    query = match.group("query").strip().strip("'\"")
    surface = re.sub(r"\s+", " ", match.group("browser").strip().lower())
    if not query:
        return None

    if surface in {"edge", "microsoft edge"}:
        app_name, display_name = "edge", "Microsoft Edge"
    elif surface == "firefox":
        app_name, display_name = "firefox", "Firefox"
    else:
        app_name, display_name = "chrome", "Chrome"

    return [
        {
            "tool": "open_app",
            "label": f"Opening {display_name}",
            "args": {"name": app_name},
            "requires_approval": False,
        },
        {
            "tool": "vision_control",
            "label": f"Searching Google for '{query}' in {display_name}",
            "args": {
                "task": (
                    f"Use the visible {display_name} window to search Google for exactly: {query}. "
                    "If a browser profile or account chooser is visible, do not choose for the "
                    "user and do not stop there. Ask which visible profile or account to use, "
                    "listing its exact name as an option, then continue this same task after the "
                    "answer. Do not report done until Google search results are visibly loaded."
                ),
                "browser": app_name,
                "search_query": query,
            },
            "requires_approval": False,
        },
    ]


def _online_order_plan(user_command: str) -> Optional[List[Dict[str, Any]]]:
    """Route online-ordering requests to a visible browser + vision_control flow.

    A bare `search_web` (invisible HTTP search) can never satisfy "order X" —
    the user expects to see the browser open, the cursor move, text get typed,
    and the item get added to the cart. This deterministic route forces that.
    """
    request_line = user_command.splitlines()[0].strip() if user_command else ""
    match = None
    for pattern in _ONLINE_ORDER_PATTERNS:
        match = pattern.fullmatch(request_line)
        if match:
            break
    if not match:
        return None

    query = match.group("query").strip().strip("'\"")
    query = re.sub(r"\s+(?:for\s+me|online)\s*$", "", query, flags=re.IGNORECASE).strip()
    if not query:
        return None

    return [
        {
            "tool": "open_app",
            "label": "Opening Chrome",
            "args": {"name": "chrome"},
            "requires_approval": False,
        },
        {
            "tool": "vision_control",
            "label": f"Ordering {query} online",
            "args": {
                "task": (
                    f"Order {query} online. Open Google, search for exactly '{query}', "
                    f"then open the most suitable website that sells it. Browse that site, "
                    f"find the item that matches '{query}', and add it to the cart. "
                    "Do not enter any personal, delivery, or payment information and do NOT "
                    "complete the checkout. When the item is in the cart, stop and report "
                    "exactly what you added. If you are unsure which result or item to pick, "
                    "ask the user instead of guessing."
                ),
                "browser": "chrome",
            },
            "requires_approval": False,
        },
    ]


def _visible_browser_navigation_plan(
    user_command: str,
) -> Optional[List[Dict[str, Any]]]:
    """Route known visible destinations without waiting on the vision model."""
    request_line = user_command.splitlines()[0].strip() if user_command else ""
    destination_match = next(
        (
            (destination, url)
            for pattern, destination, url in _KNOWN_LOGIN_DESTINATIONS
            if pattern.search(request_line)
        ),
        None,
    )
    if destination_match is None:
        return None
    destination, url = destination_match

    surface_match = re.search(rf"\b({_BROWSER_SURFACE})\b", request_line, re.IGNORECASE)
    surface = (
        re.sub(r"\s+", " ", surface_match.group(1).strip().lower())
        if surface_match
        else "chrome"
    )
    if surface in {"edge", "microsoft edge"}:
        app_name, display_name = "edge", "Microsoft Edge"
    elif surface == "firefox":
        app_name, display_name = "firefox", "Firefox"
    else:
        app_name, display_name = "chrome", "Chrome"

    return [
        {
            "tool": "open_app",
            "label": f"Opening {display_name}",
            "args": {"name": app_name},
            "requires_approval": False,
        },
        {
            "tool": "vision_control",
            "label": f"Navigating to {destination}",
            "args": {
                "task": (
                    f"Use the visible {display_name} window to navigate to {url}. "
                    "If a browser profile or account chooser is visible, ask which named "
                    "profile to use and continue this same task after the answer. Do not "
                    f"enter login credentials. Finish when the {destination} page is visible."
                ),
                "browser": app_name,
                "navigate_url": url,
                "destination_label": destination,
            },
            "requires_approval": False,
        },
    ]


def _spotify_play_plan(user_command: str) -> Optional[List[Dict[str, Any]]]:
    """Return the canonical Spotify plan for an exact play request.

    The desktop status block is appended to planner input after a blank line.
    Matching only the first request line keeps that context out of the search
    query while still allowing the deterministic route to be used.
    """
    request_line = user_command.splitlines()[0].strip() if user_command else ""
    match = _SPOTIFY_PLAY_REQUEST.fullmatch(request_line)
    if not match:
        return None

    query = match.group("query").strip()
    if not query:
        return None

    return [
        {
            "tool": "open_app",
            "label": "Opening Chrome",
            "args": {"name": "chrome"},
            "requires_approval": False,
        },
        {
            "tool": "vision_control",
            "label": "Finding and playing your track on Spotify",
            "args": {
                "task": (
                    "Navigate to open.spotify.com, search for "
                    f"{query}, and play the track"
                )
            },
            "requires_approval": False,
        },
    ]


async def plan_command(
    user_command: str,
    context: Optional[List[Dict]] = None,
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Send user command to the active LLM provider and receive a structured execution plan.

    Args:
        user_command: The user's natural language command
        context: Optional list of previous messages for context

    Returns:
        List of step dictionaries with tool, label, args, requires_approval
    """
    try:
        # The first-run task must work before an AI provider is configured. It
        # is read-only, deterministic, and returns real data from this machine.
        request_line = user_command.splitlines()[0].strip() if user_command else ""
        if _LOCAL_HOME_LIST_REQUEST.fullmatch(request_line):
            logger.info("Using deterministic local home-folder plan")
            return [{
                "tool": "list_directory",
                "label": "Checking your home folder",
                "args": {"path": "~"},
                "requires_approval": False,
            }]

        spotify_plan = _spotify_play_plan(user_command)
        if spotify_plan is not None:
            return spotify_plan

        order_plan = _online_order_plan(user_command)
        if order_plan is not None:
            logger.info("Using deterministic online-ordering plan")
            return order_plan

        browser_search_plan = _visible_browser_search_plan(user_command)
        if browser_search_plan is not None:
            logger.info("Using deterministic visible-browser search plan")
            return browser_search_plan

        browser_navigation_plan = _visible_browser_navigation_plan(user_command)
        if browser_navigation_plan is not None:
            logger.info("Using deterministic visible-browser navigation plan")
            return browser_navigation_plan

        # 1. Detect: "Save this as a skill called [Name]"
        save_match = re.search(r"save this as a skill called (.+)", user_command, re.IGNORECASE)
        if save_match:
            skill_name = save_match.group(1).strip().strip('\'"')
            from memory.storage import db
            # Get the previous command from the tasks database
            tasks = db.get_tasks(limit=1)
            if not tasks:
                return [{
                    "tool": "error",
                    "label": "No previous command found to save as a skill",
                    "args": {},
                    "requires_approval": False,
                    "error": "No previous command found in history."
                }]
            last_cmd = tasks[0]["command"]
            return [{
                "tool": "save_skill",
                "label": f"Saving skill '{skill_name}'",
                "args": {"name": skill_name, "command": last_cmd},
                "requires_approval": False,
            }]

        # 2. Detect: "Run [Name]"
        if user_command.lower().startswith("run "):
            skill_name = user_command[4:].strip().strip('\'"')
            from memory.storage import db
            with db._connect() as conn:
                row = conn.execute(
                    "SELECT id, command FROM skills WHERE LOWER(name) = LOWER(?)",
                    (skill_name,)
                ).fetchone()
            if row:
                skill_id = row["id"]
                stored_command = row["command"]
                # Increment run count
                from skills import run_skill
                run_skill(skill_id)
                # Recursively plan the stored command
                return await plan_command(stored_command, context)

        # Teaching and explanatory questions do not need the heavyweight tool planner.
        # Route them through a compact text-generation prompt for a much faster reply.
        teaching_request = re.search(
            r"\b(teach me|can you teach|how (?:do|can) i (?:use|learn)|explain how|show me how)\b",
            user_command,
            re.IGNORECASE,
        )
        if teaching_request:
            provider = get_provider(model)
            if not provider:
                return [{
                    "tool": "error",
                    "label": "No AI provider configured",
                    "args": {},
                    "requires_approval": False,
                    "error": "No AI provider configured. Add an API key in Settings.",
                }]
            lesson = await provider.generate_text(
                "You are TORCH, a patient expert teacher. Answer the user's request directly. "
                "Start with a useful beginner lesson, use short clear steps, include one practical "
                "exercise they can do now, and end with one focused question. Do not disclaim that "
                "you are not a human teacher and do not redirect them to tutorials.\n\n"
                f"User request: {user_command}"
            )
            return [{
                "tool": "respond",
                "label": "Teaching",
                "args": {"message": lesson},
                "requires_approval": False,
            }]

# Greetings and chit-chat never need the LLM API — answer instantly and offline.
        canned = _canned_conversational_reply(user_command)
        if canned is not None:
            logger.info("Using canned conversational reply")
            return [{
                "tool": "respond",
                "label": "Replying to you",
                "args": {"message": canned},
                "requires_approval": False,
            }]

        # Determine the active provider
        provider = get_provider(model)
        if not provider:
            return [{
                "tool": "error",
                "label": "No AI provider configured",
                "args": {},
                "requires_approval": False,
                "error": "No AI provider configured. Add API key in Settings."
            }]

        return await provider.plan_command(user_command, context, model=model)

    except NotImplementedError as e:
        logger.error(f"Brain provider error: {e}")
        return [{
            "tool": "error",
            "label": "Selected provider not implemented",
            "args": {},
            "requires_approval": False,
            "error": str(e),
        }]
    except Exception as e:
        logger.error(f"Brain error: {e}")
        err_msg = str(e)
        lowered = err_msg.lower()
        if "429" in lowered or "quota" in lowered or "limit" in lowered or "exhausted" in lowered:
            return [{
                "tool": "error",
                "label": "AI Provider rate limit hit",
                "args": {},
                "requires_approval": False,
                "error": "Rate limit exceeded. Please try again later or configure another provider."
            }]
        if any(marker in lowered for marker in [
            "getaddrinfo", "gaierror", "name or service not known",
            "failed to establish a new connection", "connection refused",
            "connection timed out", "timed out", "dns", "network is unreachable",
        ]):
            return [{
                "tool": "error",
                "label": "Could not reach the AI service",
                "args": {},
                "requires_approval": False,
                "error": "I couldn't reach the AI service. Check your internet connection and try again."
            }]
        # Never put the raw exception in front of the user. This used to read
        # "AI planning failed: 503 UNAVAILABLE. {'error': {'code': 503, ...".
        plain = translate_error(err_msg)
        return [{
            "tool": "error",
            "label": plain["what_happened"],
            "args": {},
            "requires_approval": False,
            "error": f"{plain['what_happened']} {plain['what_to_do']}",
        }]
