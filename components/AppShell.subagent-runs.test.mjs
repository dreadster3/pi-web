import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

test("re-renders the Agents panel from every subagent run update", () => {
  const handlerSource = source.slice(
    source.indexOf("const handleSubagentRunsChange"),
    source.indexOf("const handleRunningSessionIdsChange"),
  );
  assert.match(handlerSource, /setSubagentRuns\(runs\)/);
  // A guard that only compares id/state drops label, activity and timestamps,
  // which freezes the progress line mid-run; ChatWindow's key already gates
  // identity churn, so no equality check belongs here.
  assert.doesNotMatch(handlerSource, /previous\.every/);
});

test("refetches the sessions list once per newly appearing live subagent run id", () => {
  const effectSource = source.slice(
    source.indexOf("const refreshedSubagentRunIdsRef"),
    source.indexOf("const [sessionKey, setSessionKey]"),
  );
  // The panel reads its family from the sessions list; a run spawned mid-turn is
  // absent from it, so the live widget must trigger exactly one refetch per id.
  assert.match(effectSource, /refreshedSubagentRunIdsRef\.current\.has\(run\.id\)/);
  assert.match(effectSource, /refreshedSubagentRunIdsRef\.current\.add\(run\.id\)/);
  assert.match(effectSource, /if \(appearing\) setRefreshKey\(\(k\) => k \+ 1\)/);
  // Terminal runs need no row, and `step:0`-style step ids are session-less
  // placeholders the run they belong to already covers.
  assert.match(effectSource, /isPiSubagentRunTerminal\(run\.state\)/);
  assert.match(effectSource, /if \(run\.kind === "step"\) continue/);
  // One bump per render, never a timer or a per-tick loop.
  assert.doesNotMatch(effectSource, /setInterval|setTimeout/);
});
