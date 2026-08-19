"""
TORCH Tools — Email (Gmail)
Send and read emails via Gmail SMTP/IMAP with App Password auth.
"""

import smtplib
import imaplib
import email
import quopri
import base64
import json
import os
import threading
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Optional
import logging
import re

from config.settings import settings

logger = logging.getLogger("torch.tools.email")

# Local inbox cache: headers + preview snippets for recent messages so repeat
# reads never re-hit IMAP within the TTL. Persisted to disk across restarts.
_EMAIL_CACHE_LOCK = threading.Lock()
_INBOX_CACHE: dict = {"synced_at": 0.0, "total": 0, "max_uid": 0, "messages": []}

_FETCH_FLAGS = "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY.PEEK[1]<0.220>)"


def _inbox_cache_path() -> str:
    data_dir = os.path.abspath(settings.data_dir)
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "inbox_cache.json")


def _load_inbox_cache() -> dict:
    global _INBOX_CACHE
    try:
        path = _inbox_cache_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                stored = json.load(f)
            _INBOX_CACHE = {
                "synced_at": float(stored.get("synced_at", 0)),
                "total": int(stored.get("total", 0)),
                "max_uid": int(stored.get("max_uid", 0)),
                "messages": stored.get("messages", []),
            }
    except Exception as e:
        logger.warning(f"Could not load inbox cache: {e}")
    return _INBOX_CACHE


def _save_inbox_cache() -> None:
    try:
        with open(_inbox_cache_path(), "w", encoding="utf-8") as f:
            json.dump(_INBOX_CACHE, f)
    except Exception as e:
        logger.warning(f"Could not save inbox cache: {e}")


def _inbox_cache_size() -> int:
    return max(10, int(settings.email_cache_size))


def _inbox_cache_ttl() -> float:
    return max(1, float(settings.email_cache_ttl_seconds))


def _inbox_cache_fresh() -> bool:
    return bool(_INBOX_CACHE["messages"]) and (
        time.time() - _INBOX_CACHE["synced_at"] < _inbox_cache_ttl()
    )


def _refresh_inbox_cache(force: bool = False) -> None:
    """Incrementally sync the newest inbox messages into the local cache."""
    if not force and _inbox_cache_fresh():
        return
    if not settings.gmail_address or not _app_password():
        raise ValueError("Gmail not configured. Add credentials in Settings.")

    _load_inbox_cache()
    with _EMAIL_CACHE_LOCK:
        mail = _open_inbox()
        try:
            _, data = mail.uid("search", None, "ALL")
            uids = data[0].split()
            total = len(uids)
            ordered = [u.decode(errors="replace") for u in uids[::-1]]

            max_known = int(_INBOX_CACHE.get("max_uid", 0))
            new_uids = [u for u in ordered if int(u) > max_known]
            size = _inbox_cache_size()

            if new_uids:
                # Fetch only the newest unseen batch to bound work per sync.
                batch = new_uids[:size]
                id_list = b",".join(u.encode() for u in batch)
                _, responses = mail.uid("fetch", id_list, _FETCH_FLAGS)
                new_messages = _parse_batched(responses, [u.encode() for u in batch])
                known_ids = {m["uid"] for m in _INBOX_CACHE.get("messages", [])}
                merged = [
                    m for m in new_messages if m["uid"] not in known_ids
                ] + _INBOX_CACHE.get("messages", [])
                _INBOX_CACHE["messages"] = merged[:size]
            else:
                # Keep the existing list but refresh the timestamp.
                _INBOX_CACHE["messages"] = _INBOX_CACHE.get("messages", [])[:size]

            _INBOX_CACHE["max_uid"] = max(int(u) for u in ordered) if ordered else max_known
            _INBOX_CACHE["total"] = total
            _INBOX_CACHE["synced_at"] = time.time()
            _save_inbox_cache()
        finally:
            mail.close()
            mail.logout()


def _short_address(from_header: str) -> str:
    if not from_header:
        return "Unknown sender"
    match = re.search(r"<([^>]+)>", from_header)
    name = from_header.split("<", 1)[0].strip().strip('"')
    if match and name:
        return name[:60]
    if match:
        return match.group(1)
    return from_header[:60]


