// Bridging pause (interrupt), stop and steer to a pi-subagents async run, per
// docs/adr/0007-subagents-control-bridging.md. The package stays optional: this
// module imports nothing from it, reads only `status.json`, and writes only the
// package's own control inbox (`control/interrupt.json`,
// `control/steer-requests/`, `control/stop-requests/`) — never a state file.
// Delivery is never assumed: every action re-reads `status.json` briefly and
// reports what was observed.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { writePrivateFileAtomicSync } from "./atomic-file";
import {
  isValidAsyncRunId,
  readAsyncRunStatus,
  resolveAsyncRunLocation,
  resolveTempRoots,
  type PiSubagentRun,
  type PiSubagentRunLocation,
} from "./pi-subagents-runs";
import { getRpcSession } from "./rpc-manager";
import { resolveSessionIdByPath } from "./session-reader";

/** `status.json` goes through a 100 ms coalescer in the runner, so one re-read needs a beat. */
export const SUBAGENTS_RUN_POLL_INTERVAL_MS = 200;
/** ~2 s of polling: long enough for a coalesced flip, short enough for one HTTP request. */
export const SUBAGENTS_RUN_POLL_ATTEMPTS = 10;
/** The package's own transport limit (`MAX_STEER_MESSAGE_BYTES`). */
export const SUBAGENTS_MAX_STEER_MESSAGE_BYTES = 128 * 1024;
/** The package's own request id limit (`MAX_STEER_REQUEST_ID_LENGTH`). */
const MAX_STEER_REQUEST_ID_LENGTH = 256;
/** The runner registers this signal for its lifetime; win32 cannot deliver it cross-process. */
const INTERRUPT_SIGNAL: NodeJS.Signals = process.platform === "win32" ? "SIGBREAK" : "SIGUSR2";

export interface SubagentsControlResult {
  status: number;
  body: Record<string, unknown>;
}

