"""Load test (local or staging, never production): 20 coaches timing for 60 s against the synthetic demo team.

    python scripts/load_test.py [API base, default http://127.0.0.1:8000/api/v1] [snapshot window days, default 42]

Mix per coach: 70 % PUT /times, 10 % GET /snapshot (window), 20 % GET /auth/me, 0.2-1 s between requests.
Needs the synthetic team (scripts/seed_synthetic.py) and the local demo password.
"""
import asyncio
import os
import random
import sys
import time
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seed_synthetic as seed  # noqa: E402

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api/v1"
if "aquastats.net" in BASE or "run.app" in BASE:
    sys.exit("Refused: load tests never run against production.")
DAYS = int(sys.argv[2]) if len(sys.argv) > 2 else 42
SINCE = (date.today() - timedelta(days=DAYS)).isoformat()
USERS, SECONDS = 20, 60


async def main():
    async with httpx.AsyncClient(base_url=BASE, headers={"Origin": "http://localhost:3000"}, timeout=30) as c:
        login = {"email": f"treinador@{seed.DEMO_DOMAIN}", "password": os.environ.get("DEMO_PASSWORD") or seed.LOCAL_DEMO_PASSWORD}
        (await c.post("/auth/login", json=login)).raise_for_status()
        snap = (await c.get(f"/snapshot?since={SINCE}")).json()
        w = sorted(snap["workouts"], key=lambda x: x["date"])[-1]
        cells = [(w["id"], b["id"], a) for b in w["blocks"] for a in w["athleteIds"]]
        lat, codes, stop = defaultdict(list), defaultdict(int), time.monotonic() + SECONDS

        async def user():
            while time.monotonic() < stop:
                r = random.random()
                s = time.perf_counter()
                if r < 0.7:
                    wid, bid, aid = random.choice(cells)
                    resp = await c.put("/times", headers={"Idempotency-Key": uuid.uuid4().hex}, json={
                        "workoutId": wid, "blockId": bid, "athleteId": aid, "repNumber": random.randint(1, 4),
                        "mm": 0, "ss": random.randint(28, 40), "cc": random.randint(0, 99),
                        "clientUpdatedAt": datetime.now(timezone.utc).isoformat()})
                    kind = "PUT /times"
                elif r < 0.8:
                    resp = await c.get(f"/snapshot?since={SINCE}")
                    kind = f"GET /snapshot ({DAYS} d)"
                else:
                    resp = await c.get("/auth/me")
                    kind = "GET /auth/me"
                lat[kind].append((time.perf_counter() - s) * 1000)
                codes[resp.status_code] += 1
                await asyncio.sleep(random.uniform(0.2, 1.0))  # a coach typing

        await asyncio.gather(*(user() for _ in range(USERS)))
    total = sum(codes.values())
    print(f"{USERS} users, {SECONDS} s, {total} requests ({total / SECONDS:.1f}/s), status {dict(codes)}")
    for kind, values in sorted(lat.items()):
        values.sort()
        p = lambda q: values[int(q * (len(values) - 1))]  # noqa: E731
        print(f"  {kind:24} n={len(values):5} p50={p(.5):7.1f} ms p95={p(.95):7.1f} ms p99={p(.99):7.1f} ms")


asyncio.run(main())
