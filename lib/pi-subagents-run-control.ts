// Client side of the pi-subagents run bridge (docs/adr/0007-subagents-control-bridging.md).
// A child transcript's chat is the control surface: its Send steers the run, its
// Stop hard-stops it and its Pause interrupts it. Client-safe — types and fetch
// only, no node builtins.
import type { PiSubagentRunState } from "./pi-subagents-snapshot";

/** The run states whose progress still changes, i.e. where Send means something. */
export function piSubagentRunLive(state: PiSubagentRunState | undefined): boolean {
  return state === "queued" || state === "running";
}

/**
 * Whether the run behind this chat can be stopped or paused. The route's own
 * guards are `state === "running"` for both: a queued run has no runner to
 * interrupt yet, and a terminal one has nothing left to end. A queued run stays
 * Send-only.
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

/** One steer request's receipt, as the read-only GET reports it. */
export interface PiSubagentSteerReceipt {
  requestId: string;
  /** Per-target delivery state, in the artifact's own order. */
  states: string[];
}

/** One run's observed state, from the read-only GET the child chat polls. */
export interface PiSubagentRunStatus {
  ok: true;
  runId: string;
  state: PiSubagentRunState;
  mode: string;
  /** Per-step status in the artifact's own order — what `targetIndex` addresses. */
  steps: PiSubagentRunState[];
  /** `steering.recent[]`, so a queued steer row can clear on the runner's receipt. */
  steering?: PiSubagentSteerReceipt[];
}

/** One steer this chat sent and the run has not confirmed yet. */
export interface PiSubagentPendingSteer {
  runId: string;
  requestId: string;
  message: string;
}

export type PiSubagentSteerDelivery = "delivered" | "failed" | "queued";

/**
 * The run's own receipt for one steer request, aggregated exactly like the POST's
 * `steeringState`: every targeted child delivered (or recovered/late) is
 * delivered, any refusal is failed, and no receipt yet still reads as queued —
 * accepted by the runner, not confirmed. Never model action.
 */
export function piSubagentSteerDelivery(
  status: Pick<PiSubagentRunStatus, "steering">,
  requestId: string,
): PiSubagentSteerDelivery {
  const receipt = status.steering?.find((entry) => entry.requestId === requestId);
  if (!receipt) return "queued";
  if (receipt.states.includes("failed")) return "failed";
  return receipt.states.length > 0
    && receipt.states.every((state) => state === "delivered" || state === "recovered" || state === "late")
    ? "delivered"
    : "queued";
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
  action: "pause" | "steer" | "stop";
  runId: string;
  /** The state the route observed after its poll — the artifact's own vocabulary. */
  state?: PiSubagentRunState;
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
  action: "pause" | "steer" | "stop",
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
  if (result.action === "stop") {
    // A pre-0.71 run has no stop channel at all: the legacy arm interrupted it,
    // which pauses. Say what was observed instead of naming a stop that never
    // happened (the same is true if another supervisor paused it concurrently).
    if (result.state === "paused") {
      return { type: "info", message: t("chat.subagent.stopPaused") };
    }
    // `transitioned` is the observed state flip: a stop that did not land yet is
    // still in flight, and the runner has not gone to `stopped`.
    return {
      type: "info",
      message: result.transitioned ? t("chat.subagent.stopped") : t("chat.subagent.stopPending"),
    };
  }
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