/** Everything this module uses from the outside world, injectable for tests. */
export interface SubagentsControlDeps {
  /** Signal delivery for the legacy (pre-0.71) fallback arm. */
  kill(pid: number, signal: NodeJS.Signals): void;
  /** Atomic JSON write; the parent directory is created for the caller. */
  writeJson(path: string, value: unknown): void;
  /** The pid's current namespace scope, where the platform exposes one. */
  pidNamespaceScope(pid: number): string | undefined;
  sleep(ms: number): Promise<void>;
  now(): number;
  randomId(): string;
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writePrivateFileAtomicSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function currentPidNamespaceScope(pid: number): string | undefined {
  try {
    return readlinkSync(`/proc/${pid}/ns/pid`);
  } catch {
    return undefined;
  }
}

export const subagentsControlDeps: SubagentsControlDeps = {
  kill: (pid, signal) => process.kill(pid, signal),
  writeJson: writeJsonAtomically,
  pidNamespaceScope: currentPidNamespaceScope,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  randomId: () => randomUUID(),
};

/** Put every dependency back to its real implementation (tests only). */
export function resetSubagentsControlDeps(): void {
  subagentsControlDeps.kill = (pid, signal) => process.kill(pid, signal);
  subagentsControlDeps.writeJson = writeJsonAtomically;
  subagentsControlDeps.pidNamespaceScope = currentPidNamespaceScope;
  subagentsControlDeps.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  subagentsControlDeps.now = () => Date.now();
  subagentsControlDeps.randomId = () => randomUUID();
}

function fail(status: number, error: string, code: string, reason: string): SubagentsControlResult {
  return { status, body: { error, code, reason } };
}

function controlDir(runDir: string): string {
  return join(runDir, "control");
}

/** `control/steer-requests/<13-digit-padded-ts>-<base64url(id)>.json`, the package's own name. */
function steerRequestFileName(request: { ts: number; id: string }): string {
  return `${String(request.ts).padStart(13, "0")}-${Buffer.from(request.id).toString("base64url")}.json`;
}

/** `control/stop-requests/<13-digit-padded-ts>-<uuid>.json`, the package's own name. */
function stopRequestFileName(ts: number, id: string): string {
  return `${String(ts).padStart(13, "0")}-${id}.json`;
}

/**
 * The pid a legacy (pre-0.71) artifact can be signaled on, or the refusal to
 * report instead. Pause and stop share it: that layout has one signal handler,
 * so its `rejectCode` is the only thing that differs between them.
 */
function legacySignalPid(runId: string, run: PiSubagentRun, rejectCode: string): number | SubagentsControlResult {
  const pid = run.pid;
  if (pid === undefined || !Number.isInteger(pid) || pid <= 1) {
    return fail(409, `Run ${runId} has no control inbox and no usable pid.`, "run_unsupported", "no_pid");
  }
  // Recorded vs current scope must agree when both are present: a mismatch is
  // how a recycled pid is caught before it is signaled.
  const recorded = run.pidNamespaceScope;
  const current = subagentsControlDeps.pidNamespaceScope(pid);
  if (recorded && current && recorded !== current) {
    return fail(409, `Pid ${pid} of run ${runId} lives in another pid namespace.`, rejectCode, "pid_unverifiable");
  }
  return pid;
}

/** Re-read `status.json` until the run leaves `running` or the window closes. */
async function pollUntilNotRunning(
  location: PiSubagentRunLocation,
  initial: PiSubagentRun,
  deps: SubagentsControlDeps,
): Promise<PiSubagentRun> {
  let observed = initial;
  for (let attempt = 0; attempt < SUBAGENTS_RUN_POLL_ATTEMPTS && observed.state === "running"; attempt += 1) {
    await deps.sleep(SUBAGENTS_RUN_POLL_INTERVAL_MS);
    const next = readAsyncRunStatus(location.statusPath, location.runId);
    if (!next) break;
    observed = next;
  }
  return observed;
}

async function pause(runId: string, location: PiSubagentRunLocation, run: PiSubagentRun): Promise<SubagentsControlResult> {
  if (run.state !== "running") {
    return fail(409, `Run ${runId} is ${run.state}, not running.`, "run_not_pausable", "not_running");
  }

  let mechanism: "control-inbox" | "signal";
  if (existsSync(controlDir(location.runDir))) {
    // Package ≥ 0.71 (the live 0.76 layout): the inbox is authoritative and
    // portable, so the runner consumes it like any other supervisor's request.
    try {
      subagentsControlDeps.writeJson(join(controlDir(location.runDir), "interrupt.json"), {
        type: "interrupt",
        ts: subagentsControlDeps.now(),
        source: "pi-web",
      });
    } catch (error) {
      return fail(502, `Could not write the interrupt request for run ${runId}: ${error instanceof Error ? error.message : String(error)}`, "interrupt_failed", "write_failed");
    }
    mechanism = "control-inbox";
  } else {
    // Legacy artifact layout: the runner's signal handler is the only channel.
    const pid = legacySignalPid(runId, run, "run_not_pausable");
    if (typeof pid !== "number") return pid;
    try {
      subagentsControlDeps.kill(pid, INTERRUPT_SIGNAL);
    } catch (error) {
      const raw = (error as NodeJS.ErrnoException)?.code;
      const reason = raw === "EPERM" ? "eperm" : raw === "ESRCH" ? "esrch" : raw === "ENOSYS" ? "enosys" : String(raw ?? "unknown").toLowerCase();
      return fail(502, `Could not interrupt run ${runId}: ${error instanceof Error ? error.message : String(error)}`, "interrupt_failed", reason);
    }
    mechanism = "signal";
  }

  // A delivery attempt is not an outcome: the handler is guarded by
  // `state === "running"`, so report the state actually observed.
  const observed = await pollUntilNotRunning(location, run, subagentsControlDeps);
  return {
    status: 200,
    body: {
      ok: true,
      action: "pause",
      runId,
      state: observed.state,
      transitioned: observed.state !== "running",
      mechanism,
    },
  };
}

/**
 * HARD stop: the package's stop inbox ends the run (`status.json` `stopped`, not
 * resumable) where the interrupt inbox only pauses it. A legacy artifact has no
 * stop channel at all — its one handler is the interrupt — so that arm pauses
 * and reports the paused state it observed rather than claiming a stop.
 */
async function stop(runId: string, location: PiSubagentRunLocation, run: PiSubagentRun): Promise<SubagentsControlResult> {
  if (run.state !== "running") {
    return fail(409, `Run ${runId} is ${run.state}, not running.`, "stop_rejected", "not_running");
  }

  let mechanism: "control-inbox" | "signal";
  if (existsSync(controlDir(location.runDir))) {
    // The package refuses a stop once the runner closed its inbox, and checks the
    // marker first; so does this arm, before anything is written.
    const closedPath = join(controlDir(location.runDir), "stop-inbox-closed.json");
    if (existsSync(closedPath)) {
      return fail(409, `Run ${runId} no longer accepts stop requests.`, "stop_rejected", "inbox_closed");
    }
    const request = { type: "stop", ts: subagentsControlDeps.now(), source: "pi-web" };
    const requestPath = join(controlDir(location.runDir), "stop-requests", stopRequestFileName(request.ts, subagentsControlDeps.randomId()));
    try {
      subagentsControlDeps.writeJson(requestPath, request);
    } catch (error) {
      return fail(502, `Could not write the stop request for run ${runId}: ${error instanceof Error ? error.message : String(error)}`, "stop_failed", "write_failed");
    }
    // The runner may have finished between the check and the write; the package
    // takes such a request back, so a later revival cannot consume a stale stop.
    if (existsSync(closedPath)) {
      try {
        unlinkSync(requestPath);
      } catch {
        // Already gone; nothing left to take back.
      }
      return fail(409, `Run ${runId} no longer accepts stop requests.`, "stop_rejected", "inbox_closed");
    }
    mechanism = "control-inbox";
  } else {
    // Legacy artifact layout: no stop channel exists, so the signal pauses.
    const pid = legacySignalPid(runId, run, "stop_rejected");
    if (typeof pid !== "number") return pid;
    try {
      subagentsControlDeps.kill(pid, INTERRUPT_SIGNAL);
    } catch (error) {
      const raw = (error as NodeJS.ErrnoException)?.code;
      const reason = raw === "EPERM" ? "eperm" : raw === "ESRCH" ? "esrch" : raw === "ENOSYS" ? "enosys" : String(raw ?? "unknown").toLowerCase();
      return fail(502, `Could not stop run ${runId}: ${error instanceof Error ? error.message : String(error)}`, "stop_failed", reason);
    }
    mechanism = "signal";
  }

  const observed = await pollUntilNotRunning(location, run, subagentsControlDeps);
  return {
    status: 200,
    body: {
      ok: true,
      action: "stop",
      runId,
      state: observed.state,
      transitioned: observed.state !== "running",
      mechanism,
    },
  };
}

/**
 * Target indexes, mirroring the package's own steer action: every running step,
 * or the sole pending step of a single-step run. Null when nothing is steerable.
 */
function steerTargetIndexes(run: PiSubagentRun): number[] | null {
  const running = run.steps
    .map((step, index) => step.status === "running" ? index : undefined)
    .filter((index): index is number => index !== undefined);
  if (running.length > 0) return running;
  if (run.mode === "single" && run.steps[0]?.status === "queued") return [0];
  return null;
}

function validSteerRequest(request: { id: string; ts: number; message: string; targetIndex?: number; targetIndexes?: number[]; source: string }): boolean {
  return /^\S+$/.test(request.id)
    && request.id.length <= MAX_STEER_REQUEST_ID_LENGTH
    && Number.isFinite(request.ts)
    && request.ts > 0
    && Boolean(request.message.trim())
    && Buffer.byteLength(request.message, "utf8") <= SUBAGENTS_MAX_STEER_MESSAGE_BYTES
    // The package's own rule: one index or a list, never both.
    && (request.targetIndex !== undefined
      ? request.targetIndexes === undefined
        && Number.isInteger(request.targetIndex)
        && request.targetIndex >= 0
        && request.targetIndex <= 1_000_000
      : Array.isArray(request.targetIndexes)
        && request.targetIndexes.length > 0
        && request.targetIndexes.length <= 1_000
        && new Set(request.targetIndexes).size === request.targetIndexes.length
        && request.targetIndexes.every((index) => Number.isInteger(index) && index >= 0 && index <= 1_000_000))
    && Boolean(request.source.trim())
    && request.source.length <= 256;
}

async function steerRunning(
  runId: string,
  location: PiSubagentRunLocation,
  run: PiSubagentRun,
  message: string,
  /** The viewed child of a chain; absent means the package's own all-running set. */
  targetIndex?: number,
): Promise<SubagentsControlResult> {
  if (existsSync(join(controlDir(location.runDir), "steer-inbox-closed.json"))) {
    return fail(409, `Run ${runId} no longer accepts steering requests.`, "steer_rejected", "inbox_closed");
  }
  let targets: number[];
  if (targetIndex !== undefined) {
    // Mirror the package's steer action: the index must resolve to a child that
    // can still take a message, so one chain step is steered, not every running one.
    const step = run.steps[targetIndex];
    if (!step) {
      return fail(409, `Index ${targetIndex} is out of range for run ${runId}.`, "steer_rejected", "target_out_of_range");
    }
    if (step.status !== "running" && step.status !== "queued") {
      return fail(409, `Child ${targetIndex} of run ${runId} is ${step.status} and cannot be steered.`, "steer_rejected", "target_not_steerable");
    }
    targets = [targetIndex];
  } else {
    const auto = steerTargetIndexes(run);
    if (!auto) {
      return fail(409, `Run ${runId} has no running child to steer.`, "steer_rejected", "no_running_steps");
    }
    targets = auto;
  }

  const request = {
    type: "steer",
    id: subagentsControlDeps.randomId(),
    ts: subagentsControlDeps.now(),
    message: message.trim(),
    ...(targetIndex !== undefined ? { targetIndex } : { targetIndexes: targets }),
    source: "pi-web",
  };
  // The same validity rules the package enforces: a request it would discard is
  // a 400 here, never a file the runner silently drops.
  if (!validSteerRequest(request)) {
    return fail(400, "The steering request is malformed.", "invalid_request", "steer_too_large");
  }
  try {
    subagentsControlDeps.writeJson(join(controlDir(location.runDir), "steer-requests", steerRequestFileName(request)), request);
  } catch (error) {
    return fail(502, `Could not write the steering request for run ${runId}: ${error instanceof Error ? error.message : String(error)}`, "steer_failed", "write_failed");
  }

  // The runner records the request in `steering.recent[]` when it consumes it;
  // until it does, the window closed without evidence and the answer says so.
  let states: string[] | undefined;
  for (let attempt = 0; attempt <= SUBAGENTS_RUN_POLL_ATTEMPTS && states === undefined; attempt += 1) {
    if (attempt > 0) await subagentsControlDeps.sleep(SUBAGENTS_RUN_POLL_INTERVAL_MS);
    const next = readAsyncRunStatus(location.statusPath, runId);
    if (!next) break;
    states = next.steering?.find((candidate) => candidate.id === request.id)?.targets.map((target) => target.state);
  }
  const steeringState = states === undefined
    ? "unobserved"
    : states.includes("failed") ? "failed"
    : states.length > 0 && states.every((state) => state === "delivered" || state === "recovered" || state === "late")
      ? "delivered"
      : "queued";
  return {
    status: 200,
    body: {
      ok: true,
      action: "steer",
      runId,
      delivery: "control-inbox",
      requestId: request.id,
      steeringState,
      // Every step the request did not target: the runner never routes to those.
      unsteerableSteps: run.steps.map((_, index) => index).filter((index) => !targets.includes(index)),
    },
  };
}

/**
 * A paused run's runner is gone, and revival semantics live inside the package's
 * `resume` action, so this arm mediates through the launching parent session: a
 * live RPC session gets a prompt telling it to resume the run. Never
 * `startRpcSession` — starting a parent as a side effect of steering is out of scope.
 */
async function steerPaused(runId: string, run: PiSubagentRun, message: string, targetIndex?: number): Promise<SubagentsControlResult> {
  const parentPath = run.parentSessionPath;
  const parentId = parentPath ? await resolveSessionIdByPath(parentPath) : undefined;
  const parent = parentId ? getRpcSession(parentId) : undefined;
  if (!parent?.isAlive()) {
    return fail(409, `The parent session of run ${runId} is not live in this server.`, "parent_session_not_live", "no_live_wrapper");
  }
  // `resume` takes the same target params as the package's steer action, so the
  // viewed child of a chain is named by `index`; absent, the package picks.
  const target = targetIndex !== undefined ? `, index: ${targetIndex}` : "";
  const command = {
    type: "prompt",
    message: `[pi-web] Steer the paused pi-subagents run: call subagent({ action: "resume", id: ${JSON.stringify(runId)}${target}, message: ${JSON.stringify(message)} }).`,
  };
  try {
    await parent.send(command);
  } catch (error) {
    // The wrapper is alive when fetched but can still reject the send — a busy
    // turn, a serialized admission loss, a session copy in flight (the
    // rpc-manager refuses rather than queues in those states).
    return fail(502, `The parent session of run ${runId} refused the steering prompt: ${error instanceof Error ? error.message : String(error)}`, "steer_failed", "send_failed");
  }
  return { status: 200, body: { ok: true, action: "steer", runId, delivery: "parent-session", delivered: true } };
}

/**
 * One control action for one async run: every guard, refusal and poll window is
 * per the ADR's interface section. The caller only serializes the result.
 */
export async function subagentsControl(
  input: { runId: unknown; action: unknown; message?: unknown; targetIndex?: unknown },
): Promise<SubagentsControlResult> {
  if (!isValidAsyncRunId(input.runId)) {
    return fail(400, "runId must match [A-Za-z0-9._-]+ and not be a path segment.", "invalid_request", "run_id_invalid");
  }
  const runId = input.runId;
  if (input.action !== "pause" && input.action !== "steer" && input.action !== "stop") {
    return fail(400, 'action must be "pause", "steer" or "stop".', "invalid_request", "action_invalid");
  }
  let message = "";
  if (input.action === "steer") {
    if (typeof input.message !== "string" || !input.message.trim()) {
      return fail(400, "message is required to steer a run.", "invalid_request", "message_required");
    }
    if (Buffer.byteLength(input.message, "utf8") > SUBAGENTS_MAX_STEER_MESSAGE_BYTES) {
      return fail(400, "message exceeds 128 KiB.", "invalid_request", "steer_too_large");
    }
    message = input.message;
  }
  // The chat steers exactly the child it is showing, so a caller-supplied index
  // wins over the package's all-running default. One integer, per the package.
  let targetIndex: number | undefined;
  if (input.targetIndex !== undefined) {
    if (
      input.action !== "steer"
      || typeof input.targetIndex !== "number"
      || !Number.isInteger(input.targetIndex)
      || input.targetIndex < 0
      || input.targetIndex > 1_000_000
    ) {
      return fail(400, "targetIndex must be a non-negative integer and is only accepted for steer.", "invalid_request", "target_index_invalid");
    }
    targetIndex = input.targetIndex;
  }

  // Validation above never touches the filesystem; resolution is the first read.
  const location = resolveAsyncRunLocation(runId);
  if (!location) {
    const hasRoot = resolveTempRoots().some((root) => existsSync(root));
    return fail(404, `No pi-subagents async run '${runId}' was found.`, "run_not_found", hasRoot ? "no_status" : "no_run_roots");
  }
  const run = readAsyncRunStatus(location.statusPath, runId);
  if (!run) {
    return fail(404, `Run '${runId}' has no readable status.json.`, "run_not_found", "no_status");
  }

  if (input.action === "pause") return pause(runId, location, run);
  if (input.action === "stop") return stop(runId, location, run);
  if (run.state === "running") {
    if (!existsSync(controlDir(location.runDir))) {
      // Pre-0.71 artifact layout: no inbox to write, and signals cannot steer.
      return fail(409, `Run ${runId} predates the control inbox and cannot be steered.`, "run_unsupported", "no_pid");
    }
    return steerRunning(runId, location, run, message, targetIndex);
  }
  if (run.state === "paused") return steerPaused(runId, run, message, targetIndex);
  return fail(409, `Run ${runId} is ${run.state} and has no steerable child.`, "steer_rejected", "no_running_steps");
}

/**
 * One run's observed state, read-only: the chat gates its composer on this while
 * a child transcript is open, where no `subagent-async` widget of its own exists.
 * Same resolver and parser as the control actions, and the same refusal shape.
 */
export function subagentsRunStatus(input: { runId: unknown }): SubagentsControlResult {
  if (!isValidAsyncRunId(input.runId)) {
    return fail(400, "runId must match [A-Za-z0-9._-]+ and not be a path segment.", "invalid_request", "run_id_invalid");
  }
  const runId = input.runId;
  const location = resolveAsyncRunLocation(runId);
  if (!location) {
    const hasRoot = resolveTempRoots().some((root) => existsSync(root));
    return fail(404, `No pi-subagents async run '${runId}' was found.`, "run_not_found", hasRoot ? "no_status" : "no_run_roots");
  }
  const run = readAsyncRunStatus(location.statusPath, runId);
  if (!run) {
    return fail(404, `Run '${runId}' has no readable status.json.`, "run_not_found", "no_status");
  }
  // Step statuses let the chat gate the one child it shows; `mode` tells it
  // whether that child can be addressed by index at all.
  return { status: 200, body: { ok: true, runId, state: run.state, mode: run.mode, steps: run.steps.map((step) => step.status) } };
}
