import assert from "node:assert/strict";
import { it } from "node:test";
import { formatRaceClock } from "./race";
import { parseTime } from "./race-analysis";

it("writes race times in the one app format and reads them back", () => {
  assert.equal(formatRaceClock(66.42), "1:06,42");
  assert.equal(formatRaceClock(28.7), "28,70");
  assert.equal(formatRaceClock(0), "—");
  for (const s of [28.7, 66.42, 285.62]) assert.equal(parseTime(formatRaceClock(s)), s);
});
