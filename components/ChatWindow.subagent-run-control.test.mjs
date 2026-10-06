import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatWindowSource = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const hookSource = await readFile(new URL("../hooks/useAgentSession.ts", import.meta.url), "utf8");
const chatInputSource = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");

test("the child chat polls the run's own status and seeds from the sidebar row", () => {
  const controlSource = hookSource.slice(
    hookSource.indexOf("── pi-subagents run control"),
    hookSource.indexOf("const executeBash = useCallback"),
  );
  // The handle is the relation's run id: a child transcript with no async run
  // (a foreground child, or a removed run) keeps the plain prompt path.
  assert.match(controlSource, /session\?\.relation\?\.kind === "subagent" \? session\.relation\.runId : undefined/);
  assert.match(controlSource, /fetchPiSubagentRunStatus\(controlledRunId, current\.signal\)/);
  assert.match(controlSource, /setTimeout\(\(\) => void poll\(\), SUBAGENT_RUN_POLL_MS\)/);
  // A hidden tab has nothing to gate, and a fresh visible tab reads once immediately.
  assert.match(controlSource, /document\.visibilityState !== "visible"/);
  assert.match(controlSource, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(controlSource, /document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
  // The first paint reads the sidebar's status until a poll answers for this run.
  assert.match(controlSource, /session\.relation\.status === "running"/);
  // A failed read keeps the last known state instead of clearing the gate.
  assert.doesNotMatch(controlSource, /catch[\s\S]{0,80}setRunState\(null\)/);
  // A definitive refusal (404/400) stops the poll and clears the gate, so the
  // composer falls back to a plain prompt; a transient failure only retries.
  assert.match(
    controlSource,
    /else if \(result\.status === 404 \|\| result\.status === 400\) \{[\s\S]*?setRunState\(\{ runId: controlledRunId, state: null \}\)[\s\S]*?stopped = true;/,
  );
  assert.match(controlSource, /runState\.state \?\? undefined/);
});

test("a child chat's Send steers the run, and Stop pauses it", () => {
  const sendSource = hookSource.slice(
    hookSource.indexOf("const handleSend = useCallback"),
    hookSource.indexOf("const executeBash = useCallback"),
  );
  // A local gesture is dispatched before the redirect, so a bang or an unexpanded
  // slash command is never injected into the run as literal text.
  assert.match(
    sendSource,
    /if \(steering && isSlashCommandPrompt\) \{[\s\S]*?chat\.subagent\.commandOnly[\s\S]*?restoreSubmission\([\s\S]*?return;/,
  );
  assert.match(
    sendSource,
    /if \(isBashCommand\) \{[\s\S]*?executeBashRef\.current\?\.\(bashCmd, isExcluded\)[\s\S]*?return;/,
  );
  // The redirect precedes the main-chat running guard: the child wrapper is idle,
  // so a steer must not fall through to a duplicate prompt against it.
  assert.match(sendSource, /if \(steering && !isBashCommand\) \{[\s\S]*?sendRunControl\("steer"/);
  // The refusal is decided before the steer write, so no slash text can reach it.
  assert.ok(sendSource.indexOf("chat.subagent.commandOnly") < sendSource.indexOf('sendRunControl("steer"'));
  // The viewed child of a chain is addressed by its own step index.
  assert.match(sendSource, /targetIndex: controlledStepIndex/);
  // A refusal is restored to the composer, exactly like a rejected main-chat prompt.
  assert.match(sendSource, /if \(!result\.ok\) \{[\s\S]*?addNotice\(\{ type: "error", message: result\.failure\.error \}\)[\s\S]*?restoreSubmission\(/);

  const abortSource = hookSource.slice(
    hookSource.indexOf("const handleAbort = useCallback"),
    hookSource.indexOf("const handleFork = useCallback"),
  );
  assert.match(abortSource, /if \(controlledRunId && piSubagentRunPausable\(observedRunState\)\)[\s\S]*?sendRunControl\("pause"\)/);
  // The main-agent abort arms remain reachable for every other session.
  assert.match(abortSource, /sendAgentCommand\(sid, \{ type: "abort" \}\)/);
});

test("the composer shows Stop only while the run can be paused, and Esc mirrors it", () => {
  // ChatWindow drives the affordance from the hook's own pausable flag, not from
  // the streaming session: a child wrapper is idle while its run works.
  assert.match(chatWindowSource, /stopAffordance = sessionBusy \|\| subagentRunPausable/);
  assert.match(chatWindowSource, /registerAbortHandler\(stopAffordance \? handleAbort : null\)/);
  assert.match(chatWindowSource, /subagentRunPausable=\{subagentRunPausable\}/);
  assert.match(chatInputSource, /subagentRunPausable = false/);
  assert.match(chatInputSource, /\{\(isStreaming \|\| subagentRunPausable\) && \(/);
  assert.match(chatInputSource, /e\.key === "Escape" && !isComposing && \(isStreaming \|\| subagentRunPausable\) && onAbort/);
  // Stop is fed by the pause guard, not the live state: a queued run has no runner
  // to interrupt, so it stays Send-only.
  assert.match(hookSource, /piSubagentRunPausable\(observedRunState\)/);
  assert.match(hookSource, /subagentRunPausable: Boolean\(controlledRunId\) && piSubagentRunPausable\(observedRunState\)/);
});

test("a control response refetches the list the gate is seeded from", async () => {
  assert.match(hookSource, /onSubagentRunControl\?\.\(\)/);
  const appShellSource = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
  const callbackSource = appShellSource.slice(
    appShellSource.indexOf("const handleSubagentRunControl"),
    appShellSource.indexOf("const sessionScrollPositionsRef"),
  );
  assert.match(callbackSource, /setRefreshKey\(\(k\) => k \+ 1\)/);
  assert.match(appShellSource, /onSubagentRunControl=\{handleSubagentRunControl\}/);
});
