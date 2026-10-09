import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

// One module registry for both imports: the route and the injected dependency
// object must be the same module instance, or the test doubles never reach the route.
const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
});
const { POST, GET } = await jiti.import("./route.ts");
const { subagentsControlDeps, resetSubagentsControlDeps } = await jiti.import("@/lib/pi-subagents-control");

const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const previousTempRoot = process.env.PI_SUBAGENTS_TEMP_ROOT;
const agentDir = mkdtempSync(join(tmpdir(), "pi-web-subagents-runs-agent-"));
process.env.PI_CODING_AGENT_DIR = agentDir;

/**
 * A fixture run root holding one async run. `control/` and the pid fields are
 * opt-in, so a test can stand up the 0.76 layout and the legacy one.
 */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pi-web-subagents-runs-"));
  process.env.PI_SUBAGENTS_TEMP_ROOT = root;
  t.after(() => {
    process.env.PI_SUBAGENTS_TEMP_ROOT = previousTempRoot;
    rmSync(root, { recursive: true, force: true });
    resetSubagentsControlDeps();
  });

  function writeRun(runId, status, options = {}) {
    const runDir = join(root, "async-subagent-runs", runId);
    mkdirSync(join(runDir, "control", "steer-requests"), { recursive: true });
    mkdirSync(join(runDir, "control", "stop-requests"), { recursive: true });
    if (options.legacy) rmSync(join(runDir, "control"), { recursive: true, force: true });
    if (options.inboxClosed) writeFileSync(join(runDir, "control", "steer-inbox-closed.json"), "{}");
    if (options.stopInboxClosed) writeFileSync(join(runDir, "control", "stop-inbox-closed.json"), "{}");
    writeFileSync(join(runDir, "status.json"), JSON.stringify(status));
    return runDir;
  }
  return { root, writeRun, runDir: (runId) => join(root, "async-subagent-runs", runId) };
}

const runningRun = (overrides = {}) => ({
  runId: "run-1",
  mode: "single",
  state: "running",
  steps: [{ agent: "scout", status: "running" }],
  ...overrides,
});
async function post(body) {
  const response = await POST(new Request("http://localhost/api/subagents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}
async function get(runId) {
  const url = new URL("http://localhost/api/subagents/runs");
  if (runId !== undefined) url.searchParams.set("runId", runId);
  const response = await GET(new Request(url));
  return { status: response.status, body: await response.json() };
}

/** Replace the real signal/write/clock dependencies with test doubles. */
function inject(overrides) {
  Object.assign(subagentsControlDeps, {
    kill: () => {},
    writeJson: () => {},
    pidNamespaceScope: () => undefined,
    sleep: () => Promise.resolve(),
    now: () => 1_700_000_000_000,
    randomId: () => "req-1",
  }, overrides);
}

test.after(() => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  if (previousTempRoot === undefined) delete process.env.PI_SUBAGENTS_TEMP_ROOT;
  else process.env.PI_SUBAGENTS_TEMP_ROOT = previousTempRoot;
  rmSync(agentDir, { recursive: true, force: true });
});

test("pause writes the control inbox request and reports the flip it observed", async (t) => {
  const { writeRun, runDir } = fixture(t);
  const dir = writeRun("run-1", runningRun());
  let written;
  inject({
    writeJson: (path, value) => {
      written = { path, value };
      // The runner's inbox watcher pauses the run; the route must report that,
      // not the delivery attempt.
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify({ ...runningRun(), state: "paused" }));
    },
  });

  const { status, body } = await post({ runId: "run-1", action: "pause" });
  assert.equal(status, 200);
  assert.deepEqual(body, {
    ok: true,
    action: "pause",
    runId: "run-1",
    state: "paused",
    transitioned: true,
    mechanism: "control-inbox",
  });
  assert.equal(written.path, join(dir, "control", "interrupt.json"));
  assert.deepEqual(written.value, { type: "interrupt", ts: 1_700_000_000_000, source: "pi-web" });
});

test("pause reports an honest running state when the request did not land", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({ writeJson: () => {} });

  const { status, body } = await post({ runId: "run-1", action: "pause" });
  assert.equal(status, 200, "a delivered request that did not land is not an error");
  assert.equal(body.state, "running");
  assert.equal(body.transitioned, false);
  assert.equal(body.mechanism, "control-inbox");
});