def _extract_email(from_header: str) -> str:
    match = re.search(r"<([^>]+)>", from_header or "")
    if match:
        return match.group(1)
    value = (from_header or "").strip()
    if "@" in value:
        return value[:120]
    return ""


def _query_tokens(query: str) -> list[str]:
    return [t for t in re.split(r"[^A-Za-z0-9]+", query.lower()) if t]


def _matches_topic(subject: str, from_addr: str, query: str) -> bool:
    """True when any query token appears as a whole word in subject or sender."""
    tokens = _query_tokens(query)
    if not tokens:
        return True
    haystack = f"{subject} {from_addr}".lower()
    for token in tokens:
        if re.search(rf"\b{re.escape(token)}\b", haystack):
            return True
    return False


def _app_password() -> str:
    """Return the Gmail app password with all whitespace stripped.

    Google displays app passwords in 4-character groups; the spaces must be
    removed before SMTP/IMAP authentication or the login fails.
    """
    return "".join(settings.gmail_app_password.split())


def _open_inbox():
    """Open an IMAP connection and select the inbox folder."""
    if not settings.gmail_address or not _app_password():
        raise ValueError("Gmail not configured. Add credentials in Settings.")
    mail = imaplib.IMAP4_SSL(settings.gmail_imap_host, timeout=30)
    mail.login(settings.gmail_address, _app_password())
    mail.select("inbox")
    return mail


def _decode_subject(value: Optional[str]) -> str:
    if not value:
        return "(no subject)"
    try:
        parts = email.header.decode_header(value)
    except Exception:
        return str(value)
    out = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            try:
                out.append(chunk.decode(enc or "utf-8", errors="replace"))
            except (LookupError, TypeError):
                out.append(chunk.decode(errors="replace"))
        else:
            out.append(chunk)
    return "".join(out).strip() or "(no subject)"


def _walk_payload(msg, content_type: str) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == content_type:
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            return payload.decode(errors="replace")
    return ""


def _body_text(msg) -> str:
    return _walk_payload(msg, "text/plain")


def _body_html(msg) -> str:
    return _walk_payload(msg, "text/html")


def _snippet(msg, length: int = 180) -> str:
    text = _body_text(msg)
    if not text:
        text = re.sub(r"<[^>]+>", " ", _body_html(msg))
    return " ".join(text.split())[:length]


def _snippet_section(raw: bytes, length: int = 140) -> str:
    """Build a short preview from a partial IMAP section fetch."""
    text = raw.decode(errors="replace")
    stripped = text.strip()
    if stripped and len(stripped) % 4 == 0 and re.fullmatch(r"[A-Za-z0-9+/=\r\n]+", stripped):
        try:
            text = base64.b64decode(stripped).decode("utf-8", errors="replace")
        except Exception:
            text = raw.decode(errors="replace")
    else:
        try:
            text = quopri.decodestring(raw).decode("utf-8", errors="replace")
        except Exception:
            text = raw.decode(errors="replace")
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(text.split())[:length]


