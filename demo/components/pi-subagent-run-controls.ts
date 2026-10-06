// Per-run controls for the Agents panel: POST /api/subagents/runs, one control
// action per request (docs/adr/0007-subagents-control-bridging.md). Client-safe:
// types and fetch only, no node builtins, so the demo mirrors it.
import type { PiSubagentRunState } from "@/lib/pi-subagents-snapshot";

/** What a run's own state allows. Derived from data the panel already has. */
export interface PiSubagentRunControlAvailability {
  pause: boolean;
  steer: boolean;
}

/**
 * Pause needs a live runner; steer is offered while the run is running (inbox
 * write) or paused (parent-mediated resume). Every other state has no control
 * path, so the control is disabled rather than failing silently.
 */
export function piSubagentRunControls(state: PiSubagentRunState | undefined): PiSubagentRunControlAvailability {
  return {
    pause: state === "running",
    steer: state === "running" || state === "paused",
  };
}

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

export interface PiSubagentRunControlFailure {
  error: string;
  code?: string;
  reason?: string;
}

export type PiSubagentRunControlResponse =
  | { ok: true; data: PiSubagentRunControlResult }
  | { ok: false; status: number; failure: PiSubagentRunControlFailure };

/**
 * Send one control action. A refusal is returned, not thrown, because the
 * route's error table is part of the contract and the panel shows its `reason`.
 */
export async function sendPiSubagentRunControl(
  runId: string,
  action: "pause" | "steer",
  message?: string,
): Promise<PiSubagentRunControlResponse> {
  const response = await fetch("/api/subagents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, action, ...(message !== undefined ? { message } : {}) }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      failure: {
        error: typeof body.error === "string" ? body.error : `HTTP ${response.status}`,
        ...(typeof body.code === "string" ? { code: body.code } : {}),
        ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
      },
    };
  }
  return { ok: true, data: body as unknown as PiSubagentRunControlResult };
}

/** One line for a control outcome, from the fields the route actually returns. */
export function piSubagentRunControlNotice(
  result: PiSubagentRunControlResult,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (result.action === "pause") {
    return result.transitioned ? t("agentSwitcher.run.paused") : t("agentSwitcher.run.pausePending");
  }
  if (result.delivery === "parent-session") return t("agentSwitcher.run.steerSent");
  return result.steeringState === "delivered"
    ? t("agentSwitcher.run.steerDelivered")
    : t("agentSwitcher.run.steerQueued");
}

/** The reason a control is unavailable, for the disabled control's tooltip. */
export function piSubagentRunControlDisabledKey(state: PiSubagentRunState | undefined): string | undefined {
  const controls = piSubagentRunControls(state);
  return controls.steer ? undefined : "agentSwitcher.run.unsupported";
}
