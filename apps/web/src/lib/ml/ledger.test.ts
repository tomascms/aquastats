import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { flushQueuedPredictions, healthAlerts, recordOrQueue, type LedgerItem, type Outcome } from "./ledger";

const item: LedgerItem = {
  athleteId: "a",
  workoutId: "w",
  blockId: "b2",
  repNumber: 1,
  targetDate: "2026-10-06",
  meanS: 31.2,
  loS: 30.6,
  hiS: 31.9,
  nominal: 0.8,
  sdS: 0.5,
  confidence: "média",
  details: {},
};

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const realFetch = globalThis.fetch;
let storage: MemoryStorage;
let calls: string[];

beforeEach(() => {
  storage = new MemoryStorage();
  calls = [];
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const offline = () => {
  globalThis.fetch = (async () => {
    throw new TypeError("network down");
  }) as typeof fetch;
};
const online = (status = 200) => {
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(init?.body ?? ""));
    return new Response(JSON.stringify(status === 200 ? { recorded: 1 } : { detail: "Previsão inválida." }), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
};

describe("ledger offline queue", () => {
  it("keeps predictions on the device when the network fails, and sends them later", async () => {
    offline();
    await recordOrQueue("estado", "challenger", [item]);
    assert.ok(storage.getItem("aq_ledger_queue"), "queued");
    online();
    assert.equal(await flushQueuedPredictions(), 1);
    assert.equal(storage.getItem("aq_ledger_queue"), null, "queue emptied");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /"model":"estado"/);
  });

  it("does not retry what the server already answered, even with a refusal", async () => {
    online(400);
    await recordOrQueue("estado", "challenger", [item]);
    assert.equal(storage.getItem("aq_ledger_queue"), null);
  });

  it("keeps a batch queued while the network is still down", async () => {
    offline();
    await recordOrQueue("atual", "champion", [item]);
    assert.equal(await flushQueuedPredictions(), 0);
    assert.ok(storage.getItem("aq_ledger_queue"));
  });
});

describe("health alerts (what would justify reverting the shown model)", () => {
  const week = (w: number, i: number) => new Date(Date.UTC(2026, 0, 5 + w * 7 + (i % 5))).toISOString().slice(0, 10);
  const make = (weeks: number, perWeek: number, at: (w: number, i: number) => { errorPct: number; inside: boolean }) => {
    const out: Outcome[] = [];
    for (let w = 0; w < weeks; w += 1) {
      for (let i = 0; i < perWeek; i += 1) {
        const { errorPct, inside } = at(w, i);
        out.push({ id: `${w}-${i}`, athleteId: "a", model: "estado", date: week(w, i), repKey: `${w}-${i}`, meanS: 30, loS: 29, hiS: 31, sdS: 0.8, actualS: 30, errorPct, inside, crpsPct: null, logId: `${w}-${i}` });
      }
    }
    return out;
  };
  // Errors alternate in sign around a typical size; 80 % inside the interval.
  const healthy = (w: number, i: number) => ({ errorPct: (i % 2 ? 1 : -1) * (1 + (i % 3) * 0.3), inside: i % 5 !== 0 });

  it("says nothing when the model behaves as it claims, or with too little data", () => {
    assert.deepEqual(healthAlerts(make(12, 20, healthy), 0.8), []);
    assert.deepEqual(healthAlerts(make(2, 20, (w, i) => ({ errorPct: 5, inside: i % 2 === 0 })), 0.8), []);
  });

  it("flags intervals that miss far more often than they say", () => {
    const alerts = healthAlerts(make(12, 20, (w, i) => (w >= 8 ? { ...healthy(w, i), inside: i % 5 < 2 } : healthy(w, i))), 0.8);
    assert.ok(alerts.some((alert) => alert.kind === "coverage"));
  });

  it("flags errors that lean to one side", () => {
    const alerts = healthAlerts(make(12, 20, (w, i) => (w >= 8 ? { errorPct: 2 + (i % 3) * 0.2, inside: true } : healthy(w, i))), 0.8);
    assert.ok(alerts.some((alert) => alert.kind === "bias"));
  });

  it("flags an error that grew against the weeks before", () => {
    const alerts = healthAlerts(make(12, 20, (w, i) => (w >= 8 ? { errorPct: (i % 2 ? 1 : -1) * 2.2, inside: i % 5 !== 0 } : healthy(w, i))), 0.8);
    assert.ok(alerts.some((alert) => alert.kind === "drift"));
  });
});
