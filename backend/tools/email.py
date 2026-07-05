"""
TORCH Tools — Email (Gmail)
Send and read emails via Gmail SMTP/IMAP with App Password auth.
"""

import smtplib
import imaplib
import email
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
    if match:
        return match.group(1)
    return from_header[:60]


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
            server.login(settings.gmail_address, settings.gmail_app_password)
            server.send_message(msg)

        logger.info(f"Email sent to {to}: {subject}")
        return f"Email sent to {to} — Subject: {subject}"
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise RuntimeError(f"Email send failed: {e}")


def read_inbox(count: int = 10) -> str:
    """Read recent emails from Gmail inbox."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise ValueError("Gmail not configured. Add credentials in Settings.")

    try:
        mail = imaplib.IMAP4_SSL(settings.gmail_imap_host)
        mail.login(settings.gmail_address, settings.gmail_app_password)
        mail.select("inbox")

        _, message_numbers = mail.search(None, "ALL")
        nums = message_numbers[0].split()

        recent = nums[-count:] if len(nums) >= count else nums
        recent.reverse()

        summaries = []
        for num in recent:
            _, msg_data = mail.fetch(num, "(RFC822)")
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            subject = email.header.decode_header(msg["Subject"])[0]
            subject_str = subject[0] if isinstance(subject[0], str) else subject[0].decode()
            from_addr = _short_address(msg.get("From", ""))
            date = (msg.get("Date") or "")[:16]

            body_snip = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_snip = payload.decode(errors="replace")[:120].replace("\n", " ").strip()
                        break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_snip = payload.decode(errors="replace")[:120].replace("\n", " ").strip()

            line = f"• {subject_str} — from {from_addr}"
            if date:
                line += f" ({date})"
            if body_snip:
                line += f"\n  Preview: {body_snip}"
            summaries.append(line)

        mail.close()
        mail.logout()

        if not summaries:
            return "Your inbox is empty."

        header = f"Latest {len(summaries)} email(s) in {settings.gmail_address}:"
        return header + "\n\n" + "\n\n".join(summaries)

    except Exception as e:
        logger.error(f"Failed to read inbox: {e}")
        raise RuntimeError(f"Inbox read failed: {e}")
