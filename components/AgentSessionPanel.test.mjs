import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AgentSessionPanel.tsx", import.meta.url), "utf8");

test("keeps the main session first and makes every agent session selectable", () => {
  const mainRow = source.indexOf("session={rootSession}");
  const subagentRows = source.indexOf("visibleSubagents.map");
  assert.ok(mainRow > 0);
  assert.ok(subagentRows > mainRow);
  assert.match(source, /onSelect=\{\(\) => onSelectSession\(rootSession\)\}/);
  assert.match(source, /onSelect=\{\(\) => onSelectSession\(session\)\}/);
  assert.match(source, /aria-selected=\{selected\}/);
});

test("sorts running subagents first and enables search only for larger families", () => {
  assert.match(source, /if \(aRunning !== bRunning\) return aRunning \? -1 : 1/);
  assert.match(source, /subagents\.length > 8/);
  assert.match(source, /relation\?\.description, relation\?\.profile, session\.name, session\.firstMessage/);
  assert.match(source, /maxHeight: "min\(58dvh, 480px\)"/);
});

test("renders as a compact left-positioned dropdown without a centered inner width", () => {
  assert.match(source, /borderLeft: "1px solid var\(--border\)"/);
  assert.match(source, /borderRadius: "0 0 6px 6px"/);
  assert.doesNotMatch(source, /maxWidth: 680/);
});

test("shows persisted completion states while live running state takes precedence", () => {
  assert.match(source, /const status: SubagentSessionStatus = running \|\| progress\?\.status === "running"/);
  assert.match(source, /t\(`agentSwitcher\.status\.\$\{status\}`\)/);
  assert.match(source, /status === "failed"/);
  assert.match(source, /status === "aborted" \|\| status === "interrupted"/);
});

test("surfaces per-run progress from the subagent-async snapshot while falling back to relation status", () => {
  // Live runs come in as an optional prop; without one the row keeps using
  // relation.status, so older sessions and the demo still render.
  assert.match(source, /liveRuns\?: PiSubagentSnapshotNode\[\]/);
  assert.match(source, /liveRuns = \[\]/);
  assert.match(source, /progress\?\.status \?\? relation\?\.status \?\? "completed"/);
  // Run id joins by the explicit relation.runId, then by path/name substring.
  assert.match(source, /session\.relation\.runId/);
  assert.match(source, /session\.path\.includes\(run\.id\)/);
  // Progress text reuses the existing rows/styles rather than a new panel.
  assert.match(source, /agentSwitcher\.run\.tool/);
  assert.match(source, /agentSwitcher\.run\.turns/);
  assert.match(source, /agentSwitcher\.run\.tools/);
  assert.match(source, /formatElapsed\(progress\.startedAt, progress\.endedAt \?\? Date\.now\(\)\)/);
});