test("pause falls back to the runner's signal when the run predates the inbox", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({ pid: 4242, pidNamespaceScope: "pid:[4026531836]" }), { legacy: true });
  const signals = [];
  inject({
    kill: (pid, signal) => signals.push([pid, signal]),
    pidNamespaceScope: () => "pid:[4026531836]",
  });

  const { status, body } = await post({ runId: "run-1", action: "pause" });
  assert.equal(status, 200);
  assert.equal(body.mechanism, "signal");
  assert.equal(body.transitioned, false);
  assert.deepEqual(signals, [[4242, process.platform === "win32" ? "SIGBREAK" : "SIGUSR2"]]);
});

test("pause refuses a legacy run without a pid and one whose pid cannot be verified", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-nopid", runningRun(), { legacy: true });
  inject({});
  let response = await post({ runId: "run-nopid", action: "pause" });
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "Run run-nopid has no control inbox and no usable pid.",
    code: "run_unsupported",
    reason: "no_pid",
  });

  writeRun("run-moved", runningRun({ pid: 4242, pidNamespaceScope: "pid:[4026531836]" }), { legacy: true });
  inject({ pidNamespaceScope: () => "pid:[4026539999]" });
  response = await post({ runId: "run-moved", action: "pause" });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "run_not_pausable");
  assert.equal(response.body.reason, "pid_unverifiable");
});

test("pause reports the signal failure that stopped it", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({ pid: 4242 }), { legacy: true });
  const failure = Object.assign(new Error("kill EPERM"), { code: "EPERM" });
  inject({ kill: () => { throw failure; } });

  const { status, body } = await post({ runId: "run-1", action: "pause" });
  assert.equal(status, 502);
  assert.equal(body.code, "interrupt_failed");
  assert.equal(body.reason, "eperm");
  assert.match(body.error, /kill EPERM/);
});

test("pause refuses a run that is not running", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({ state: "paused", steps: [{ agent: "scout", status: "paused" }] }));
  inject({});

  const { status, body } = await post({ runId: "run-1", action: "pause" });
  assert.equal(status, 409);
  assert.equal(body.code, "run_not_pausable");
  assert.equal(body.reason, "not_running");
});

test("stop writes the package's stop request and reports the flip it observed", async (t) => {
  const { writeRun, runDir } = fixture(t);
  const dir = writeRun("run-1", runningRun());
  let written;
  inject({
    writeJson: (path, value) => {
      written = { path, value };
      // The runner's stop handler ends the run for good; the route must report
      // that state, never a pause or a claimed stop it did not see.
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify({ ...runningRun(), state: "stopped" }));
    },
  });

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 200);
  assert.deepEqual(body, {
    ok: true,
    action: "stop",
    runId: "run-1",
    state: "stopped",
    transitioned: true,
    mechanism: "control-inbox",
  });
  // The file name is the package's contract: 13-digit padded ts, a uuid.
  assert.equal(written.path, join(dir, "control", "stop-requests", "1700000000000-req-1.json"));
  assert.deepEqual(written.value, { type: "stop", ts: 1_700_000_000_000, source: "pi-web" });
});

test("stop reports an honest running state when the request did not land", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({ writeJson: () => {} });

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 200, "a delivered request that did not land is not an error");
  assert.equal(body.state, "running");
  assert.equal(body.transitioned, false);
});

test("stop refuses a closed stop inbox, before it writes anything", async (t) => {
  const { writeRun, runDir } = fixture(t);
  writeRun("run-1", runningRun(), { stopInboxClosed: true });
  inject({});

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: "Run run-1 no longer accepts stop requests.",
    code: "stop_rejected",
    reason: "inbox_closed",
  });
  assert.deepEqual(readdirSync(join(runDir("run-1"), "control", "stop-requests")), []);
});

