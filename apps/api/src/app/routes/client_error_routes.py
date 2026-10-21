"""JavaScript errors from the browser -> one structured log line (searchable in Cloud Logging).

No account needed (errors happen on the login page too). The CSRF origin check, the edge secret and the rate
limit apply as to any other write. Nothing personal is kept: no user, no IP, no query string; emails, long
tokens and ids in the route are masked.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

router = APIRouter(tags=["observability"])
log = logging.getLogger("aquastats.client_error")

_EMAIL = re.compile(r"[^\s@/\"'()<>]+@[^\s@/\"'()<>]+\.[A-Za-z]{2,}")
_TOKEN = re.compile(r"[A-Za-z0-9_\-]{40,}")  # session/JWT-like; script chunk names stay readable
_QUERY = re.compile(r"[?#][^\s)\"']*")
# A route segment that is an id (uuid, number, invite code with digits) becomes ":id".
_ID = re.compile(r"/(?=[^/]*\d)[^/]{6,}|/\d+(?=/|$)")


def _scrub(value: str, limit: int) -> str:
    value = _QUERY.sub("", value)
    value = _EMAIL.sub("[email]", value)
    return _TOKEN.sub("[token]", value)[:limit]


def clean_route(route: str) -> str:
    path = route.split("?", 1)[0].split("#", 1)[0]
    return _ID.sub("/:id", _EMAIL.sub("[email]", path))[:200]


class ClientError(BaseModel):
    route: str = Field("", max_length=2000)
    message: str = Field("", max_length=2000)
    stack: str = Field("", max_length=8000)


@router.post("/api/v1/client-errors", status_code=204)
def client_error(body: ClientError) -> Response:
    # "error", not "message": the JSON formatter already uses "message" for the log text.
    log.warning(
        "client error",
        extra={"fields": {"route": clean_route(body.route), "error": _scrub(body.message, 300), "stack": _scrub(body.stack, 2000)}},
    )
    return Response(status_code=204)
