import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { listAllSessions, invalidateSessionListCache } = await jiti.import("./session-reader.ts");
const { resetSessionScanIndexForTests } = await jiti.import("./session-list-scanner.ts");
const { registerSessionLivenessProvider } = await jiti.import("./session-liveness.ts");

const line = (entry) => JSON.stringify(entry) + "\n";
const RUN_ID = "11111111-2222-3333-4444-555555555555";
const CHILD_ID = "22222222-3333-4444-5555-666666666666";

function resetSessionState() {
  resetSessionScanIndexForTests();
  invalidateSessionListCache();
  globalThis.__piSessionPathCache = undefined;
  globalThis.__piPathToSessionIdCache = undefined;
}

function fixture(t) {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousTempRoot = process.env.PI_SUBAGENTS_TEMP_ROOT;
  const root = fs.mkdtempSync(join(tmpdir(), "pi-web-subagent-relation-"));
  const agentDir = join(root, "agent");
  const tempRoot = join(root, "temp");
  const projectDir = join(agentDir, "sessions", "--tmp-proj--");
  fs.mkdirSync(projectDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.PI_SUBAGENTS_TEMP_ROOT = tempRoot;
  resetSessionState();

  t.after(() => {
    resetSessionState();
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    if (previousTempRoot === undefined) delete process.env.PI_SUBAGENTS_TEMP_ROOT;
    else process.env.PI_SUBAGENTS_TEMP_ROOT = previousTempRoot;
    fs.rmSync(root, { recursive: true, force: true });
  });

  const parentBase = "2026-01-01T00-00-00-000Z_parent-id";
  const parentPath = join(projectDir, `${parentBase}.jsonl`);
  fs.writeFileSync(parentPath, [
    { type: "session", version: 3, id: "parent-id", cwd: "/tmp/proj", timestamp: "2026-01-01T00:00:00.000Z" },
    { type: "message", id: "p1", parentId: null, timestamp: "2026-01-01T00:00:00.000Z", message: { role: "user", content: "parent question" } },
  ].map(line).join(""));

  function writeChild(relativeSegments, { id = CHILD_ID, name, firstMessage = "do the task", parentSession } = {}) {
    const dir = join(projectDir, parentBase, ...relativeSegments);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = join(dir, "session.jsonl");
    const now = new Date().toISOString();
    const entries = [
      { type: "session", version: 3, id, cwd: "/tmp/proj", timestamp: now, ...(parentSession ? { parentSession } : {}) },
      { type: "model_change", id: "m1", parentId: null, timestamp: now, provider: "test", modelId: "test-model" },
      { type: "session_info", id: "s1", parentId: "m1", timestamp: now, ...(name ? { name } : {}) },
      { type: "message", id: "u1", parentId: "s1", timestamp: now, message: { role: "user", content: firstMessage } },
    ];
    fs.writeFileSync(filePath, entries.map(line).join(""));
    return filePath;
  }

  function writeRunStatus(runId, { state, sessionFile, sessionName, agent = "scout", description }) {
    const dir = join(tempRoot, "async-subagent-runs", runId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(join(dir, "status.json"), JSON.stringify({
      runId,
      sessionId: parentPath,
      mode: "single",
      state,
      steps: [{
        agent,
        ...(sessionName ? { sessionName } : {}),
        ...(description ? { description } : {}),
        sessionFile,
        status: state,
        currentTool: "read",
        turnCount: 2,
        toolCount: 5,
      }],
    }));
  }

  return { projectDir, parentBase, parentPath, writeChild, writeRunStatus };
}

test("derives a pi-subagents child relation with live status from its async run", async (t) => {
  const { parentPath, writeChild, writeRunStatus } = fixture(t);
  const childPath = writeChild([CHILD_ID, "run-0"], { name: `subagent-scout-${RUN_ID}-1` });
  writeRunStatus(RUN_ID, { state: "running", sessionFile: childPath, sessionName: "scout: Inspect the parser" });

  const sessions = await listAllSessions({ force: true });
  const child = sessions.find((session) => session.id === CHILD_ID);
  assert.ok(child, "nested child is listed");
  assert.equal(child.parentSessionId, "parent-id");
  assert.deepEqual(child.relation, {
    kind: "subagent",
    parentSessionId: "parent-id",
    parentSessionPath: parentPath,
    profile: "scout",
    description: "scout: Inspect the parser",
    status: "running",
    engine: "pi-subagents",
    runId: RUN_ID,
  });
});

test("derives a runId from the async-<runId> directory when no status file matches", async (t) => {
  const { writeChild } = fixture(t);
  writeChild([CHILD_ID, `async-${RUN_ID}`], { name: `subagent-worker-${RUN_ID}-1` });

  const child = (await listAllSessions({ force: true })).find((session) => session.id === CHILD_ID);
  assert.ok(child);
  assert.equal(child.relation?.kind, "subagent");
  assert.equal(child.relation.profile, "worker");
  assert.equal(child.relation.engine, "pi-subagents");
  assert.equal(child.relation.runId, RUN_ID);
  assert.equal(child.relation.status, "completed", "no status file for a foreground run reads as completed");
});

test("falls back to the active_agent prompt marker for the profile and the first message for the description", async (t) => {
  const { projectDir, parentBase, writeChild } = fixture(t);
  const childPath = writeChild([CHILD_ID, "run-0"], { name: undefined, firstMessage: "Summarize the docs" });
  // Append a system message carrying the `<active_agent name=...>` marker.
  const now = new Date().toISOString();
  fs.appendFileSync(childPath, line({
    type: "message",
    id: "sys1",
    parentId: "u1",
    timestamp: now,
    message: { role: "system", content: "", sections: { preamble: `<active_agent name="researcher"/>\n\nYou research.` } },
  }));
  assert.ok(fs.existsSync(join(projectDir, parentBase, CHILD_ID, "run-0", "session.jsonl")));

  const child = (await listAllSessions({ force: true })).find((session) => session.id === CHILD_ID);
  assert.ok(child);
  assert.equal(child.relation.profile, "researcher");
  assert.equal(child.relation.description, "Summarize the docs");
});

test("marks a recently-written foreground child running only while its parent session is live", async (t) => {
  const { writeChild } = fixture(t);
  // Freshly written transcript, no status.json.
  writeChild([CHILD_ID, "run-0"], { name: `subagent-scout-${RUN_ID}-1` });

  const inactive = (await listAllSessions({ force: true })).find((session) => session.id === CHILD_ID);
  assert.equal(inactive.relation?.status, "completed");

  const release = registerSessionLivenessProvider({
    name: "test-parent-live",
    sessionId: "parent-id",
    isActive: () => true,
  });
  t.after(release);
  invalidateSessionListCache();

  const running = (await listAllSessions({ force: true })).find((session) => session.id === CHILD_ID);
  assert.equal(running.relation?.status, "running");
});

test("keeps legacy pi-web subagent metadata untouched and does not reclassify it", async (t) => {
  const { projectDir, parentBase, parentPath } = fixture(t);
  // A legacy child that also sits in a nested pi-subagents-style directory: the
  // persisted `pi-web:subagent` entry must still win over layout inference.
  const dir = join(projectDir, parentBase, CHILD_ID, "run-0");
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const childPath = join(dir, "session.jsonl");
  fs.writeFileSync(childPath, [
    { type: "session", version: 3, id: CHILD_ID, cwd: "/tmp/proj", timestamp: now, parentSession: parentPath },
    {
      type: "custom",
      id: "meta1",
      parentId: null,
      timestamp: now,
      customType: "pi-web:subagent",
      data: {
        version: 1,
        parentSessionId: "parent-id",
        parentSessionPath: parentPath,
        parentToolCallId: "",
        profile: "Explore",
        description: "Inspect parser",
        task: "",
        runInBackground: false,
        createdAt: now,
        resourceSnapshot: { version: 1, appendSystemPrompt: [], tools: [], loadSkills: false, loadExtensions: false },
      },
    },
    { type: "message", id: "u1", parentId: "meta1", timestamp: now, message: { role: "user", content: "legacy task" } },
  ].map(line).join(""));

  const child = (await listAllSessions({ force: true })).find((session) => session.id === CHILD_ID);
  assert.ok(child);
  assert.deepEqual(child.relation, {
    kind: "subagent",
    parentSessionId: "parent-id",
    profile: "Explore",
    description: "Inspect parser",
    status: "interrupted",
  });
  assert.equal(child.relation.engine, undefined, "legacy relations never gain a pi-subagents engine tag");
});