test("stop refuses a run that is not running", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({ state: "paused", steps: [{ agent: "scout", status: "paused" }] }));
  inject({});

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: "Run run-1 is paused, not running.",
    code: "stop_rejected",
    reason: "not_running",
  });
});

test("stop reports a failed write as stop_failed, never as a stop", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  const failure = Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
  inject({ writeJson: () => { throw failure; } });

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 502);
  assert.equal(body.code, "stop_failed");
  assert.equal(body.reason, "write_failed");
  assert.match(body.error, /ENOSPC/);
});

test("stop on a legacy run pauses it, and says so instead of claiming a stop", async (t) => {
  const { writeRun, runDir } = fixture(t);
  writeRun("run-1", runningRun({ pid: 4242, pidNamespaceScope: "pid:[4026531836]" }), { legacy: true });
  const signals = [];
  inject({
    kill: (pid, signal) => {
      signals.push([pid, signal]);
      // The pre-0.71 handler interrupts: the run pauses, it does not stop.
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify({
        ...runningRun({ pid: 4242, pidNamespaceScope: "pid:[4026531836]" }),
        state: "paused",
        steps: [{ agent: "scout", status: "paused" }],
      }));
    },
    pidNamespaceScope: () => "pid:[4026531836]",
  });

  const { status, body } = await post({ runId: "run-1", action: "stop" });
  assert.equal(status, 200);
  // The one handler a pre-0.71 runner has is its interrupt: it pauses, and the
  // response reports the paused state rather than a stop that never happened.
  assert.deepEqual(body, {
    ok: true,
    action: "stop",
    runId: "run-1",
    state: "paused",
    transitioned: true,
    mechanism: "signal",
  });
  assert.deepEqual(signals, [[4242, process.platform === "win32" ? "SIGBREAK" : "SIGUSR2"]]);
});

test("stop refuses a legacy run without a usable pid", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-nopid", runningRun(), { legacy: true });
  inject({});

  const { status, body } = await post({ runId: "run-nopid", action: "stop" });
  assert.equal(status, 409);
  assert.equal(body.code, "run_unsupported");
  assert.equal(body.reason, "no_pid");
});

test("steer on a running run writes the package's own request file and polls its receipt", async (t) => {
  const { writeRun, runDir } = fixture(t);
  const dir = writeRun("run-1", runningRun());
  let written;
  inject({
    writeJson: (path, value) => {
      written = { path, value };
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify(runningRun({
        steering: { requested: 1, recent: [{ id: "req-1", targets: [{ index: 0, state: "delivered" }] }] },
      })));
    },
  });

  const { status, body } = await post({ runId: "run-1", action: "steer", message: "  keep going  " });
  assert.equal(status, 200);
  // The file name is the package's contract: 13-digit padded ts, base64url id.
  assert.equal(
    written.path,
    join(dir, "control", "steer-requests", `1700000000000-${Buffer.from("req-1").toString("base64url")}.json`),
  );
  assert.deepEqual(written.value, {
    type: "steer",
    id: "req-1",
    ts: 1_700_000_000_000,
    message: "keep going",
    targetIndexes: [0],
    source: "pi-web",
  });
  assert.deepEqual(body, {
    ok: true,
    action: "steer",
    runId: "run-1",
    delivery: "control-inbox",
    requestId: "req-1",
    steeringState: "delivered",
    unsteerableSteps: [],
  });
});

test("steer reports an unobserved window instead of inventing a receipt", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({ writeJson: () => {} });

  const { status, body } = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(status, 200);
  assert.equal(body.steeringState, "unobserved");
});

test("steer reports queued while the child has not confirmed", async (t) => {
  const { writeRun, runDir } = fixture(t);
  // A chain: step 0 runs and takes the steer, step 1 is done and cannot.
  writeRun("run-1", runningRun({
    mode: "chain",
    steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "complete" }],
  }));
  inject({
    writeJson: () => {
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify({
        ...runningRun({ mode: "chain", steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "complete" }] }),
        steering: { requested: 1, recent: [{ id: "req-1", targets: [{ index: 0, state: "queued" }] }] },
      }));
    },
  });

  const { body } = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(body.steeringState, "queued");
  assert.deepEqual(body.unsteerableSteps, [1], "a step that is not running cannot take the steer");
});