def send_email(
    to: str,
    subject: str,
    body: str,
    attachment: Optional[str] = None,
) -> str:
    """Send an email via Gmail SMTP. Always requires HITL approval."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise ValueError("Gmail not configured. Add credentials in Settings.")

    msg = MIMEMultipart()
    msg["From"] = settings.gmail_address
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    if attachment:
        attach_path = Path(attachment).expanduser().resolve()
        if attach_path.exists():
            with open(attach_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={attach_path.name}",
                )
                msg.attach(part)
        else:
            logger.warning(f"Attachment not found: {attach_path}")

    try:
        with smtplib.SMTP(settings.gmail_smtp_host, settings.gmail_smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.gmail_address, _app_password())
            server.send_message(msg)

        logger.info(f"Email sent to {to}: {subject}")
        return f"Email sent to {to} — Subject: {subject}"
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise RuntimeError(f"Email send failed: {e}")


def _parse_batched(responses: list, ordered_uids: list) -> list[dict]:
    """Parse the batched header+preview IMAP response into ordered message dicts."""
    by_uid: dict[str, dict] = {}
    current_uid: Optional[str] = None
    for item in responses:
        if not isinstance(item, tuple) or item[0] is None:
            continue
        meta = item[0].decode(errors="replace")
        uid_match = re.search(r"UID (\d+)", meta)
        if uid_match:
            current_uid = uid_match.group(1)
            by_uid.setdefault(
                current_uid,
                {"uid": current_uid, "subject": "", "from": "", "from_email": "", "date": "", "snippet": "", "read": False},
            )
        if current_uid is None:
            continue
        entry = by_uid.setdefault(
            current_uid,
            {"uid": current_uid, "subject": "", "from": "", "from_email": "", "date": "", "snippet": "", "read": False},
        )
        if "HEADER.FIELDS" in meta:
            msg = email.message_from_bytes(item[1])
            from_header = msg.get("From", "")
            entry["subject"] = _decode_subject(msg.get("Subject"))
            entry["from"] = _short_address(from_header)
            entry["from_email"] = _extract_email(from_header)
            entry["date"] = msg.get("Date", "")
            entry["read"] = "\\Seen" in meta
        elif "BODY[1]" in meta or "BODY[TEXT]" in meta:
            entry["snippet"] = _snippet_section(item[1])

    return [
        by_uid[u.decode(errors="replace")]
        for u in ordered_uids
        if u.decode(errors="replace") in by_uid
    ]


def inbox_emails(count: int = 10, query: str = "") -> list[dict]:
    """Return structured inbox messages (newest first), optionally filtered.

    Results come from a local cache of the newest messages that is refreshed
    incrementally at most once per TTL, so repeat reads stay fast even for
    large inboxes. ``query`` filters the cached messages by topic (subject or
    sender).
    """
    _refresh_inbox_cache()
    messages = list(_INBOX_CACHE.get("messages", []))
    search_term = (query or "").strip()
    if search_term:
        messages = [
            m for m in messages if _matches_topic(m["subject"], m["from_email"] or m["from"], search_term)
        ]
    return messages[: max(1, int(count or 10))]


def read_inbox(count: int = 10, query: str = "") -> str:
    """Read recent emails from Gmail inbox.

    When ``query`` is provided, only emails that mention that topic in their
    subject or sender are returned (body mentions are ignored to avoid noise),
    newest first.
    """
    try:
        msgs = inbox_emails(count=count, query=query)
        search_term = (query or "").strip()

        if not msgs:
            if search_term:
                return f"No emails about '{search_term}' were found."
            return "Your inbox is empty."

        summaries = []
        for m in msgs:
            line = f"• **{m['subject']}** — from {m['from']}"
            if m["date"]:
                line += f" ({m['date'][:16]})"
            if m["snippet"]:
                line += f"\n  Preview: {m['snippet']}"
            summaries.append(line)

        header = f"Latest {len(msgs)} email(s) in {settings.gmail_address}:"
        return header + "\n\n" + "\n\n".join(summaries)

    except Exception as e:
        logger.error(f"Failed to read inbox: {e}")
        raise RuntimeError(f"Inbox read failed: {e}")


def fetch_inbox(limit: int = 100, offset: int = 0) -> dict:
    """Return structured inbox messages (newest first) without marking them read.

    Served from the local cache (refreshed at most once per TTL), so this is
    fast even for large inboxes.
    """
    _refresh_inbox_cache()
    messages = list(_INBOX_CACHE.get("messages", []))
    total = int(_INBOX_CACHE.get("total", len(messages)))
    page = messages[offset:offset + limit]
    return {"total": total, "messages": page}


def fetch_email(uid: str) -> dict:
    """Return the full content of a single inbox message."""
    mail = _open_inbox()
    try:
        _, msg_data = mail.uid("fetch", uid.encode(), "(BODY.PEEK[])")
        if not msg_data or msg_data[0] is None:
            raise RuntimeError("This message is no longer in the inbox.")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        return {
            "uid": uid,
            "subject": _decode_subject(msg.get("Subject")),
            "from": _short_address(msg.get("From", "")),
            "from_email": _extract_email(msg.get("From", "")),
            "to": msg.get("To", ""),
            "date": msg.get("Date", ""),
            "text": _body_text(msg),
            "html": _body_html(msg),
        }
    finally:
        mail.close()
        mail.logout()


def mark_email_read(uid: str, read: bool = True) -> None:
    """Mark a message as read (\\Seen) or unread."""
    mail = _open_inbox()
    try:
        flag = "+FLAGS" if read else "-FLAGS"
        mail.uid("STORE", uid.encode(), flag, "(\\Seen)")
    finally:
        mail.close()
        mail.logout()
