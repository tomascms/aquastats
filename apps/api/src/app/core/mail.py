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


def send_signup_attempt(to: str, link: str) -> bool:
    return send_mail(
        to,
        "Aquastats — alguém tentou registar-se com este email",
        "Alguém tentou criar uma conta na Aquastats com este email, que já tem conta.\n\n"
        f"Se foste tu, entra com a tua conta, ou repõe a palavra-passe aqui: {link}\n\n"
        "Se não foste tu, não precisas de fazer nada: a tua conta não mudou.\n",
    )


def send_guardian_request(to: str, child: str, link: str) -> bool:
    return send_mail(
        to,
        "Aquastats — autorização de responsável parental",
        f"{child} criou uma conta na Aquastats, uma app de treino de natação, e indicou este email como "
        "o de um responsável parental.\n\n"
        "Como tem menos de 13 anos, só guardamos dados de saúde e bem-estar (sono, esforço percebido, "
        "recuperação e frequência cardíaca) com a tua autorização. Sem ela, a conta funciona na mesma, sem "
        "esses dados.\n\n"
        f"Para autorizar ou recusar: {link}\n\n"
        "O link vale 7 dias. Se não conheces este pedido, ignora este email.\n",
    )


def send_guardian_confirmation(to: str, child: str, link: str) -> bool:
    return send_mail(
        to,
        "Aquastats — autorização registada",
        f"Registámos a tua autorização para {child}.\n\n"
        f"Podes retirá-la a qualquer momento neste link: {link}\n"
        "Ao retirar, apagamos os dados de saúde e bem-estar guardados até aí.\n",
    )


def send_inactivity_notice(to: str, when: str) -> bool:
    return send_mail(
        to,
        "Aquastats — a tua conta vai ser apagada por inatividade",
        "A tua conta na Aquastats não é usada há quase 3 anos.\n\n"
        f"Se não entrares até {when}, apagamos a conta e todos os dados associados, de forma definitiva.\n"
        "Para a manter, basta entrar uma vez.\n",
    )
