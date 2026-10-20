from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update

RESEND_CONFIRM_COOLDOWN = timedelta(minutes=5)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.client import stored_ip
from ..core.config import get_settings
from ..core.db import get_auth_session
from ..schemas import ChangePasswordBody, DeleteAccountBody, parse_body
from ..core.google_identity import verify_google_id_token
from ..core.google_oauth import (
    OAUTH_COOKIE,
    OAUTH_TTL_SECONDS,
    build_authorize_url,
    exchange_code,
    google_redirect_uri,
    pkce_challenge,
    pkce_verifier,
    read_oauth_state,
    sign_oauth_state,
)
from ..core.http_security import compare, new_token, sha256
from ..core.mail import send_password_reset, send_signup_confirmation
from ..core.passwords import clean_text, hash_password, is_honeypot, valid_email, valid_password, verify_password
from ..core.sessions import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    bump_token_version,
    clear_auth_cookies,
    current_user_payload,
    read_access,
    revoke_user_sessions,
    rotate_refresh,
    set_auth_cookies,
    sign_access,
    token_is_current,
)
from ..core.tenant import require_user
from ..domain.identity import (
    INVITE_COOKIE,
    absorb_user,
    create_pending_user,
    find_user_by_email,
    home_path,
    invite_next_path,
    issue_session,
    join_team,
    LOGIN_FAILED,
    lock_or_fail,
    login_locked,
    membership,
    normalize_email,
    now,
    delete_user_account,
    leave_team,
    provision_role,
    remember_invite,
    safe_app_path,
    team_by_join_code,
)
from ..domain.models import Athlete, EmailVerificationToken, OAuthAccount, PasswordResetToken, Profile, RefreshToken, Team, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _finish_oauth(session: Session, request: Request, *, provider: str, provider_id: str, email: str | None, name: str, verified: bool, invite: str = "") -> tuple[User, str]:
    email = normalize_email(email)
    account = session.scalar(
        select(OAuthAccount).where(OAuthAccount.provider == provider, OAuthAccount.provider_account_id == provider_id)
    )
    stamp = now()
    if account:
        user = session.get(User, account.user_id)
        if not user or user.deleted_at:
            raise HTTPException(status_code=403, detail="Conta desactivada.")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Conta desactivada.")
        if email:
            owner = find_user_by_email(session, email)
            # Merge into the email's account only when Google vouches for the email.
            if owner and owner.id != user.id and verified:
                if user.email and normalize_email(user.email) != email:
                    raise HTTPException(status_code=409, detail="Este login já está ligado a outro email.")
                user = absorb_user(session, user, owner)
            elif not user.email:
                user.email = email
        if verified:
            user.is_verified = True
        user.last_login_at = stamp
        return user, invite_next_path(request, home_path(user.role), invite)

    existing = find_user_by_email(session, email)
    if existing:
        # Same email = same account, but only on an email Google verified: otherwise anyone could claim it.
        if not verified:
            raise HTTPException(status_code=409, detail="Este email já tem conta. Entra com email e palavra-passe.")
        if existing.password_hash and not existing.is_verified:
            # Password set by someone who never proved the inbox (pre-registration hijack): drop it.
            existing.password_hash = None
        already = session.scalar(
            select(OAuthAccount).where(OAuthAccount.user_id == existing.id, OAuthAccount.provider == provider)
        )
        if not already:
            session.add(
                OAuthAccount(
                    id=uuid4(),
                    user_id=existing.id,
                    provider=provider,
                    provider_account_id=provider_id,
                    email=email,
                    created_at=stamp,
                    updated_at=stamp,
                )
            )
        if verified:
            existing.is_verified = True
        existing.last_login_at = stamp
        return existing, invite_next_path(request, home_path(existing.role), invite)

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Esta conta não partilhou o email. Autoriza o email ou usa outro método.",
        )

    user = create_pending_user(session, email=email, name=name, verified=verified)
    session.add(
        OAuthAccount(
            id=uuid4(),
            user_id=user.id,
            provider=provider,
            provider_account_id=provider_id,
            email=email,
            created_at=stamp,
            updated_at=stamp,
        )
    )
    return user, invite_next_path(request, "/escolher", invite)


@router.get("/status")
def auth_status():
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    payload = {
        "database": bool(settings.database_url.strip()),
        "google": bool(client_id),
        "coachSignupEnabled": settings.coach_signup_enabled,
    }
    if not settings.is_production:
        payload["googleMode"] = "redirect" if client_id else None
        payload["googleRedirectUri"] = google_redirect_uri() if client_id else None
        payload["clientId"] = client_id or None
    return payload


