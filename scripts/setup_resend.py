"""Resend: signup/login, domain, API key → api/.env SMTP vars. Credentials via env only."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "api" / ".env"
PROFILE = ROOT / ".deploy-venv" / "pw-resend-profile"
DOMAIN = "aquastats.net"


def merge_env(updates: dict[str, str]) -> None:
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    keys = {k for k in updates}
    kept = [line for line in lines if not line.strip().startswith("#") and "=" in line and line.split("=", 1)[0].strip() not in keys]
    kept = [line for line in lines if line.strip().startswith("#") or "=" not in line or line.split("=", 1)[0].strip() not in keys]
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
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def ensure_domain(api_key: str) -> None:
    try:
        listed = api_request("GET", "/domains", api_key)
        for item in listed.get("data", []):
            if item.get("name") == DOMAIN:
                print("DOMAIN_EXISTS", DOMAIN, item.get("status"))
                return
    except Exception as exc:
        print("DOMAIN_LIST_WARN", exc)
    created = api_request("POST", "/domains", api_key, {"name": DOMAIN})
    print("DOMAIN_CREATED", json.dumps(created, indent=2))


def playwright_flow() -> str | None:
    email = os.environ.get("RESEND_EMAIL", "").strip()
    password = os.environ.get("RESEND_PASSWORD", "").strip()
    if not email or not password:
        print("MISSING RESEND_EMAIL / RESEND_PASSWORD env vars")
        return None
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Install playwright in .deploy-venv")
        return None

    PROFILE.mkdir(exist_ok=True)
    api_key: str | None = os.environ.get("RESEND_API_KEY", "").strip() or None

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            channel="chrome",
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        if not api_key:
            page.goto("https://resend.com/login", wait_until="domcontentloaded", timeout=120_000)
            time.sleep(2)
            if "login" in page.url:
                try:
                    page.get_by_label(re.compile("email", re.I)).fill(email)
                    page.get_by_label(re.compile("password", re.I)).fill(password)
                    page.get_by_role("button", name=re.compile("sign in|log in|continue", re.I)).click()
                    time.sleep(3)
                except Exception:
                    page.goto("https://resend.com/signup", wait_until="domcontentloaded")
                    time.sleep(2)
                    try:
                        page.get_by_label(re.compile("email", re.I)).fill(email)
                        page.get_by_label(re.compile("password", re.I)).fill(password)
                        page.get_by_role("button", name=re.compile("sign up|create|continue", re.I)).click()
                    except Exception as exc:
                        print("SIGNUP_MANUAL", exc)

            print("BROWSER=Complete Resend login/signup + create API key (Sending access) in the opened window.")
            print("Then paste API key starting with re_ in the terminal when prompted.")
            deadline = time.time() + 300
            while time.time() < deadline and not api_key:
                body = page.content()
                match = re.search(r"(re_[A-Za-z0-9_]{10,})", body)
                if match:
                    api_key = match.group(1)
                    break
                try:
                    api_key = input("RESEND API KEY (re_...): ").strip() or None
                except EOFError:
                    time.sleep(2)
        context.close()
    return api_key


def main() -> int:
    api_key = os.environ.get("RESEND_API_KEY", "").strip() or playwright_flow()
    if not api_key or not api_key.startswith("re_"):
        print("NO_API_KEY")
        return 2

    merge_env(
        {
            "MAIL_FROM": "confirmation@aquastats.net",
            "CONTACT_EMAIL": "contact@aquastats.net",
            "SECURITY_EMAIL": "security@aquastats.net",
            "SMTP_HOST": "smtp.resend.com",
            "SMTP_PORT": "587",
            "SMTP_USER": "resend",
            "SMTP_PASSWORD": api_key,
        }
    )
    try:
        ensure_domain(api_key)
        print("DNS=Add Resend domain records in Cloudflare DNS for aquastats.net (check Resend Domains page).")
    except Exception as exc:
        print("DOMAIN_SETUP", exc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