test("steer refuses a closed inbox and a run with no steerable child", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-closed", runningRun(), { inboxClosed: true });
  inject({});
  let response = await post({ runId: "run-closed", action: "steer", message: "keep going" });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "steer_rejected");
  assert.equal(response.body.reason, "inbox_closed");

  writeRun("run-done", runningRun({ steps: [{ agent: "scout", status: "complete" }] }));
  response = await post({ runId: "run-done", action: "steer", message: "keep going" });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "steer_rejected");
  assert.equal(response.body.reason, "no_running_steps");

  writeRun("run-legacy", runningRun(), { legacy: true });
  response = await post({ runId: "run-legacy", action: "steer", message: "keep going" });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "run_unsupported");
  assert.equal(response.body.reason, "no_pid");
});

test("steer routes a paused run through a live parent session, never a fresh one", async (t) => {
  const { writeRun } = fixture(t);
  const parentPath = join(agentDir, "sessions", "--proj--", "2026-01-01T00-00-00-000Z_parent.jsonl");
  const paused = runningRun({ state: "paused", sessionId: parentPath, steps: [{ agent: "scout", status: "paused" }] });
  writeRun("run-1", paused);
  inject({});

  let response = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(response.status, 409, "no wrapper is alive in this server");
  assert.deepEqual(response.body, {
    error: "The parent session of run run-1 is not live in this server.",
    code: "parent_session_not_live",
    reason: "no_live_wrapper",
  });

  const previousRegistry = globalThis.__piSessions;
  const sent = [];
  globalThis.__piSessions = new Map([["parent-id", {
    isAlive: () => true,
    send: (command) => { sent.push(command); return Promise.resolve(null); },
  }]]);
  t.after(() => { globalThis.__piSessions = previousRegistry; });
  const { cacheSessionPath } = await jiti.import("@/lib/session-reader");
  cacheSessionPath("parent-id", parentPath);

  response = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, action: "steer", runId: "run-1", delivery: "parent-session", delivered: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "prompt");
  assert.match(sent[0].message, /action: "resume", id: "run-1", message: "keep going"/);
});

test("steer maps a live parent that refuses the send into a structured 502", async (t) => {
  const { writeRun } = fixture(t);
  const parentPath = join(agentDir, "sessions", "--proj--", "2026-01-01T00-00-00-000Z_parent.jsonl");
  const paused = runningRun({ state: "paused", sessionId: parentPath, steps: [{ agent: "scout", status: "paused" }] });
  writeRun("run-1", paused);
  inject({});

  // The wrapper can be alive when fetched but still refuse the send — a busy
  // turn, a lost admission race, a session copy in flight. That must answer
  // the ADR error shape, never a framework 500.
  const previousRegistry = globalThis.__piSessions;
  globalThis.__piSessions = new Map([["parent-id", {
    isAlive: () => true,
    send: () => Promise.reject(new Error("Cannot send a prompt while a shell command is running")),
  }]]);
  t.after(() => { globalThis.__piSessions = previousRegistry; });
  const { cacheSessionPath } = await jiti.import("@/lib/session-reader");
  cacheSessionPath("parent-id", parentPath);

  const response = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(response.status, 502);
  assert.equal(response.body.code, "steer_failed");
  assert.equal(response.body.reason, "send_failed");
  assert.match(response.body.error, /refused the steering prompt/);
});

test("steer refuses a dead, completed, or message-less request before it writes anything", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({ state: "complete", steps: [{ agent: "scout", status: "complete" }] }));
  inject({});
  let response = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(response.status, 409);
  assert.equal(response.body.reason, "no_running_steps");

  response = await post({ runId: "run-1", action: "steer" });
  assert.equal(response.status, 400);
  assert.equal(response.body.reason, "message_required");
  response = await post({ runId: "run-1", action: "steer", message: "   " });
  assert.equal(response.status, 400);
  assert.equal(response.body.reason, "message_required");
  response = await post({ runId: "run-1", action: "steer", message: "x".repeat(128 * 1024 + 1) });
  assert.equal(response.status, 400);
  assert.equal(response.body.reason, "steer_too_large");
  response = await post({ runId: "run-1", action: "walk" });
  assert.equal(response.status, 400);
  assert.equal(response.body.reason, "action_invalid");
});

