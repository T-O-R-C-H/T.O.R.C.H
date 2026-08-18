"""
TORCH Tools — Email (Gmail)
Send and read emails via Gmail SMTP/IMAP with App Password auth.
"""

import smtplib
import imaplib
import email
import quopri
import base64
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


def read_inbox(count: int = 10, query: str = "") -> str:
    """Read recent emails from Gmail inbox.

    When ``query`` is provided, only emails matching that term (subject,
    sender, or body) are returned, newest first.
    """
    if not settings.gmail_address or not _app_password():
        raise ValueError("Gmail not configured. Add credentials in Settings.")

    try:
        mail = _open_inbox()

        search_term = (query or "").strip().replace('"', " ")
        if search_term:
            criteria = (
                '(OR (SUBJECT "%s") (OR (FROM "%s") (BODY "%s")))'
                % (search_term, search_term, search_term)
            )
            typ, message_numbers = mail.search(None, criteria)
        else:
            typ, message_numbers = mail.search(None, "ALL")

        nums = message_numbers[0].split()

        recent = nums[-count:] if len(nums) >= count else nums
        recent.reverse()

        summaries = []
        for num in recent:
            _, msg_data = mail.fetch(num, "(RFC822)")
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            subject_str = _decode_subject(msg.get("Subject"))
            from_addr = _short_address(msg.get("From", ""))
            date = (msg.get("Date") or "")[:16]

            body_snip = _snippet(msg, length=120)

            line = f"• {subject_str} — from {from_addr}"
            if date:
                line += f" ({date})"
            if body_snip:
                line += f"\n  Preview: {body_snip}"
            summaries.append(line)

        mail.close()
        mail.logout()

        if not summaries:
            if search_term:
                return f"No emails matching '{search_term}' were found."
            return "Your inbox is empty."

        header = f"Latest {len(summaries)} email(s) in {settings.gmail_address}:"
        return header + "\n\n" + "\n\n".join(summaries)

    except Exception as e:
        logger.error(f"Failed to read inbox: {e}")
        raise RuntimeError(f"Inbox read failed: {e}")


def fetch_inbox(limit: int = 100, offset: int = 0) -> dict:
    """Return structured inbox messages (newest first) without marking them read.

    Headers and a short preview snippet are fetched for the whole page in a
    single batched IMAP command so syncing stays fast even for large inboxes.
    """
    mail = _open_inbox()
    try:
        _, data = mail.uid("search", None, "ALL")
        uids = data[0].split()
        total = len(uids)
        ordered = uids[::-1]
        page = ordered[offset:offset + limit]

        if not page:
            return {"total": total, "messages": []}

        id_list = b",".join(page)
        _, responses = mail.uid(
            "fetch",
            id_list,
            "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY.PEEK[1]<0.220>)",
        )

        by_uid: dict[str, dict] = {}
        current_uid: Optional[str] = None
        for item in responses:
            if not isinstance(item, tuple) or item[0] is None:
                continue
            meta = item[0].decode(errors="replace")
            uid_match = re.search(r"UID (\d+)", meta)
            if uid_match:
                current_uid = uid_match.group(1)
                entry = by_uid.setdefault(
                    current_uid,
                    {"uid": current_uid, "subject": "", "from": "", "date": "", "snippet": "", "read": False},
                )
            if current_uid is None:
                continue
            entry = by_uid.setdefault(
                current_uid,
                {"uid": current_uid, "subject": "", "from": "", "date": "", "snippet": "", "read": False},
            )
            if "HEADER.FIELDS" in meta:
                msg = email.message_from_bytes(item[1])
                entry["subject"] = _decode_subject(msg.get("Subject"))
                entry["from"] = _short_address(msg.get("From", ""))
                entry["date"] = msg.get("Date", "")
                entry["read"] = "\\Seen" in meta
            elif "BODY[1]" in meta or "BODY[TEXT]" in meta:
                entry["snippet"] = _snippet_section(item[1])

        messages = [
            by_uid[u.decode(errors="replace")]
            for u in page
            if u.decode(errors="replace") in by_uid
        ]
        return {"total": total, "messages": messages}
    finally:
        mail.close()
        mail.logout()


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
