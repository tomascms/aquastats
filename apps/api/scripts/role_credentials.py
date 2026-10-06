"""Generate a database role password that never leaves this machine in clear text.

    python scripts/role_credentials.py ROLE HOST ENV_FILE ENV_KEY

* generates a random password (256 bits),
* writes ENV_KEY=postgresql://ROLE:<password>@HOST/neondb?sslmode=require into ENV_FILE (which git must ignore),
* prints ONLY the SCRAM-SHA-256 verifier, to be applied by the database owner:
      ALTER ROLE <role> LOGIN PASSWORD '<verifier>';
  A verifier is a salted hash: PostgreSQL stores it as is and never learns the password.

The password is never printed, logged or passed on a command line.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import subprocess
import sys
from pathlib import Path


def scram_verifier(password: str, iterations: int = 4096) -> str:
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    client_key = hmac.new(salted, b"Client Key", hashlib.sha256).digest()
    server_key = hmac.new(salted, b"Server Key", hashlib.sha256).digest()
    b64 = lambda raw: base64.b64encode(raw).decode()  # noqa: E731
    return f"SCRAM-SHA-256${iterations}:{b64(salt)}${b64(hashlib.sha256(client_key).digest())}:{b64(server_key)}"


def main(role: str, host: str, env_file: str, env_key: str) -> None:
    path = Path(env_file).resolve()
    ignored = subprocess.run(["git", "check-ignore", "-q", str(path)], cwd=path.parent, check=False).returncode == 0
    if not ignored:
        sys.exit(f"Refused: {path.name} is not ignored by git.")
    if not re.fullmatch(r"[a-z_]+", role) or not re.fullmatch(r"[a-z0-9.-]+", host) or not re.fullmatch(r"[A-Z_]+", env_key):
        sys.exit("Refused: unexpected role, host or key.")
    password = secrets.token_urlsafe(32)
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    text = re.sub(rf"^{env_key}=.*\n?", "", text, flags=re.M)
    if text and not text.endswith("\n"):
        text += "\n"
    text += f"{env_key}=postgresql://{role}:{password}@{host}/neondb?sslmode=require\n"
    path.write_text(text, encoding="utf-8")
    print(scram_verifier(password))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
