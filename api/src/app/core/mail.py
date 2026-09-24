from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from urllib.parse import urlparse

from .config import get_settings

log = logging.getLogger("aquastats.mail")


def _host() -> str:
    host = urlparse(get_settings().app_url).hostname or ""
    return host.removeprefix("www.")


def _mailbox(local: str, configured: str) -> str:
    if configured:
        return configured
    host = _host()
    if host and host not in {"127.0.0.1", "localhost"}:
        return f"{local}@{host}"
    return ""


def mail_from() -> str:
    settings = get_settings()
    return _mailbox("confirmation", settings.mail_from)


def contact_mailbox() -> str:
    settings = get_settings()
    return _mailbox("contact", settings.contact_email)


def security_mailbox() -> str:
    settings = get_settings()
    return _mailbox("security", settings.security_email)


def send_mail(to: str, subject: str, text: str) -> bool:
    settings = get_settings()
    sender = mail_from()
    if not sender or not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        return False
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    reply = contact_mailbox()
    if reply and reply != sender:
        message["Reply-To"] = reply
    message.set_content(text)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20, local_hostname="localhost") as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True
    except Exception:
        log.exception("Falha a enviar email para %s", to)
        return False


def send_password_reset(to: str, link: str) -> bool:
    return send_mail(
        to,
        "Aquastats — repor palavra-passe",
        "Pediste um link para repor a palavra-passe da Aquastats.\n\n"
        f"{link}\n\n"
        "O link vale 30 minutos e só pode ser usado uma vez. "
        "Se não foste tu, ignora este email.\n",
    )


def send_signup_confirmation(to: str, link: str) -> bool:
    return send_mail(
        to,
        "Aquastats — confirma o teu email",
        "Criaste uma conta na Aquastats. Confirma o email para ficar associado à conta.\n\n"
        f"{link}\n\n"
        "O link vale 24 horas e só pode ser usado uma vez. "
        "Se não foste tu, ignora este email.\n",
    )