@router.get("/google/start")
def google_start(request: Request, invite: str = ""):
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Login Google ainda não está configurado.")
    verifier = pkce_verifier()
    state = secrets.token_urlsafe(24)
    # Only an explicit invite: a cookie left by an old invite link must not hijack a later plain login.
    invite_code = clean_text(invite or "", 12).upper()
    signed = sign_oauth_state(
        {
            "state": state,
            "verifier": verifier,
            "invite": invite_code,
            "exp": int(datetime.now(timezone.utc).timestamp()) + OAUTH_TTL_SECONDS,
        }
    )
    secure = settings.is_production or settings.app_url.startswith("https://")
    response = RedirectResponse(build_authorize_url(client_id=client_id, state=state, code_challenge=pkce_challenge(verifier)))
    response.set_cookie(
        OAUTH_COOKIE,
        signed,
        max_age=OAUTH_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    if invite_code:
        remember_invite(response, invite_code)
    return response


@router.get("/google/callback")
def google_callback(
    request: Request,
    session: Session = Depends(get_auth_session),
    code: str = "",
    state: str = "",
    error: str = "",
):
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Login Google ainda não está configurado.")
    if error:
        raise HTTPException(status_code=401, detail="Google recusou o login. Tenta outra vez.")
    stored = read_oauth_state(request.cookies.get(OAUTH_COOKIE))
    if not stored or not compare(str(stored.get("state") or ""), state):
        raise HTTPException(status_code=401, detail="Sessão Google expirada. Tenta outra vez.")
    try:
        token_payload = exchange_code(
            code=code,
            code_verifier=str(stored["verifier"]),
            client_id=client_id,
            client_secret=settings.google_client_secret,
        )
        id_token = str(token_payload.get("id_token") or "").strip()
        if not id_token:
            raise ValueError("missing_id_token")
        google = verify_google_id_token(id_token, client_id)
    except HTTPException:
        raise
    except Exception as exc:
        detail = "Google recusou o login. Tenta outra vez."
        if "invalid_client" in str(exc).lower() or "unauthorized_client" in str(exc).lower():
            detail = "Credenciais Google inválidas no servidor. Contacta o suporte."
        raise HTTPException(status_code=401, detail=detail) from exc
    invite = str(stored.get("invite") or "")
    email = normalize_email(str(google.get("email") or ""))
    name = str(google.get("name") or email or "Utilizador").strip()
    user, path = _finish_oauth(
        session,
        request,
        provider="google",
        provider_id=str(google["sub"]),
        email=email,
        name=name,
        verified=bool(google.get("email_verified")),
        invite=invite,
    )
    redirect = RedirectResponse(safe_app_path(path, "/escolher"), status_code=303)
    if invite:
        remember_invite(redirect, invite)
    issue_session(session, user, request, redirect)
    redirect.delete_cookie(OAUTH_COOKIE, path="/")
    return redirect


@router.post("/google")
def google_login(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    settings = get_settings()
    client_id = settings.google_client_id.strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Login Google ainda não está configurado.")
    invite = remember_invite(response, _body_invite(body) or request.cookies.get(INVITE_COOKIE))
    try:
        google = verify_google_id_token(str(body.get("credential") or ""), client_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Google recusou o login. Tenta outra vez.")
    email = normalize_email(str(google.get("email") or ""))
    name = str(google.get("name") or email or "Utilizador").strip()
    user, path = _finish_oauth(
        session,
        request,
        provider="google",
        provider_id=str(google["sub"]),
        email=email,
        name=name,
        verified=bool(google.get("email_verified")),
        invite=invite,
    )
    issue_session(session, user, request, response)
    return {"role": user.role, "next": safe_app_path(path, "/escolher")}


def _body_invite(body: dict) -> str:
    return clean_text(str(body.get("invite") or ""), 12).upper()


def _send_signup_confirmation(session: Session, user: User) -> str | None:
    raw = new_token(32)
    stamp = now()
    session.add(
        EmailVerificationToken(
            id=uuid4(),
            user_id=user.id,
            token_hash=sha256(raw),
            expires_at=stamp + timedelta(hours=24),
            created_at=stamp,
        )
    )
    path = f"/confirmar/{raw}"
    if not get_settings().is_production:
        return path
    origin = get_settings().app_url.rstrip("/")
    send_signup_confirmation(user.email or "", f"{origin}{path}")
    return None


@router.post("/register")
def register(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    email = normalize_email(clean_text(str(body.get("email") or ""), 254))
    password = str(body.get("password") or "")
    name = clean_text(str(body.get("name") or ""), 80) or (email.split("@")[0] if email else "")
    if not email or not valid_email(email) or not valid_password(password):
        raise HTTPException(status_code=400, detail="Email inválido ou palavra-passe fraca (mínimo 12, letras e números).")
    existing = find_user_by_email(session, email)
    if existing:
        # Checked before any write: HTTPException still commits the session.
        if existing.password_hash or existing.is_verified:
            raise HTTPException(status_code=409, detail="Este email já tem conta. Entra, ou usa Google.")
        existing.password_hash = hash_password(password)
        existing.last_login_at = now()
        if name and existing.id:
            profile = session.get(Profile, existing.id)
            if profile and (not profile.full_name or profile.full_name == "Utilizador"):
                profile.full_name = name[:80]
        remember_invite(response, _body_invite(body))
        confirm = _send_signup_confirmation(session, existing)
        payload = {"ok": True, "needsConfirmation": True, "next": "/confirmar-pendente"}
        if confirm:
            payload["confirmUrl"] = confirm
        return payload
    try:
        user = create_pending_user(session, email=email, name=name, verified=False, password_hash=hash_password(password))
        session.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Este email já tem conta. Entra, ou usa Google.")
    remember_invite(response, _body_invite(body))
    confirm = _send_signup_confirmation(session, user)
    payload = {"ok": True, "needsConfirmation": True, "next": "/confirmar-pendente"}
    if confirm:
        payload["confirmUrl"] = confirm
    return payload


@router.post("/login")
def login(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    email = normalize_email(clean_text(str(body.get("email") or ""), 254))
    password = str(body.get("password") or "")
    user = find_user_by_email(session, email)
    stamp = now()
    # One answer for "no account", "Google-only account", "locked" and "wrong password": the response must not
    # tell whether an email has an account. The same argon2 work runs in every case (timing).
    if not user or not user.password_hash:
        verify_password(password, None)
        raise HTTPException(status_code=401, detail=LOGIN_FAILED)
    ip = stored_ip(request)
    if login_locked(user, ip):
        verify_password(password, None)
        raise HTTPException(status_code=401, detail=LOGIN_FAILED)
    if not verify_password(password, user.password_hash):
        lock_or_fail(user, ip)
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Confirma o email antes de entrar.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desactivada.")
    user.failed_login_count = 0
    user.locked_until = None
    user.settings = {k: v for k, v in (user.settings or {}).items() if k != "login_lock_ips"}
    user.last_login_at = stamp
    invite = remember_invite(response, _body_invite(body))
    next_path = invite_next_path(request, issue_session(session, user, request, response), invite)
    return {"role": user.role, "next": safe_app_path(next_path)}


@router.post("/forgot")
def forgot_password(body: dict, session: Session = Depends(get_auth_session)):
    if is_honeypot(body):
        return {"ok": True}
    email = normalize_email(clean_text(str(body.get("email") or ""), 254))
    user = find_user_by_email(session, email)
    payload = {"ok": True}
    stamp = now()
    last = (
        session.scalar(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .order_by(PasswordResetToken.created_at.desc())
            .limit(1)
        )
        if user
        else None
    )
    # One email per few minutes per account, silently: the same answer either way, so no inbox flooding and no hint.
    recent = last is not None and stamp - last.created_at < RESEND_CONFIRM_COOLDOWN
    if user and user.is_active and not user.deleted_at and not recent:
        raw = new_token(32)
        session.add(
            PasswordResetToken(
                id=uuid4(),
                user_id=user.id,
                token_hash=sha256(raw),
                expires_at=stamp + timedelta(minutes=30),
                created_at=stamp,
            )
        )
        if not get_settings().is_production:
            payload["resetUrl"] = f"/repor/{raw}"
        else:
            origin = get_settings().app_url.rstrip("/")
            send_password_reset(email, f"{origin}/repor/{raw}")
    return payload


@router.post("/reset")
def reset_password(body: dict, response: Response, session: Session = Depends(get_auth_session)):
    if is_honeypot(body):
        return {"ok": True, "next": "/"}
    token = clean_text(str(body.get("token") or ""), 200)
    password = str(body.get("password") or "")
    if not token or not valid_password(password):
        raise HTTPException(status_code=400, detail="Link inválido ou palavra-passe fraca (mínimo 12, letras e números).")
    row = session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == sha256(token)))
    stamp = now()
    if not row or row.used_at or row.expires_at < stamp:
        raise HTTPException(status_code=400, detail="Este link já não é válido. Pede outro.")
    user = session.get(User, row.user_id)
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status_code=400, detail="Este link já não é válido. Pede outro.")
    user.password_hash = hash_password(password)
    user.is_verified = True  # the link reached the inbox
    user.failed_login_count = 0
    user.locked_until = None
    # Every outstanding link dies with this one: an older leaked email must not reset the new password.
    session.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=stamp)
    )
    revoke_user_sessions(session, user.id)
    clear_auth_cookies(response)
    return {"ok": True, "next": "/"}