test("rejects a run id that is not a directory name without touching the filesystem", async (t) => {
  const { root, writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({});

  for (const runId of [".", "..", "../run-1", "run 1", "run$", 7, undefined]) {
    const { status, body } = await post({ runId, action: "pause" });
    assert.equal(status, 400, String(runId));
    assert.equal(body.code, "invalid_request");
    assert.equal(body.reason, "run_id_invalid");
  }
  assert.equal(existsSync(join(root, "interrupt.json")), false);
});

test("distinguishes a missing package from a missing run", async (t) => {
  const { root, writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({});
  let response = await post({ runId: "run-gone", action: "pause" });
  assert.equal(response.status, 404);
  assert.equal(response.body.code, "run_not_found");
  assert.equal(response.body.reason, "no_status");

  process.env.PI_SUBAGENTS_TEMP_ROOT = join(root, "not-installed");
  response = await post({ runId: "run-1", action: "pause" });
  assert.equal(response.status, 404);
  assert.equal(response.body.reason, "no_run_roots");
});

test("answers a non-JSON body with the same structured refusal", async () => {
  const response = await POST(new Request("http://localhost/api/subagents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, "invalid_request");
  assert.equal(body.reason, "body_invalid");
});

test("leaves no request file behind when the steer was refused", async (t) => {
  const { writeRun, runDir } = fixture(t);
  writeRun("run-done", runningRun({ steps: [{ agent: "scout", status: "complete" }] }));
  inject({});

  await post({ runId: "run-done", action: "steer", message: "keep going" });
  assert.deepEqual(readdirSync(join(runDir("run-done"), "control", "steer-requests")), []);
});

test("steer with targetIndex writes the package's singular field, not the list", async (t) => {
  const { writeRun, runDir } = fixture(t);
  const dir = writeRun("run-1", runningRun({
    mode: "chain",
    steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "running" }],
  }));
  let written;
  inject({
    writeJson: (path, value) => {
      written = { path, value };
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify(runningRun({
        mode: "chain",
        steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "running" }],
        steering: { requested: 1, recent: [{ id: "req-1", targets: [{ index: 1, state: "delivered" }] }] },
    })));
    },
  });

  const { status, body } = await post({ runId: "run-1", action: "steer", message: "keep going", targetIndex: 1 });
  assert.equal(status, 200);
  // One viewed child, never the package's all-running default.
  assert.deepEqual(written.value, {
    type: "steer",
    id: "req-1",
    ts: 1_700_000_000_000,
    message: "keep going",
    targetIndex: 1,
    source: "pi-web",
  });
  assert.equal(written.path, join(dir, "control", "steer-requests", `1700000000000-${Buffer.from("req-1").toString("base64url")}.json`));
  assert.deepEqual(body.unsteerableSteps, [0], "the step the request did not target cannot take it");
});

test("steer refuses an out-of-range or finished targetIndex and a malformed one", async (t) => {
  const { writeRun, runDir } = fixture(t);
  writeRun("run-1", runningRun({
    mode: "chain",
    steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "complete" }],
  }));
  inject({});

  let response = await post({ runId: "run-1", action: "steer", message: "keep going", targetIndex: 9 });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "steer_rejected");
  assert.equal(response.body.reason, "target_out_of_range");

  response = await post({ runId: "run-1", action: "steer", message: "keep going", targetIndex: 1 });
  assert.equal(response.status, 409);
  assert.equal(response.body.reason, "target_not_steerable");

  for (const targetIndex of [-1, 1.5, "0", null, 1_000_001]) {
    response = await post({ runId: "run-1", action: "steer", message: "keep going", targetIndex });
    assert.equal(response.status, 400, String(targetIndex));
    assert.equal(response.body.reason, "target_index_invalid");
  }
  response = await post({ runId: "run-1", action: "pause", targetIndex: 0 });
  assert.equal(response.status, 400, "targetIndex belongs to steer only");
  assert.equal(response.body.reason, "target_index_invalid");
  assert.deepEqual(readdirSync(join(runDir("run-1"), "control", "steer-requests")), [], "a refused target writes nothing");
});

