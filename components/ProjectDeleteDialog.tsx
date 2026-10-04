"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/hooks/useI18n";
import { openStackedDialog } from "@/lib/stacked-dialog";
import { projectDeleteCounts } from "@/lib/project-groups";
import type { SessionInfo } from "@/lib/types";
import {
  confirmationMatches,
  deleteProject,
  projectDisplayName,
  type ProjectDeleteResult,
} from "./project-delete-helpers";

const TITLE_ID = "project-delete-title";
const BODY_ID = "project-delete-body";
const INPUT_ID = "project-delete-confirm-input";

/**
 * Confirms deleting a whole project's sessions. The warning names what goes
 * (the counts the sidebar is showing, so they cannot disagree with the list),
 * and the Delete button stays disabled until the project's display name is
 * typed exactly — a red button reachable by one stray click on an
 * unrecoverable action. Esc cancels; a refusal is shown in place, and a busy
 * project names the sessions still running.
 */
export function ProjectDeleteDialog(props: ProjectDeleteDialogProps) {
  // The sidebar is a transformed, clipped container on a phone, so a fixed
  // overlay inside it would be positioned and clipped against the sidebar.
  return createPortal(<ProjectDeleteDialogView {...props} />, document.body);
}

export interface ProjectDeleteDialogProps {
  projectRoot: string;
  /** The stable identity the server deletes by; never turned into a path client-side. */
  projectKey: string;
  /** The loaded session list, for the counts and the refresh after a delete. */
  sessions: readonly SessionInfo[];
  onCancel: () => void;
  onDeleted: (result: { deletedSessions: number; removedDirs: number; failures: number }) => void;
}

/** The dialog's markup without the portal; exported for tests. */
export function ProjectDeleteDialogView({
  projectRoot,
  projectKey,
  sessions,
  onCancel,
  onDeleted,
}: ProjectDeleteDialogProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<ProjectDeleteResult, { ok: false }> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const name = projectDisplayName(projectRoot);
  const counts = projectDeleteCounts(sessions, projectKey);
  const canDelete = confirmationMatches(typed, projectRoot) && !busy;

  // Escape closes the dialog alone, even though it opens over the sidebar; a
  // delete already on its way is not cancelled by it.
  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    busyRef.current = busy;
    onCancelRef.current = onCancel;
  }, [busy, onCancel]);
  useEffect(() => openStackedDialog(document, dialogRef.current, () => {
    if (!busyRef.current) onCancelRef.current();
  }), []);

  const confirm = async () => {
    if (!canDelete) return;
    setBusy(true);
    setFailure(null);
    const result = await deleteProject(projectKey);
    if (result.ok) {
      onDeleted({
        deletedSessions: result.deletedSessions,
        removedDirs: result.removedDirs,
        failures: result.failures,
      });
      return;
    }
    setBusy(false);
    setFailure(result);
  };

  const failureMessage = (): string | undefined => {
    if (!failure) return undefined;
    if (failure.reason === "session-busy") return t("sidebar.deleteProjectRunning");
    return t("sidebar.deleteProjectFailed");
  };

  return (
    <div
      role="presentation"
      className="project-delete-backdrop"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
        tabIndex={-1}
        className="project-delete-dialog"
      >
        <div className="project-delete-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <div className="project-delete-content">
          <div id={TITLE_ID} className="project-delete-title">
            {t("sidebar.deleteProjectTitle", { project: name })}
          </div>
          <p id={BODY_ID} className="project-delete-warning">
            {t("sidebar.deleteProjectWarning")}
          </p>
          <p className="project-delete-counts">
            {t("sidebar.deleteProjectCounts", { sessions: counts.sessions, directories: counts.directories })}
          </p>
          <label className="project-delete-label" htmlFor={INPUT_ID}>
            {t("sidebar.deleteProjectTypeToConfirm", { project: name })}
          </label>
          <input
            id={INPUT_ID}
            className="project-delete-input"
            value={typed}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void confirm();
              }
            }}
          />
          {typed.length > 0 && !confirmationMatches(typed, projectRoot) && (
            <p className="project-delete-mismatch" role="status">{t("sidebar.deleteProjectMismatch")}</p>
          )}
          {failure && (
            <div className="project-delete-error" role="alert">
              <p>{failureMessage()}</p>
              {failure.runningSessionTitles.length > 0 && (
                <p className="project-delete-running">
                  {t("sidebar.deleteProjectRunningList", { titles: failure.runningSessionTitles.join(", ") })}
                </p>
              )}
              {failure.reason === undefined && <code className="project-delete-detail">{failure.error}</code>}
            </div>
          )}
        </div>
        <div className="project-delete-footer">
          <button type="button" className="project-delete-button" onClick={onCancel} disabled={busy}>
            {t("i18n.cancel")}
          </button>
          <button
            type="button"
            className="project-delete-button is-danger"
            onClick={() => void confirm()}
            disabled={!canDelete}
            aria-busy={busy || undefined}
          >
            {busy ? t("sidebar.deleting") : t("sidebar.deleteProjectConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
