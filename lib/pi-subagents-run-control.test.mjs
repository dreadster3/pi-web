import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const {
  piSubagentRunControlNotice,
  piSubagentRunLive,
  piSubagentRunPausable,
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

test("Stop is offered only where the route can pause, which is a running run", () => {
  assert.equal(piSubagentRunPausable("running"), true);
  // A queued run has no runner yet — the route's pause guard refuses it, so the
  // composer stays Send-only rather than showing a Stop that cannot act.
  assert.equal(piSubagentRunPausable("queued"), false);
  assert.equal(piSubagentRunPausable("paused"), false);
  assert.equal(piSubagentRunPausable(undefined), false);
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
  assert.deepEqual(
    piSubagentRunControlNotice({ ok: true, action: "pause", runId: "r", transitioned: true }, t),
    { type: "info", message: "chat.subagent.paused" },
  );
  // A delivered interrupt that did not land is still a pause in flight, not a failure.
  assert.deepEqual(
    piSubagentRunControlNotice({ ok: true, action: "pause", runId: "r", transitioned: false }, t),
    { type: "info", message: "chat.subagent.pausePending" },
  );
  assert.deepEqual(
    piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", delivery: "parent-session", delivered: true }, t),
    { type: "info", message: "chat.subagent.steerSent" },
  );
  assert.deepEqual(
    piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", steeringState: "delivered" }, t),
    { type: "info", message: "chat.subagent.steerDelivered" },
  );
  // queued/unobserved read as "not confirmed yet" — never as model action.
  for (const steeringState of ["queued", "unobserved"]) {
    assert.deepEqual(
      piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", steeringState }, t),
      { type: "info", message: "chat.subagent.steerQueued" },
    );
  }
  // A refused child is a "failed" steeringState on a 200 response, so it must not
  // collapse into the queued line: it reads as an error, like a refused prompt.
  assert.deepEqual(
    piSubagentRunControlNotice({ ok: true, action: "steer", runId: "r", steeringState: "failed" }, t),
    { type: "error", message: "chat.subagent.steerFailed" },
  );
});
