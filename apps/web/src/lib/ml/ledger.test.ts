import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { flushQueuedPredictions, recordOrQueue, type LedgerItem } from "./ledger";

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
