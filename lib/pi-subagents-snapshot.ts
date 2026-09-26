// Pure helpers for pi-subagents' live async-status widget. Kept free of Node
// built-ins so the demo (a static, backend-free build) can mirror this file and
// the progress UI can share it across server and browser.

export const PI_SUBAGENTS_ASYNC_WIDGET_PREFIX = "PI_SUBAGENT_ASYNC_JSON:";
export const PI_SUBAGENTS_ASYNC_SNAPSHOT_KIND = "pi-subagents.async-status-snapshot";
export const PI_SUBAGENTS_ASYNC_SNAPSHOT_VERSION = 1;

export type PiSubagentRunState =
  | "queued"
  | "running"
  | "complete"
  | "failed"
  | "partial"
  | "paused"
  | "stopped"
  | "rejected";

/** Status vocabulary the existing Agents panel already renders. */
export type PiSubagentRunStatus = "running" | "completed" | "failed" | "stopped";

/** Collapse the async runner's fine-grained state into the panel's status set. */
export function mapPiSubagentRunState(state: PiSubagentRunState): PiSubagentRunStatus {
  switch (state) {
    case "queued":
    case "running":
      return "running";
    case "complete":
      return "completed";
    case "stopped":
      return "stopped";
    default:
      return "failed";
  }
}

export interface PiSubagentSnapshotActivity {
  state?: string;
  currentTool?: string;
  lastActivityAt?: number;
  currentToolStartedAt?: number;
  turnCount?: number;
  toolCount?: number;
}

export interface PiSubagentSnapshotNode {
  id: string;
  kind: string;
  label: string;
  state: PiSubagentRunState;
  startedAt?: number;
  updatedAt?: number;
  endedAt?: number;
  activity?: PiSubagentSnapshotActivity;
  children?: PiSubagentSnapshotNode[];
}

export interface PiSubagentSnapshot {
  kind: typeof PI_SUBAGENTS_ASYNC_SNAPSHOT_KIND;
  version: number;
  generatedAt: number;
  runs: PiSubagentSnapshotNode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const RUN_STATES: ReadonlySet<string> = new Set([
  "queued",
  "running",
  "complete",
  "failed",
  "partial",
  "paused",
  "stopped",
  "rejected",
]);

function parseNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseActivity(value: unknown): PiSubagentSnapshotActivity | undefined {
  if (!isRecord(value)) return undefined;
  const activity: PiSubagentSnapshotActivity = {
    ...(typeof value.state === "string" ? { state: value.state } : {}),
    ...(typeof value.currentTool === "string" ? { currentTool: value.currentTool } : {}),
    ...(parseNumber(value.lastActivityAt) !== undefined ? { lastActivityAt: parseNumber(value.lastActivityAt) } : {}),
    ...(parseNumber(value.currentToolStartedAt) !== undefined ? { currentToolStartedAt: parseNumber(value.currentToolStartedAt) } : {}),
    ...(parseNumber(value.turnCount) !== undefined ? { turnCount: parseNumber(value.turnCount) } : {}),
    ...(parseNumber(value.toolCount) !== undefined ? { toolCount: parseNumber(value.toolCount) } : {}),
  };
  return Object.keys(activity).length > 0 ? activity : undefined;
}

function parseNode(value: unknown): PiSubagentSnapshotNode | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.label !== "string") return null;
  if (typeof value.state !== "string" || !RUN_STATES.has(value.state)) return null;
  const children = Array.isArray(value.children)
    ? value.children.map(parseNode).filter((child): child is PiSubagentSnapshotNode => child !== null)
    : undefined;
  return {
    id: value.id,
    kind: typeof value.kind === "string" ? value.kind : "subagent",
    label: value.label,
    state: value.state as PiSubagentRunState,
    ...(parseNumber(value.startedAt) !== undefined ? { startedAt: parseNumber(value.startedAt) } : {}),
    ...(parseNumber(value.updatedAt) !== undefined ? { updatedAt: parseNumber(value.updatedAt) } : {}),
    ...(parseNumber(value.endedAt) !== undefined ? { endedAt: parseNumber(value.endedAt) } : {}),
    ...(parseActivity(value.activity) ? { activity: parseActivity(value.activity) } : {}),
    ...(children && children.length > 0 ? { children } : {}),
  };
}

/** Parse one `subagent-async` widget line, tolerating unrelated or malformed lines. */
export function parseAsyncSnapshotWidgetLine(text: string): PiSubagentSnapshot | null {
  const prefixIndex = text.indexOf(PI_SUBAGENTS_ASYNC_WIDGET_PREFIX);
  if (prefixIndex === -1) return null;
  const payload = text.slice(prefixIndex + PI_SUBAGENTS_ASYNC_WIDGET_PREFIX.length).trim();
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.kind !== PI_SUBAGENTS_ASYNC_SNAPSHOT_KIND) return null;
  if (parsed.version !== PI_SUBAGENTS_ASYNC_SNAPSHOT_VERSION) return null;
  if (!Array.isArray(parsed.runs)) return null;
  const runs = parsed.runs.map(parseNode).filter((node): node is PiSubagentSnapshotNode => node !== null);
  return {
    kind: PI_SUBAGENTS_ASYNC_SNAPSHOT_KIND,
    version: PI_SUBAGENTS_ASYNC_SNAPSHOT_VERSION,
    generatedAt: parseNumber(parsed.generatedAt) ?? 0,
    runs,
  };
}

/** Depth-first flatten of a snapshot: each run followed by all of its descendants. */
export function flattenPiSubagentSnapshot(snapshot: PiSubagentSnapshot): PiSubagentSnapshotNode[] {
  const flat: PiSubagentSnapshotNode[] = [];
  const walk = (node: PiSubagentSnapshotNode) => {
    flat.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const run of snapshot.runs) walk(run);
  return flat;
}
