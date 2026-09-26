"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { SessionInfo, SubagentSessionStatus } from "@/lib/types";
import { mapPiSubagentRunState, type PiSubagentSnapshotActivity, type PiSubagentSnapshotNode } from "@/lib/pi-subagents-snapshot";

interface Props {
  rootSession: SessionInfo;
  subagents: SessionInfo[];
  selectedSessionId: string;
  runningSessionIds: ReadonlySet<string>;
  /** Live runs from the pi-subagents `subagent-async` widget, when present. */
  liveRuns?: PiSubagentSnapshotNode[];
  onSelectSession: (session: SessionInfo) => void;
}

/** One run's live activity, reduced to the fields the panel renders. */
interface RunProgress {
  label: string;
  status: SubagentSessionStatus;
  startedAt?: number;
  endedAt?: number;
  activity?: PiSubagentSnapshotActivity;
}

function sessionTitle(session: SessionInfo): string {
  return session.name || session.firstMessage || session.id.slice(0, 12);
}

function formatRelativeTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, "hour");
  return formatter.format(Math.round(elapsedHours / 24), "day");
}

function statusColor(status: SubagentSessionStatus): string {
  if (status === "running" || status === "starting") return "var(--accent)";
  if (status === "completed") return "#16a34a";
  if (status === "failed") return "#dc2626";
  if (status === "aborted") return "#d97706";
  return "var(--text-dim)";
}

