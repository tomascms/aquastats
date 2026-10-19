import assert from "node:assert/strict";
import { it } from "node:test";
import { verifyTurnstile } from "./turnstile";

it("only a token Cloudflare accepts passes; everything else fails closed", async () => {
  const answer = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  assert.equal(await verifyTurnstile("s", "t", "1.2.3.4", answer({ success: true })), true);
  assert.equal(await verifyTurnstile("s", "t", null, answer({ success: false })), false);
  assert.equal(await verifyTurnstile("s", null, null, answer({ success: true })), false);
  assert.equal(await verifyTurnstile("s", "t", null, answer({}, false)), false);
  assert.equal(await verifyTurnstile("s", "t", null, (async () => { throw new Error("down"); }) as unknown as typeof fetch), false);
});

it("a token solved on another hostname is refused; Cloudflare's test keys still pass", async () => {
  const answer = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
  const hosts = ["aquastats.net", "www.aquastats.net"];
  assert.equal(await verifyTurnstile("s", "t", null, answer({ success: true, hostname: "aquastats.net" }), hosts), true);
  assert.equal(await verifyTurnstile("s", "t", null, answer({ success: true, hostname: "evil.example" }), hosts), false);
  assert.equal(await verifyTurnstile("s", "t", null, answer({ success: true, hostname: "example.com", metadata: { result_with_testing_key: true } }), hosts), true);
});
