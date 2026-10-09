import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const chatWindowSource = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const hookSource = await readFile(new URL("../hooks/useAgentSession.ts", import.meta.url), "utf8");
const chatInputSource = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n.tsx");
const { ChatInput } = await jiti.import("./ChatInput.tsx");

/**
 * The rendered row, not the source: a live run's composer shows exactly the
 * main-agent gestures — Steer where Send sits, then Stop and Pause — and the
 * idle/main-session composer keeps Send alone.
 */
function renderComposer(props) {
  return renderToStaticMarkup(
    React.createElement(I18nProvider, null, React.createElement(ChatInput, { onSend() {}, onAbort() {}, ...props })),
  );
}

test("a live run's poll re-reads the child transcript, a terminal one does not", () => {
  const controlSource = hookSource.slice(
    hookSource.indexOf("── pi-subagents run control"),
    hookSource.indexOf("const executeBash = useCallback"),
  );
  const pollSource = controlSource.slice(
    controlSource.indexOf("const poll = async () =>"),
    controlSource.indexOf("const onVisibilityChange"),
  );
  // The detached runner appends to the child's `.jsonl` from another process
  // while this chat's own wrapper stays alive, so only a forced read reaches that
  // progress — inside the successful read, on the run's own state.
  assert.match(
    pollSource,
    /setSteerReceipts\(result\.data\.steering\)[\s\S]*?if \(piSubagentRunLive\(result\.data\.state\)\) \{[\s\S]*?loadSessionRef\.current\?\.\(sid, false, false, \{ force: true \}\)/,
  );
  // It re-reads the open child, never some other id, and only when no forced read
  // for that session is already in the air: the mount's own read and this poll's
  // share one fresh request, so one cycle can never start a second fetch of the
  // same transcript.
  assert.match(
    pollSource,
    /const sid = sessionIdRef\.current;\s*\n\s*if \(sid && !loadFlightsRef\.current\.has\(`force:\$\{sid\}`\)\) \{\s*\n\s*void loadSessionRef\.current\?\.\(sid, false, false, \{ force: true \}\)/,
  );
  // A run that is unknown, gone or terminal leaves the transcript alone: only
  // the 404/400 arm touches the gate, and nothing outside `result.ok` reloads.
  assert.doesNotMatch(pollSource, /else if \(result\.status === 404[\s\S]*?loadSessionRef/);
  // The same load the SSE settlement uses, reached through the ref that is
  // assigned from it after its definition — one single-flighted read, and the
  // same entry ids and tree state every other refresh path settles.
  assert.match(hookSource, /loadSessionRef\.current = loadSession;/);
  assert.match(hookSource, /piSubagentRunLive,/);
});

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

test("a child chat's Send steers the run, Stop stops it and Pause interrupts it", () => {
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
  // Attachments are refused and restored, never silently dropped: a steer carries
  // text only, so the notice names why and the whole submission returns.
  assert.match(
    sendSource,
    /if \(images\?\.length\) \{[\s\S]*?chat\.subagent\.textOnly[\s\S]*?restoreSubmission\(message, images, composerDraftKey\)[\s\S]*?return;/,
  );
  // A refusal is restored to the composer, exactly like a rejected main-chat prompt.
  assert.match(sendSource, /if \(!result\.ok\) \{[\s\S]*?addNotice\(\{ type: "error", message: result\.failure\.error \}\)[\s\S]*?restoreSubmission\(/);

  const abortSource = hookSource.slice(
    hookSource.indexOf("const handleAbort = useCallback"),
    hookSource.indexOf("const handleSubagentPause = useCallback"),
  );
  // Stop on a child chat is a hard stop, so a UI Stop never leaves a resumable
  // pause behind for the parent orchestrator to pick up.
  assert.match(abortSource, /if \(controlledRunId && piSubagentRunPausable\(observedRunState\)\)[\s\S]*?sendRunControl\("stop"\)/);
  // The main-agent abort arms remain reachable for every other session.
  assert.match(abortSource, /sendAgentCommand\(sid, \{ type: "abort" \}\)/);
  // The softer gesture sits beside it and keeps the resumable interrupt lane.
  const pauseSource = hookSource.slice(
    hookSource.indexOf("const handleSubagentPause = useCallback"),
    hookSource.indexOf("const handleFork = useCallback"),
  );
  assert.match(pauseSource, /sendRunControl\("pause"\)/);
  assert.match(hookSource, /handleSubagentPause,/);
});

test("the composer shows Stop and Pause only while the run can be acted on, and Esc mirrors Stop", () => {
  // ChatWindow drives the affordances from the hook's own pausable flag, not from
  // the streaming session: a child wrapper is idle while its run works.
  assert.match(chatWindowSource, /stopAffordance = sessionBusy \|\| subagentRunPausable/);
  assert.match(chatWindowSource, /registerAbortHandler\(stopAffordance \? handleAbort : null\)/);
  assert.match(chatWindowSource, /subagentRunPausable=\{subagentRunPausable\}/);
  // Pause is wired with the same gate as Stop, so the two state buttons cannot
  // disagree about whether the run is running.
  assert.match(chatWindowSource, /onSubagentPause=\{subagentRunPausable \? handleSubagentPause : undefined\}/);
  assert.match(chatInputSource, /subagentRunPausable = false/);
  assert.match(chatInputSource, /onSubagentPause/);
  assert.match(chatInputSource, /\{\(isStreaming \|\| subagentRunPausable\) && \(/);
  assert.match(chatInputSource, /e\.key === "Escape" && !isComposing && \(isStreaming \|\| subagentRunPausable\) && onAbort/);
  // The live-run branch keeps the main-agent gesture row: Steer in the send slot.
  assert.match(chatInputSource, /\{onSteer && steerButton\}/);
  assert.match(chatInputSource, /\) : subagentRunPausable \? \(/);
  assert.match(chatInputSource, /\{!isStreaming && onSubagentPause && \(/);
  // Both buttons are fed by the running-state guard, not the live state: a queued
  // run has no runner to interrupt, so it stays Send-only.
  assert.match(hookSource, /piSubagentRunPausable\(observedRunState\)/);
  assert.match(hookSource, /subagentRunPausable: Boolean\(controlledRunId\) && piSubagentRunPausable\(observedRunState\)/);
});

test("a live run renders Steer, Stop and Pause, and nothing else takes their place", () => {
  const live = renderComposer({ isStreaming: false, subagentRunPausable: true, onSubagentPause() {} });
  assert.match(live, />Steer</);
  assert.match(live, />Stop</);
  assert.match(live, />Pause</);
  // Steer replaces the Send button in a live run's slot, so the two gestures
  // cannot disagree about what Enter does.
  assert.doesNotMatch(live, />Send</);
  assert.match(live, /title="Stop the run for good \(not resumable\)"/);
  assert.match(live, /title="Pause the run; it stays resumable"/);
});

test("an idle composer keeps Send and shows no state buttons", () => {
  const idle = renderComposer({ isStreaming: false });
  assert.match(idle, />Send</);
  assert.doesNotMatch(idle, />Steer</);
  assert.doesNotMatch(idle, />Pause</);
  assert.doesNotMatch(idle, />Stop</);
});

test("a streaming main session keeps its own Stop and never borrows the run's Pause", () => {
  const streaming = renderComposer({ isStreaming: true, subagentRunPausable: true, onSteer() {}, onSubagentPause() {} });
  assert.match(streaming, />Stop</);
  assert.match(streaming, /title="Stop agent"/);
  // The Pause button belongs to a run-backed child chat; a streaming main session
  // has the queued-steer lane and its own abort instead.
  assert.doesNotMatch(streaming, />Pause</);
});

test("a queued steer renders above the transcript and clears on the runner's receipt", () => {
  // The row is the main agent's queued affordance reused: same kind chip and text.
  const queued = renderComposer({
    isStreaming: false,
    subagentRunPausable: true,
    onSubagentPause() {},
    pendingSteers: [{ requestId: "req-1", message: "look at the parser too" }],
  });
  assert.match(queued, /look at the parser too/);
  assert.match(queued, />steer</, "it reads as a steer, like the main chat's queued row");
  // No recall button: the run owns these messages, not this composer.
  assert.doesNotMatch(queued, /Recall to input/);

  // The receipt cleared the row, so nothing queued is rendered at all.
  const cleared = renderComposer({ isStreaming: false, subagentRunPausable: true, onSubagentPause() {}, pendingSteers: [] });
  assert.doesNotMatch(cleared, /look at the parser too/);
  assert.doesNotMatch(cleared, />steer</);
});
test("the hook keeps pending steers ephemeral and reconciles them on each poll", () => {
  // Pending steers live only in this mount: no persistence call touches them.
  assert.match(hookSource, /const \[pendingSteers, setPendingSteers\] = useState<PiSubagentPendingSteer\[\]>\(\[\]\)/);
  // A queued steer is recorded when the route says the runner accepted it.
  assert.match(
    hookSource,
    /result\.data\.delivery === "control-inbox" && result\.data\.steeringState === "queued"[\s\S]*?addPendingSteer\(/,
  );
  // The poll's receipts are what clear it, and a delivered one refetches the
  // transcript that now holds the message.
  assert.match(hookSource, /setSteerReceipts\(result\.data\.steering\)/);
  assert.match(
    hookSource,
    /const delivery = piSubagentSteerDelivery\(status, steer\.requestId\)[\s\S]*?if \(delivery === "delivered"\) \{[\s\S]*?void loadSession\(session\.id\)/,
  );
  // A refusal clears the row and reuses the same error notice as a refused send.
  assert.match(hookSource, /else if \(translate\) \{[\s\S]{0,80}chat\.subagent\.steerFailed/);
  // The composer receives them only for the run-backed chat it is showing.
  assert.match(hookSource, /pendingSubagentSteers: controlledRunId \? pendingSteers : \[\]/);
  assert.match(chatWindowSource, /pendingSteers=\{pendingSubagentSteers\}/);
  assert.match(chatInputSource, /\{pendingSteers\?\.map\(\(steer\) => \(/);
  assert.match(chatInputSource, /<QueuedMessageRow key=\{steer\.requestId\} kind="steer" text=\{steer\.message\} \/>/);
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
