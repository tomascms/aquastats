"""Give the API roles the passwords that role_credentials.py wrote into an env file, on a NON-production branch.

    python scripts/apply_role_passwords.py TARGET_ENV_FILE OWNER_URL_ENV_FILE

Reads DATABASE_URL / AUTH_DATABASE_URL (role + password + host) from TARGET_ENV_FILE and the owner's URL from
OWNER_URL_ENV_FILE (DATABASE_URL), connects as the owner to the TARGET host (Neon branches inherit their
parent's role passwords) and runs ALTER ROLE ... LOGIN PASSWORD over TLS. Nothing secret is printed. Refuses the
production endpoint: production passwords are set by the operator in Phase G.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

PRODUCTION_ENDPOINTS = ("ep-rough-unit-b1cgm5pl",)
ROLES = {"DATABASE_URL": "aquastats_api", "AUTH_DATABASE_URL": "aquastats_auth"}


def _env(path: str) -> dict[str, str]:
    values = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
        if match:
            values[match.group(1)] = match.group(2).strip().strip('"').strip("'")
    return values


def main(target_file: str, owner_file: str) -> None:
    target, owner = _env(target_file), _env(owner_file)
    owner_url = owner.get("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://", 1)
    for key, role in ROLES.items():
        parts = urlsplit(target[key])
        host = (parts.hostname or "").lower()
        if parts.username != role or any(host.startswith(e) for e in PRODUCTION_ENDPOINTS):
            sys.exit(f"Refused for {key}: wrong role or production host.")
        owned = urlsplit(owner_url)
        netloc = f"{owned.username}:{owned.password}@{host}"
        with psycopg.connect(urlunsplit(("postgresql", netloc, "/neondb", "sslmode=require", "")), autocommit=True) as conn:
            if conn.execute("select current_setting('server_version_num')").fetchone() is None:
                sys.exit("no server")
            conn.execute(sql.SQL("ALTER ROLE {} LOGIN PASSWORD {}").format(sql.Identifier(role), sql.Literal(parts.password)))
        print(f"ok {role}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