test("GET reports one run's observed state and per-step statuses, read-only", async (t) => {
  const { writeRun, runDir } = fixture(t);
  writeRun("run-1", runningRun({
    mode: "chain",
    steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "complete" }],
  }));
  inject({});

  const { status, body } = await get("run-1");
  assert.equal(status, 200);
  // The order of `steps` is what the chat indexes a steer with, so it must be the
  // artifact's own order, not a filtered one.
  assert.deepEqual(body, {
    ok: true,
    runId: "run-1",
    state: "running",
    mode: "chain",
    steps: ["running", "complete"],
    steering: [],
  });
  assert.deepEqual(readdirSync(join(runDir("run-1"), "control", "steer-requests")), [], "a read writes nothing");
});

test("GET carries each steer request's receipt, so a queued row can clear", async (t) => {
  const { writeRun } = fixture(t);
  writeRun("run-1", runningRun({
    stepIndex: 0,
    steering: {
      requested: 2,
      recent: [
        { id: "req-queued", targets: [{ index: 0, state: "queued" }] },
        { id: "req-done", targets: [{ index: 0, state: "delivered" }, { index: 1, state: "recovered" }] },
      ],
    },
  }));
  inject({});

  const { body } = await get("run-1");
  // Only the request id and its per-target states cross the wire: nothing the
  // chat does not need, and the same vocabulary the POST aggregates.
  assert.deepEqual(body.steering, [
    { requestId: "req-queued", states: ["queued"] },
    { requestId: "req-done", states: ["delivered", "recovered"] },
  ]);
});

test("GET refuses a bad run id and answers absence with the same shape as POST", async (t) => {
  const { root, writeRun } = fixture(t);
  writeRun("run-1", runningRun());
  inject({});

  // A query string cannot carry a non-string, so 7 would arrive as the (valid) id "7".
  for (const runId of [undefined, "", "..", "../run-1", "run 1"]) {
    const { status, body } = await get(runId);
    assert.equal(status, 400, String(runId));
    assert.equal(body.code, "invalid_request");
    assert.equal(body.reason, "run_id_invalid");
  }
  const numeric = await get(7);
  assert.equal(numeric.status, 404, "7 is read as the id \"7\", which has no run");
  assert.equal(numeric.body.reason, "no_status");

  let response = await get("run-gone");
  assert.equal(response.status, 404);
  assert.equal(response.body.reason, "no_status");

  process.env.PI_SUBAGENTS_TEMP_ROOT = join(root, "not-installed");
  response = await get("run-1");
  assert.equal(response.status, 404);
  assert.equal(response.body.reason, "no_run_roots");
});

test("steer on a chain without targetIndex still targets every running step", async (t) => {
  const { writeRun, runDir } = fixture(t);
  const dir = writeRun("run-1", runningRun({
    mode: "chain",
    steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "running" }],
  }));
  let written;
  inject({
    writeJson: (path, value) => {
      written = { path, value };
      writeFileSync(join(runDir("run-1"), "status.json"), JSON.stringify(runningRun({
        mode: "chain",
        steps: [{ agent: "scout", status: "running" }, { agent: "worker", status: "running" }],
        steering: { requested: 1, recent: [{ id: "req-1", targets: [{ index: 0, state: "delivered" }, { index: 1, state: "delivered" }] }] },
      })));
    },
  });

  const { status, body } = await post({ runId: "run-1", action: "steer", message: "keep going" });
  assert.equal(status, 200);
  assert.deepEqual(written.value.targetIndexes, [0, 1]);
  assert.equal(written.path, join(dir, "control", "steer-requests", `1700000000000-${Buffer.from("req-1").toString("base64url")}.json`));
  assert.deepEqual(body.unsteerableSteps, []);
});
