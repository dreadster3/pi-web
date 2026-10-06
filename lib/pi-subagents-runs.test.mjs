import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  resolveTempRoots,
  readAsyncRunStatuses,
  isValidAsyncRunId,
  resolveAsyncRunLocation,
} = await jiti.import("./pi-subagents-runs.ts");
const {
  parseAsyncSnapshotWidgetLine,
  flattenPiSubagentSnapshot,
  hasLivePiSubagentRun,
  mapPiSubagentRunState,
  PI_SUBAGENTS_ASYNC_WIDGET_PREFIX,
} = await jiti.import("./pi-subagents-snapshot.ts");

function fixture(t) {
  const tmp = mkdtempSync(join(tmpdir(), "pi-web-subagents-runs-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  function writeRun(scope, runId, status) {
    const dir = join(tmp, scope, "async-subagent-runs", runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "status.json"), typeof status === "string" ? status : JSON.stringify(status));
    return dir;
  }
  return { tmp, writeRun };
}

test("resolves the configured temp root and otherwise globs every pi-subagents scope", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "a", { runId: "a", state: "running", steps: [] });
  writeRun("pi-subagents-uid-2000", "b", { runId: "b", state: "complete", steps: [] });
  mkdirSync(join(tmp, "unrelated-dir"), { recursive: true });

  assert.deepEqual(resolveTempRoots({ PI_SUBAGENTS_TEMP_ROOT: "/custom/root" }, tmp), ["/custom/root"]);
  assert.deepEqual(
    resolveTempRoots({}, tmp).sort(),
    [join(tmp, "pi-subagents-uid-1000"), join(tmp, "pi-subagents-uid-2000")].sort(),
  );
});

test("reads async run statuses and maps the runner state onto the panel's status vocabulary", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "run-complete", {
    runId: "run-complete",
    sessionId: "/sessions/--proj--/parent.jsonl",
    mode: "single",
    state: "complete",
    startedAt: 100,
    endedAt: 200,
    lastActivityAt: 190,
    currentTool: "read",
    turnCount: 3,
    toolCount: 7,
    steps: [
      {
        agent: "scout",
        sessionName: "scout: Find the thing",
        sessionFile: "/sessions/--proj--/parent/child/run-0/session.jsonl",
        status: "complete",
        workflowKey: "lane-1",
        currentTool: "grep",
        turnCount: 3,
        toolCount: 7,
      },
    ],
  });
  writeRun("pi-subagents-uid-1000", "run-stopped", { runId: "run-stopped", state: "stopped", steps: [] });
  writeRun("pi-subagents-uid-1000", "run-failed", { runId: "run-failed", state: "partial", steps: [] });
  writeRun("pi-subagents-uid-1000", "run-queued", { runId: "run-queued", state: "queued", steps: [] });

  const runs = readAsyncRunStatuses({ env: {}, tmp }).sort((a, b) => a.runId.localeCompare(b.runId));
  const byId = Object.fromEntries(runs.map((run) => [run.runId, run]));
  assert.deepEqual(Object.keys(byId).sort(), ["run-complete", "run-failed", "run-queued", "run-stopped"]);
  assert.equal(byId["run-complete"].status, "completed");
  assert.equal(byId["run-stopped"].status, "stopped");
  assert.equal(byId["run-failed"].status, "failed");
  assert.equal(byId["run-queued"].status, "running");
  assert.equal(byId["run-complete"].parentSessionPath, "/sessions/--proj--/parent.jsonl");
  assert.equal(byId["run-complete"].toolCount, 7);
  assert.equal(byId["run-complete"].steps[0].agent, "scout");
  assert.equal(byId["run-complete"].steps[0].sessionFile, "/sessions/--proj--/parent/child/run-0/session.jsonl");
  assert.equal(byId["run-complete"].steps[0].workflowKey, "lane-1");
  assert.equal(byId["run-complete"].steps[0].runId, undefined);
});

test("normalizes the on-disk step spellings `pending` and `completed`", (t) => {
  const { tmp, writeRun } = fixture(t);
  // Steps initialize as `pending` and readers accept both `complete` and
  // `completed`; neither spelling is a failure.
  writeRun("pi-subagents-uid-1000", "run-aliases", {
    runId: "run-aliases",
    state: "running",
    steps: [
      { agent: "scout", status: "pending" },
      { agent: "worker", status: "completed" },
      { agent: "verify", status: "complete" },
    ],
  });
  // A run-level `completed` normalizes too.
  writeRun("pi-subagents-uid-1000", "run-completed", { runId: "run-completed", state: "completed", steps: [] });

  const runs = readAsyncRunStatuses({ env: {}, tmp });
  const aliases = runs.find((run) => run.runId === "run-aliases");
  assert.deepEqual(aliases.steps.map((step) => step.status), ["queued", "complete", "complete"]);
  assert.equal(runs.find((run) => run.runId === "run-completed").status, "completed");
});

