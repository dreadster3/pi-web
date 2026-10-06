import { NextResponse } from "next/server";
import { subagentsControl } from "@/lib/pi-subagents-control";

export const dynamic = "force-dynamic";

/**
 * POST /api/subagents/runs — one control action (`pause` | `steer`) for one
 * pi-subagents async run. See docs/adr/0007-subagents-control-bridging.md: the
 * package is not a dependency, so the run is addressed by its on-disk name and
 * every outcome is observed, never assumed. Every failure answers in the ADR's
 * structured shape — the boundary catch maps anything the control module does
 * not map itself, so no reachable path leaks a framework 500.
 */
export async function POST(req: Request) {
  let body: { runId?: unknown; action?: unknown; message?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json(
      { error: "A JSON body is required.", code: "invalid_request", reason: "body_invalid" },
      { status: 400 },
    );
  }

  let result: { status: number; body: Record<string, unknown> };
  try {
    result = await subagentsControl({ runId: body.runId, action: body.action, message: body.message });
  } catch (error) {
    result = {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
        code: "internal_error",
        reason: "unexpected",
      },
    };
  }
  return NextResponse.json(result.body, { status: result.status });
}
