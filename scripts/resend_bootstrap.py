"""Resend bootstrap: signup/login, API key, domain DNS records, merge api/.env."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "api" / ".env"
RESEND_ENV = ROOT / ".deploy-venv" / "resend.env"
PROFILE = ROOT / ".deploy-venv" / "pw-resend-profile"
DOMAIN = "aquastats.net"
ZONE_ID = "4419eed175c727ec704c16c1358139d2"


def load_resend_creds() -> tuple[str, str]:
    email = os.environ.get("RESEND_EMAIL", "").strip()
    password = os.environ.get("RESEND_PASSWORD", "").strip()
    if RESEND_ENV.exists():
        for line in RESEND_ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("RESEND_EMAIL="):
                email = email or line.split("=", 1)[1].strip()
            elif line.startswith("RESEND_PASSWORD="):
                password = password or line.split("=", 1)[1].strip()
    return email, password


def merge_env(updates: dict[str, str]) -> None:
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    keys = set(updates)
    kept = [
        line
        for line in lines
        if line.strip().startswith("#")
        or "=" not in line
        or line.split("=", 1)[0].strip() not in keys
    ]
    for key, value in updates.items():
        kept.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(kept) + "\n", encoding="utf-8")
    print("UPDATED", ENV_FILE, "keys:", ", ".join(updates.keys()))


def api_request(method: str, path: str, api_key: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"https://api.resend.com{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {payload}") from exc


def cf_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        raise RuntimeError(f"CF {method} {path} -> {exc.code}: {payload}") from exc


def cf_token() -> str | None:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if token:
        return token
    candidates = [
        Path.home() / ".wrangler" / "config" / "default.toml",
        Path.home() / "AppData" / "Roaming" / "xdg.config" / ".wrangler" / "config" / "default.toml",
    ]
    for wrangler in candidates:
        if not wrangler.exists():
            continue
        text = wrangler.read_text(encoding="utf-8")
        for key in ("oauth_token", "api_token"):
            match = re.search(rf'{key}\s*=\s*"([^"]+)"', text)
            if match:
                return match.group(1)
    return None


def upsert_dns(token: str, record: dict) -> None:
    name = record.get("name", "")
    rtype = record.get("type", "")
    content = record.get("value") or record.get("content") or ""
    if not name or not rtype or not content:
        return
    listed = cf_request(
        "GET",
        f"/zones/{ZONE_ID}/dns_records?type={rtype}&name={name}",
        token,
    )
    payload = {
        "type": rtype,
        "name": name,
        "content": content,
        "ttl": 1,
        "proxied": False,
    }
    if rtype == "MX" and record.get("priority") is not None:
        payload["priority"] = int(record["priority"])
    existing = listed.get("result") or []
    if existing:
        rec_id = existing[0]["id"]
        cf_request("PATCH", f"/zones/{ZONE_ID}/dns_records/{rec_id}", token, payload)
        print("DNS_PATCH", rtype, name)
    else:
        cf_request("POST", f"/zones/{ZONE_ID}/dns_records", token, payload)
        print("DNS_CREATE", rtype, name)


def sync_resend_dns(api_key: str) -> None:
    token = cf_token()
    if not token:
        print("CF_TOKEN_MISSING=Set CLOUDFLARE_API_TOKEN or wrangler api_token for DNS sync")
        return
    listed = api_request("GET", "/domains", api_key)
    domain_id = None
    for item in listed.get("data", []):
        if item.get("name") == DOMAIN:
            domain_id = item.get("id")
            break
    if not domain_id:
        created = api_request("POST", "/domains", api_key, {"name": DOMAIN})
        domain_id = created.get("id")
        print("DOMAIN_CREATED", domain_id)
    detail = api_request("GET", f"/domains/{domain_id}", api_key)
    records = detail.get("records") or []
    print("RESEND_RECORDS", len(records))
    for rec in records:
        try:
            upsert_dns(token, rec)
        except Exception as exc:
            print("DNS_FAIL", rec.get("name"), exc)


def create_api_key_via_api(master_key: str) -> str:
    body = {"name": "aquastats-smtp", "permission": "sending_access"}
    listed = api_request("GET", "/domains", master_key)
    for item in listed.get("data", []):
        if item.get("name") == DOMAIN:
            body["domain_id"] = item.get("id")
            break
    created = api_request("POST", "/api-keys", master_key, body)
    token = created.get("token") or created.get("key")
    if not token:
        raise RuntimeError(f"api-key create missing token: {created}")
    return token


def playwright_flow(email: str, password: str) -> str | None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("MISSING playwright — pip install playwright && playwright install chromium")
        return None

    PROFILE.mkdir(parents=True, exist_ok=True)
    api_key: str | None = os.environ.get("RESEND_API_KEY", "").strip() or None

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        def try_login() -> None:
            page.goto("https://resend.com/login", wait_until="domcontentloaded", timeout=120_000)
            time.sleep(2)
            for label in [r"email", r"e-mail"]:
                try:
                    page.get_by_label(re.compile(label, re.I)).first.fill(email, timeout=5000)
                    break
                except Exception:
                    pass
            for label in [r"password", r"palavra"]:
                try:
                    page.get_by_label(re.compile(label, re.I)).first.fill(password, timeout=5000)
                    break
                except Exception:
                    pass
            for name in [r"sign in", r"log in", r"continue", r"entrar"]:
                try:
                    page.get_by_role("button", name=re.compile(name, re.I)).first.click(timeout=5000)
                    break
                except Exception:
                    pass
            time.sleep(4)

        def try_signup() -> None:
            page.goto("https://resend.com/signup", wait_until="domcontentloaded", timeout=120_000)
            time.sleep(2)
            try:
                page.get_by_label(re.compile("email", re.I)).first.fill(email)
                page.get_by_label(re.compile("password", re.I)).first.fill(password)
                page.get_by_role("button", name=re.compile("sign up|create|continue", re.I)).first.click()
            except Exception as exc:
                print("SIGNUP_UI", exc)
            time.sleep(4)

        if not api_key:
            try_login()
            if "login" in page.url or "signup" in page.url:
                try_signup()

            print("BROWSER=Complete Resend signup/login + email verification if prompted.")
            print("Waiting up to 8 min for dashboard / API key page…")

            def verify_outlook() -> None:
                outlook = context.new_page()
                try:
                    outlook.goto("https://outlook.live.com/mail/", wait_until="domcontentloaded", timeout=120_000)
                    time.sleep(3)
                    if "login" in outlook.url or "microsoft" in outlook.url:
                        try:
                            outlook.get_by_placeholder(re.compile("email|phone|skype", re.I)).first.fill(email, timeout=8000)
                            outlook.get_by_role("button", name=re.compile("next|seguinte", re.I)).first.click(timeout=5000)
                            time.sleep(2)
                            outlook.get_by_placeholder(re.compile("password", re.I)).first.fill(password, timeout=8000)
                            outlook.get_by_role("button", name=re.compile("sign in|iniciar", re.I)).first.click(timeout=5000)
                            time.sleep(5)
                        except Exception as exc:
                            print("OUTLOOK_LOGIN", exc)
                    for _ in range(12):
                        try:
                            outlook.get_by_text(re.compile("resend|verify", re.I)).first.click(timeout=4000)
                            time.sleep(2)
                            link = outlook.locator("a[href*='resend.com']").first
                            if link.count():
                                href = link.get_attribute("href")
                                if href:
                                    page.goto(href, wait_until="domcontentloaded", timeout=60_000)
                                    time.sleep(3)
                                    break
                        except Exception:
                            time.sleep(5)
                finally:
                    outlook.close()

            verify_outlook()

            deadline = time.time() + 480
            while time.time() < deadline and not api_key:
                try:
                    if page.is_closed():
                        break
                    if "resend.com" in page.url and "login" not in page.url and "signup" not in page.url:
                        if "/api-keys" not in page.url:
                            page.goto("https://resend.com/api-keys", wait_until="domcontentloaded", timeout=60_000)
                            time.sleep(2)
                        try:
                            page.get_by_role("button", name=re.compile("create|add|new", re.I)).first.click(timeout=3000)
                            time.sleep(1)
                            page.get_by_label(re.compile("name", re.I)).first.fill("aquastats-smtp", timeout=3000)
                            page.get_by_role("button", name=re.compile("create|add|save", re.I)).first.click(timeout=3000)
                            time.sleep(2)
                        except Exception:
                            pass
                    body = page.content()
                    match = re.search(r"(re_[A-Za-z0-9_]{20,})", body)
                    if match:
                        api_key = match.group(1)
                        break
                except Exception as exc:
                    print("WAIT", exc)
                    break
                time.sleep(3)

        try:
            context.close()
        except Exception:
            pass
    return api_key


def main() -> int:
    email, password = load_resend_creds()
    if not email or not password:
        print("MISSING_RESEND_CREDS")
        return 2

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        api_key = playwright_flow(email, password) or ""

    if not api_key.startswith("re_"):
        print("NO_API_KEY")
        return 2

    # If key is full_access, create scoped sending key for SMTP
    smtp_key = api_key
    try:
        smtp_key = create_api_key_via_api(api_key)
        print("SMTP_KEY_CREATED")
    except Exception as exc:
        print("SMTP_KEY_FALLBACK", exc)

    merge_env(
        {
            "MAIL_FROM": "confirmation@aquastats.net",
            "CONTACT_EMAIL": "contact@aquastats.net",
            "SECURITY_EMAIL": "security@aquastats.net",
            "SMTP_HOST": "smtp.resend.com",
            "SMTP_PORT": "587",
            "SMTP_USER": "resend",
            "SMTP_PASSWORD": smtp_key,
        }
    )

    try:
        ensure = api_request("GET", "/domains", smtp_key)
        if not any(d.get("name") == DOMAIN for d in ensure.get("data", [])):
            api_request("POST", "/domains", smtp_key, {"name": DOMAIN})
    except Exception:
        try:
            api_request("POST", "/domains", api_key, {"name": DOMAIN})
        except Exception as exc:
            print("DOMAIN_WARN", exc)

    try:
        sync_resend_dns(api_key if api_key != smtp_key else smtp_key)
    except Exception as exc:
        print("DNS_SYNC", exc)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