@router.post("/confirm")
def confirm_email(body: dict, session: Session = Depends(get_auth_session)):
    token = clean_text(str(body.get("token") or ""), 200)
    if not token:
        raise HTTPException(status_code=400, detail="Link inválido.")
    row = session.scalar(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == sha256(token)))
    stamp = now()
    if not row or row.used_at or row.expires_at < stamp:
        raise HTTPException(status_code=400, detail="Este link já não é válido.")
    user = session.get(User, row.user_id)
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status_code=400, detail="Este link já não é válido.")
    user.is_verified = True
    row.used_at = stamp
    return {"ok": True, "next": "/"}


@router.post("/choose-role")
def choose_role(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    payload = current_user_payload(request)
    user = session.get(User, payload["sub"])
    if not user or not user.is_active or not token_is_current(payload, user):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    invite = remember_invite(response, _body_invite(body) or request.cookies.get(INVITE_COOKIE))
    user = provision_role(session, user, str(body.get("role") or ""), request, team_name=str(body.get("teamName") or ""))
    next_path = issue_session(session, user, request, response)
    if user.role == "swimmer":
        next_path = invite_next_path(request, next_path, invite)
    return {"role": user.role, "next": safe_app_path(next_path)}


@router.get("/join/{code}")
def preview_join(code: str, response: Response, session: Session = Depends(get_auth_session)):
    team = team_by_join_code(session, code)
    remember_invite(response, team.join_code)
    return {"valid": True, "code": team.join_code}


@router.get("/join/{code}/details")
def join_details(code: str, user: User = Depends(require_user), session: Session = Depends(get_auth_session)):
    team = team_by_join_code(session, code)
    return {"code": team.join_code, "teamName": team.name}


@router.post("/join/{code}")
def accept_join(code: str, request: Request, response: Response, user: User = Depends(require_user), session: Session = Depends(get_auth_session)):
    path = join_team(session, user, code, request)
    session.flush()
    issue_session(session, user, request, response)
    response.delete_cookie(INVITE_COOKIE, path="/")
    return {"role": user.role, "next": safe_app_path(path), "teamName": team_by_join_code(session, code).name}


@router.post("/leave-team")
def leave_team_route(request: Request, response: Response, user: User = Depends(require_user), session: Session = Depends(get_auth_session)):
    purge = request.query_params.get("purge") == "1"
    leave_team(session, user, request, purge=purge)
    session.flush()
    next_path = issue_session(session, user, request, response)
    return {"ok": True, "next": safe_app_path(next_path)}


@router.post("/resend-confirmation")
def resend_confirmation(body: dict, session: Session = Depends(get_auth_session)):
    email = normalize_email(clean_text(str(body.get("email") or ""), 254))
    payload = {"ok": True}
    if not email or not valid_email(email):
        return payload
    user = find_user_by_email(session, email)
    if user and user.password_hash and not user.is_verified and user.is_active and not user.deleted_at:
        last = session.scalar(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user.id)
            .order_by(EmailVerificationToken.created_at.desc())
        )
        stamp = now()
        if last and stamp - last.created_at < RESEND_CONFIRM_COOLDOWN:
            remaining = max(1, int((RESEND_CONFIRM_COOLDOWN - (stamp - last.created_at)).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail=f"Aguarda {max(1, (remaining + 59) // 60)} min antes de reenviar.",
                headers={"Retry-After": str(remaining)},
            )
        confirm = _send_signup_confirmation(session, user)
        if confirm:
            payload["confirmUrl"] = confirm
    return payload


@router.post("/change-password")
def change_password(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    form = parse_body(ChangePasswordBody, body)
    payload = current_user_payload(request)
    user = session.get(User, payload["sub"])
    if not user or not user.is_active or user.deleted_at or not token_is_current(payload, user):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    if not valid_password(form.newPassword):
        raise HTTPException(status_code=400, detail="Palavra-passe fraca (mínimo 12, letras e números).")
    if user.password_hash:
        if not form.currentPassword or not verify_password(form.currentPassword, user.password_hash):
            raise HTTPException(status_code=401, detail="Palavra-passe actual incorrecta.")
        if verify_password(form.newPassword, user.password_hash):
            raise HTTPException(status_code=400, detail="A nova palavra-passe tem de ser diferente.")
    else:
        iat = int(payload.get("auth_time") or 0)
        if time.time() - iat > get_settings().recent_auth_seconds:
            raise HTTPException(
                status_code=401,
                detail="Confirma identidade — termina sessão, entra outra vez e repete.",
            )
    user.password_hash = hash_password(form.newPassword)
    user.failed_login_count = 0
    user.locked_until = None
    revoke_user_sessions(session, user.id)
    issue_session(session, user, request, response)
    return {"ok": True}


@router.post("/delete-account")
def delete_account(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    form = parse_body(DeleteAccountBody, body)
    payload = current_user_payload(request)
    user = session.get(User, payload["sub"])
    if not user or not user.is_active or user.deleted_at or not token_is_current(payload, user):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    if user.password_hash:
        if not form.password or not verify_password(form.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Palavra-passe incorrecta.")
    else:
        iat = int(payload.get("auth_time") or 0)
        if time.time() - iat > get_settings().recent_auth_seconds:
            raise HTTPException(
                status_code=401,
                detail="Confirma identidade — termina sessão, entra outra vez e repete.",
            )
    delete_user_account(session, user, request)
    revoke_user_sessions(session, user.id)
    clear_auth_cookies(response)
    return {"ok": True, "next": "/"}


@router.post("/logout")
def logout(request: Request, response: Response, session: Session = Depends(get_auth_session)):
    presented = request.cookies.get(REFRESH_COOKIE)
    if presented:
        session.execute(
            update(RefreshToken).where(RefreshToken.token_hash == sha256(presented)).values(revoked_at=datetime.now(timezone.utc))
        )
    # The access token in the cookie dies too, not 15 min later (a copy of it would otherwise keep working).
    # The user's other devices get a 401, refresh, and carry on.
    access = read_access(request.cookies.get(ACCESS_COOKIE))
    if access:
        try:
            bump_token_version(session, UUID(str(access["sub"])))
        except (KeyError, ValueError):
            pass
    clear_auth_cookies(response)
    return {"ok": True}


@router.post("/refresh")
def refresh(request: Request, response: Response, session: Session = Depends(get_auth_session)):
    presented = request.cookies.get(REFRESH_COOKIE)
    if not presented:
        raise HTTPException(status_code=401, detail="Sem sessão.")
    user, token = rotate_refresh(session, presented, request)
    team_id, org_id = membership(session, user.id)
    access = sign_access(str(user.id), user.role, team_id, org_id, version=user.token_version)
    set_auth_cookies(response, access, token)
    return {"ok": True, "role": user.role, "next": safe_app_path(home_path(user.role))}


@router.get("/me")
def me(request: Request, session: Session = Depends(get_auth_session)):
    payload = current_user_payload(request)
    user = session.get(User, payload["sub"])
    if not user or not token_is_current(payload, user):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    profile = session.get(Profile, user.id)
    team_id, org_id = membership(session, user.id)
    team = session.get(Team, team_id) if team_id else None
    athlete = None
    if team_id and user.role == "swimmer":
        athlete = session.scalar(
            select(Athlete).where(Athlete.user_id == user.id, Athlete.team_id == team_id, Athlete.deleted_at.is_(None))
        )
    return {
        "id": str(user.id),
        "role": user.role,
        "email": user.email,
        "isVerified": user.is_verified,
        "hasPassword": bool(user.password_hash),
        "name": profile.full_name if profile else None,
        "teamId": team_id or None,
        "teamName": team.name if team else None,
        "orgId": org_id or None,
        "joinCode": team.join_code if team else None,
        "athleteId": str(athlete.id) if athlete else None,
        "next": home_path(user.role),
    }