function StatusIcon({ status }: { status: SubagentSessionStatus }) {
  if (status === "running" || status === "starting") {
    return (
      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" />
      </svg>
    );
  }
  if (status === "aborted" || status === "interrupted") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M9 9h6v6H9z" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function formatElapsed(startedAt: number | undefined, endAt: number): string {
  if (!startedAt || !Number.isFinite(startedAt)) return "";
  const totalSeconds = Math.max(0, Math.floor((endAt - startedAt) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Compact progress line: current tool, elapsed time, turn and tool counts. */
function formatRunProgress(progress: RunProgress, t: (key: string, params?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  // A finished run's last tool is history, not "current"; keep it for live runs only.
  if (progress.status === "running" && progress.activity?.currentTool) {
    parts.push(t("agentSwitcher.run.tool", { name: progress.activity.currentTool }));
  }
  const elapsed = formatElapsed(progress.startedAt, progress.endedAt ?? Date.now());
  if (elapsed) parts.push(elapsed);
  if (progress.activity?.turnCount !== undefined) parts.push(t("agentSwitcher.run.turns", { count: progress.activity.turnCount }));
  if (progress.activity?.toolCount !== undefined) parts.push(t("agentSwitcher.run.tools", { count: progress.activity.toolCount }));
  return parts.join(" · ");
}

/**
 * Map a run id to the subagent row that owns it. pi-subagents names child
 * directories by run (`async-<runId>`) or session (`subagent-<agent>-<runId>`),
 * so the run id is a substring of the session's path or name.
 */
function buildRunProgress(subagents: readonly SessionInfo[], liveRuns: readonly PiSubagentSnapshotNode[]): Map<string, RunProgress> {
  const byKey = new Map<string, RunProgress>();
  if (liveRuns.length === 0) return byKey;
  const sessionByRunId = new Map<string, SessionInfo>();
  for (const session of subagents) {
    const runId = session.relation?.kind === "subagent" ? session.relation.runId : undefined;
    if (runId) sessionByRunId.set(runId, session);
  }
  for (const run of liveRuns) {
    const owner = sessionByRunId.get(run.id)
      ?? subagents.find((session) => session.path.includes(run.id) || session.name?.includes(run.id));
    if (!owner) continue;
    byKey.set(owner.id, {
      label: run.label,
      status: mapPiSubagentRunState(run.state),
      ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
      ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
      ...(run.activity ? { activity: run.activity } : {}),
    });
  }
  return byKey;
}

function AgentRow({
  session,
  main,
  selected,
  running,
  progress,
  onSelect,
}: {
  session: SessionInfo;
  main?: boolean;
  selected: boolean;
  running: boolean;
  progress?: RunProgress;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const relation = session.relation?.kind === "subagent" ? session.relation : null;
  const status: SubagentSessionStatus = running || progress?.status === "running"
    ? "running"
    : progress?.status ?? relation?.status ?? "completed";
  const primary = main ? t("agentSwitcher.main") : relation?.description || sessionTitle(session);
  const baseSecondary = main
    ? sessionTitle(session)
    : `${relation?.profile ?? t("agentSwitcher.subagent")} · ${formatRelativeTime(session.modified, locale)}`;
  const progressText = !main && progress ? formatRunProgress(progress, t) : "";
  const secondary = progressText ? `${progressText} · ${baseSecondary}` : baseSecondary;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={{
        width: "100%",
        minHeight: 56,
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 9,
        padding: "7px 12px",
        border: "none",
        borderBottom: "1px solid var(--border)",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
        background: selected ? "var(--bg-selected)" : "transparent",
        color: "var(--text)",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(event) => {
        if (!selected) event.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(event) => {
        if (!selected) event.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", color: main ? "var(--text-muted)" : "var(--accent)" }}>
        {main ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="7" width="14" height="11" rx="2" /><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4" />
          </svg>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: selected ? 600 : 500 }} title={primary}>
          {primary}
        </span>
        <span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-dim)", fontSize: 11 }} title={secondary}>
          {secondary}
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: main && !running ? "var(--text-dim)" : statusColor(status), fontSize: 11, whiteSpace: "nowrap" }}>
        {main && !running ? (
          selected ? t("agentSwitcher.current") : null
        ) : (
          <>
            <StatusIcon status={status} />
            <span>{t(`agentSwitcher.status.${status}`)}</span>
          </>
        )}
      </span>
    </button>
  );
}

export function AgentSessionPanel({ rootSession, subagents, selectedSessionId, runningSessionIds, liveRuns = [], onSelectSession }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const runProgress = useMemo(() => buildRunProgress(subagents, liveRuns), [subagents, liveRuns]);
  // A live pi-subagents run is not a pi-web RPC session, so runningSessionIds
  // never lists it; fold live run state in so sorting and the count agree.
  const liveRunningIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [sessionId, progress] of runProgress) {
      if (progress.status === "running") ids.add(sessionId);
    }
    return ids;
  }, [runProgress]);
  const isSessionRunning = (sessionId: string) => runningSessionIds.has(sessionId) || liveRunningIds.has(sessionId);
  const sortedSubagents = useMemo(() => [...subagents].sort((a, b) => {
    const aRunning = runningSessionIds.has(a.id) || liveRunningIds.has(a.id);
    const bRunning = runningSessionIds.has(b.id) || liveRunningIds.has(b.id);
    if (aRunning !== bRunning) return aRunning ? -1 : 1;
    return b.modified.localeCompare(a.modified);
  }), [runningSessionIds, liveRunningIds, subagents]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSubagents = normalizedQuery
    ? sortedSubagents.filter((session) => {
        const relation = session.relation?.kind === "subagent" ? session.relation : null;
        return [relation?.description, relation?.profile, session.name, session.firstMessage]
          .some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
    : sortedSubagents;
  const runningCount = subagents.filter((session) => isSessionRunning(session.id)).length;

  return (
    <div
      role="listbox"
      aria-label={t("agentSwitcher.title")}
      style={{
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderRadius: "0 0 6px 6px",
        boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
        overflow: "hidden",
      }}
    >
      <div>
        <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 12, fontWeight: 600 }}>{t("agentSwitcher.title")}</strong>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
            {t("agentSwitcher.count", { count: subagents.length })}
          </span>
          {runningCount > 0 && (
            <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 11 }}>
              {t("agentSwitcher.runningCount", { count: runningCount })}
            </span>
          )}
        </div>
        {subagents.length > 8 && (
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("agentSwitcher.search")}
              aria-label={t("agentSwitcher.search")}
              style={{
                width: "100%", height: 32, padding: "0 10px",
                border: "1px solid var(--border)", borderRadius: 6,
                background: "var(--bg)", color: "var(--text)", fontSize: 12, outline: "none",
              }}
            />
          </div>
        )}
        <div style={{ maxHeight: "min(58dvh, 480px)", overflowY: "auto" }}>
          <AgentRow
            session={rootSession}
            main
            selected={rootSession.id === selectedSessionId}
            running={runningSessionIds.has(rootSession.id)}
            onSelect={() => onSelectSession(rootSession)}
          />
          {visibleSubagents.map((session) => (
            <AgentRow
              key={session.id}
              session={session}
              selected={session.id === selectedSessionId}
              running={isSessionRunning(session.id)}
              progress={runProgress.get(session.id)}
              onSelect={() => onSelectSession(session)}
            />
          ))}
          {visibleSubagents.length === 0 && (
            <div style={{ padding: "22px 12px", color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
              {t("agentSwitcher.noMatches")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
