// Client side of the pi-subagents run bridge (docs/adr/0007-subagents-control-bridging.md).
// A child transcript's chat is the control surface: its Send steers the run and
// its Stop pauses it. Client-safe — types and fetch only, no node builtins — so
// the demo mirrors this file.
import type { PiSubagentRunState } from "./pi-subagents-snapshot";

/** The run states whose progress still changes, i.e. where Send means something. */
export function piSubagentRunLive(state: PiSubagentRunState | undefined): boolean {
  return state === "queued" || state === "running";
}

/**
 * Whether Stop can pause the run. The route's own pause guard is
 * `state === "running"` (a queued run has no runner to interrupt yet), so Stop is
 * offered only there; a queued run stays Send-only.
 */
export function piSubagentRunPausable(state: PiSubagentRunState | undefined): boolean {
  return state === "running";
}

/**
 * Send steers a run that is still going (live inbox) or paused (parent-mediated
 * resume). Any other state has no run behind it, so the composer falls back to a
 * normal prompt against the finished transcript.
 */
export function piSubagentRunSteerable(state: PiSubagentRunState | undefined): boolean {
  return piSubagentRunLive(state) || state === "paused";
}

/** One run's observed state, from the read-only GET the child chat polls. */
export interface PiSubagentRunStatus {
  ok: true;
  runId: string;
  state: PiSubagentRunState;
  mode: string;
  /** Per-step status in the artifact's own order — what `targetIndex` addresses. */
  steps: PiSubagentRunState[];
}

export interface PiSubagentRunFailure {
  error: string;
  code?: string;
  reason?: string;
}

export type PiSubagentRunStatusResult =
  | { ok: true; data: PiSubagentRunStatus }
  | { ok: false; status: number; failure: PiSubagentRunFailure };

export interface PiSubagentRunControlResult {
  ok: true;
  action: "pause" | "steer";
  runId: string;
  state?: string;
  transitioned?: boolean;
  mechanism?: string;
  delivery?: string;
  requestId?: string;
  steeringState?: string;
  unsteerableSteps?: number[];
  delivered?: boolean;
}

export type PiSubagentRunControlResponse =
  | { ok: true; data: PiSubagentRunControlResult }
  | { ok: false; status: number; failure: PiSubagentRunFailure };

function failureOf(status: number, body: Record<string, unknown>): { ok: false; status: number; failure: PiSubagentRunFailure } {
  return {
    ok: false,
    status,
    failure: {
      error: typeof body.error === "string" ? body.error : `HTTP ${status}`,
      ...(typeof body.code === "string" ? { code: body.code } : {}),
      ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
    },
  };
}

/** Read one run's state. A refusal is returned, not thrown; the run may simply be gone. */
export async function fetchPiSubagentRunStatus(
  runId: string,
  signal?: AbortSignal,
): Promise<PiSubagentRunStatusResult> {
  const response = await fetch(`/api/subagents/runs?runId=${encodeURIComponent(runId)}`, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) return failureOf(response.status, body);
  return { ok: true, data: body as unknown as PiSubagentRunStatus };
}

/**
 * Send one control action. `targetIndex` names the child this chat is showing,
 * so a chain steers exactly that transcript instead of every running step.
 */
export async function sendPiSubagentRunControl(
  runId: string,
  action: "pause" | "steer",
  options: { message?: string; targetIndex?: number } = {},
): Promise<PiSubagentRunControlResponse> {
  const response = await fetch("/api/subagents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId,
      action,
      ...(options.message !== undefined ? { message: options.message } : {}),
      ...(options.targetIndex !== undefined ? { targetIndex: options.targetIndex } : {}),
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) return failureOf(response.status, body);
  return { ok: true, data: body as unknown as PiSubagentRunControlResult };
}

/** One notice for a control outcome, from the fields the route actually returns. */
export function piSubagentRunControlNotice(
  result: PiSubagentRunControlResult,
  t: (key: string, params?: Record<string, string | number>) => string,
): { type: "info" | "error"; message: string } {
  if (result.action === "pause") {
    return {
      type: "info",
      message: result.transitioned ? t("chat.subagent.paused") : t("chat.subagent.pausePending"),
    };
  }
  if (result.delivery === "parent-session") {
    return { type: "info", message: t("chat.subagent.steerSent") };
  }
  // A refused delivery is the one outcome that is not "the runner has it": the
  // route reports it as a 200, so only this mapping keeps it from reading queued.
  if (result.steeringState === "failed") {
    return { type: "error", message: t("chat.subagent.steerFailed") };
  }
  return {
    type: "info",
    message: result.steeringState === "delivered"
      ? t("chat.subagent.steerDelivered")
      : t("chat.subagent.steerQueued"),
  };
}