test("falls an unknown or absent step status back to the run state, not failure", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "run-fallback", {
    runId: "run-fallback",
    state: "running",
    steps: [{ agent: "scout", status: "exploded" }, { agent: "worker" }],
  });

  const run = readAsyncRunStatuses({ env: {}, tmp }).find((candidate) => candidate.runId === "run-fallback");
  assert.deepEqual(run.steps.map((step) => step.status), ["running", "running"]);
});

test("tolerates malformed, missing, and unknown-state status files", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "broken", "{ not json");
  writeRun("pi-subagents-uid-1000", "unknown", { runId: "unknown", state: "exploded", steps: [] });
  writeRun("pi-subagents-uid-1000", "not-object", "42");
  mkdirSync(join(tmp, "pi-subagents-uid-1000", "async-subagent-runs", "missing-file"), { recursive: true });

  const runs = readAsyncRunStatuses({ env: {}, tmp });
  assert.deepEqual(runs.map((run) => run.runId), ["unknown"]);
  assert.equal(runs[0].status, "failed");
});

test("parses a detached runner pid and its pid namespace scope when present", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "run-pid", { runId: "run-pid", state: "running", pid: 4242, pidNamespaceScope: "pid:[4026531836]", steps: [] });

  const run = readAsyncRunStatuses({ env: {}, tmp }).find((candidate) => candidate.runId === "run-pid");
  assert.equal(run.pid, 4242);
  assert.equal(run.pidNamespaceScope, "pid:[4026531836]");
});

test("leaves pid and namespace scope absent or unparsed when the artifact omits or mistypes them", (t) => {
  const { tmp, writeRun } = fixture(t);
  // A foreground run has neither; a package that changed the type must not be
  // read as a usable pid either.
  writeRun("pi-subagents-uid-1000", "run-none", { runId: "run-none", state: "running", steps: [] });
  writeRun("pi-subagents-uid-1000", "run-bad", { runId: "run-bad", state: "running", pid: "4242", pidNamespaceScope: 7, steps: [] });
  writeRun("pi-subagents-uid-1000", "run-zero", { runId: "run-zero", state: "running", pid: 0, steps: [] });

  const runs = readAsyncRunStatuses({ env: {}, tmp });
  for (const runId of ["run-none", "run-bad", "run-zero"]) {
    const run = runs.find((candidate) => candidate.runId === runId);
    assert.equal(run.pid, undefined, runId);
    assert.equal(run.pidNamespaceScope, undefined, runId);
  }
});

test("parses the steering lifecycle receipts a steer request is tracked through", (t) => {
  const { tmp, writeRun } = fixture(t);
  writeRun("pi-subagents-uid-1000", "run-steering", {
    runId: "run-steering",
    state: "running",
    steering: { requested: 1, recent: [{ id: "req-1", targets: [{ index: 0, state: "queued", routedAt: 5 }] }, "junk", { id: "" }] },
    steps: [],
  });

  const run = readAsyncRunStatuses({ env: {}, tmp }).find((candidate) => candidate.runId === "run-steering");
  assert.deepEqual(run.steering, [{ id: "req-1", targets: [{ index: 0, state: "queued" }] }]);
  assert.equal(readAsyncRunStatuses({ env: {}, tmp }).find((candidate) => candidate.runId === "run-none")?.steering, undefined);
});

test("validates run ids and resolves one run inside a resolved temp root", (t) => {
  const { tmp, writeRun } = fixture(t);
  const dir = writeRun("pi-subagents-uid-1000", "run-abc", { runId: "run-abc", state: "running", steps: [] });

  for (const bad of [".", "..", "a/b", "", "run id", "run$", 7, undefined, null]) {
    assert.equal(isValidAsyncRunId(bad), false, String(bad));
    assert.equal(resolveAsyncRunLocation(bad, { env: {}, tmp }), null, String(bad));
  }
  assert.equal(isValidAsyncRunId("run-abc"), true);

  const location = resolveAsyncRunLocation("run-abc", { env: {}, tmp });
  assert.ok(location);
  assert.equal(location.root, join(tmp, "pi-subagents-uid-1000"));
  assert.equal(location.runDir, dir);
  assert.equal(location.statusPath, join(dir, "status.json"));
  // A run with a directory but no status.json is not a run.
  assert.equal(resolveAsyncRunLocation("no-status", { env: {}, tmp }), null);

  writeRun("pi-subagents-uid-2000", "run-abc", { runId: "run-abc", state: "stopped", steps: [] });
  assert.equal(resolveAsyncRunLocation("run-abc", { env: {}, tmp }).statusPath, join(dir, "status.json"), "the first root holding the run wins");
});

