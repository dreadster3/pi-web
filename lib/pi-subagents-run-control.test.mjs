import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const {
  piSubagentRunControlNotice,
  piSubagentRunLive,
  piSubagentRunSteerable,
} = await jiti.import("./pi-subagents-run-control.ts");

test("Stop is offered only while the run's own progress can still change", () => {
  assert.equal(piSubagentRunLive("running"), true);
  assert.equal(piSubagentRunLive("queued"), true);
  // A paused run's runner is dead, so pausing it again has nothing to interrupt;
  // the pause guard in the route agrees (`state === "running"`).
  assert.equal(piSubagentRunLive("paused"), false);
  assert.equal(piSubagentRunLive("complete"), false);
  assert.equal(piSubagentRunLive(undefined), false);
});

test("Send steers a live or paused run, and nothing else", () => {
  assert.equal(piSubagentRunSteerable("running"), true);
  // Paused routes through parent-session mediation, so it is still steerable.
  assert.equal(piSubagentRunSteerable("paused"), true);
  // Terminal states have no run behind them: the composer falls back to a prompt.
  assert.equal(piSubagentRunSteerable("complete"), false);
  assert.equal(piSubagentRunSteerable("failed"), false);
  assert.equal(piSubagentRunSteerable(undefined), false);
});

test("a control notice names what the route actually observed", () => {
  const t = (key) => key;
  assert.equal(
    piSubagentRunControlNotice({ ok: true, action: "pause", runId: "r", transitioned: true }, t),
    "chat.subagent.paused",
  );
  // A delivered interrupt that did not land is still a pause in flight, not a failure.
  assert.equal(
    piSubagentRunControlNotice({ ok: true, action: "pause", runId: "r", transitioned: false }, t),
    "chat.subagent.pausePending",
  );
  assert.equal(
    piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", delivery: "parent-session", delivered: true }, t),
    "chat.subagent.steerSent",
  );
  assert.equal(
    piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", steeringState: "delivered" }, t),
    "chat.subagent.steerDelivered",
  );
  // queued/failed/unobserved all read as "not confirmed yet" — never as model action.
  for (const steeringState of ["queued", "failed", "unobserved"]) {
    assert.equal(
      piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", steeringState }, t),
      "chat.subagent.steerQueued",
    );
  }
});