test("maps every runner state into the four panel statuses", () => {
  assert.equal(mapPiSubagentRunState("queued"), "running");
  assert.equal(mapPiSubagentRunState("running"), "running");
  assert.equal(mapPiSubagentRunState("complete"), "completed");
  assert.equal(mapPiSubagentRunState("stopped"), "stopped");
  for (const state of ["failed", "partial", "paused", "rejected"]) {
    assert.equal(mapPiSubagentRunState(state), "failed", state);
  }
});

test("parses a pi-subagents async snapshot widget line and rejects unrelated input", () => {
  const snapshot = {
    kind: "pi-subagents.async-status-snapshot",
    version: 1,
    generatedAt: 1700000000000,
    runs: [
      {
        id: "run-1",
        kind: "subagent",
        label: "scout",
        state: "running",
        startedAt: 1699999999000,
        updatedAt: 1700000000000,
        activity: { state: "active", currentTool: "read", turnCount: 2, toolCount: 5 },
        children: [{ id: "step-1", kind: "step", label: "grep", state: "complete" }],
      },
    ],
  };
  const parsed = parseAsyncSnapshotWidgetLine(`${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify(snapshot)}`);
  assert.ok(parsed);
  assert.equal(parsed.kind, "pi-subagents.async-status-snapshot");
  assert.equal(parsed.runs.length, 1);
  assert.equal(parsed.runs[0].activity.currentTool, "read");
  assert.deepEqual(flattenPiSubagentSnapshot(parsed).map((node) => node.id), ["run-1", "step-1"]);

  assert.equal(parseAsyncSnapshotWidgetLine("plain status text"), null);
  assert.equal(parseAsyncSnapshotWidgetLine(`${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}not json`), null);
  assert.equal(parseAsyncSnapshotWidgetLine(JSON.stringify(snapshot)), null, "requires the prefix");
  assert.equal(parseAsyncSnapshotWidgetLine(`${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify({ ...snapshot, version: 2 })}`), null);
  assert.equal(parseAsyncSnapshotWidgetLine(`${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify({ ...snapshot, kind: "other" })}`), null);
});

test("parses the first complete snapshot line when the widget carries several", () => {
  const first = { kind: "pi-subagents.async-status-snapshot", version: 1, generatedAt: 1, runs: [] };
  const second = { kind: "pi-subagents.async-status-snapshot", version: 1, generatedAt: 2, runs: [] };
  const widget = [
    `${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify(first)}`,
    `${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify(second)}`,
  ].join("\n");
  assert.equal(parseAsyncSnapshotWidgetLine(widget).generatedAt, 1);

  // A malformed first line must not stop the scan from reaching a valid one.
  const recoverable = [
    `${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}{ not json`,
    `${PI_SUBAGENTS_ASYNC_WIDGET_PREFIX}${JSON.stringify(second)}`,
  ].join("\n");
  assert.equal(parseAsyncSnapshotWidgetLine(recoverable).generatedAt, 2);
});

test("reports whether a snapshot still has a non-terminal run", () => {
  const snapshotOf = (state, childState) => ({
    kind: "pi-subagents.async-status-snapshot",
    version: 1,
    generatedAt: 0,
    runs: [{ id: "r", kind: "subagent", label: "scout", state, ...(childState ? { children: [{ id: "step:0", kind: "step", label: "scout", state: childState }] } : {}) }],
  });
  assert.equal(hasLivePiSubagentRun(snapshotOf("running")), true);
  assert.equal(hasLivePiSubagentRun(snapshotOf("queued")), true);
  assert.equal(hasLivePiSubagentRun(snapshotOf("complete", "running")), true, "a live child keeps the snapshot live");
  assert.equal(hasLivePiSubagentRun(snapshotOf("complete")), false);
  assert.equal(hasLivePiSubagentRun(null), false);
});
