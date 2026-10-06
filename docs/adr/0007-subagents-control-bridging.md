# 0007 — Bridging interrupt and steering to pi-subagents async runs

## Status

Accepted. Takes up the item [0006](0006-delegate-subagents-to-pi-subagents.md)
deferred: "live run status and steering/abort bridging".

## Context

[0006](0006-delegate-subagents-to-pi-subagents.md) made `pi-subagents` an
optional, user-installed pi extension: Pi Web ships no sub-agent engine, adds
no dependency on it, and keeps no interface to it. Its runs are visible only
through **read-only side channels**: `lib/pi-subagents-runs.ts` parses
`<tmp>/pi-subagents-*/async-subagent-runs/<runId>/status.json`
(`PI_SUBAGENTS_TEMP_ROOT` overrides the root), and `AgentSessionPanel` renders
rows from that. Observable, not controllable; this closes the gap.

Constraints that shape the options:

- **Pi Web must not grow a coupling.** No import of the package, no
  `package.json` entry, nothing read from its source for logic. The only
  allowed coupling is the run artifacts on disk: status.json and events.jsonl
  are read-only, and writes are limited to the package's **designed control
  inbox** (`control/interrupt.json`, `control/steer-requests/`) — the channel
  the package itself has used for interrupt and steer delivery since 0.71,
  guarded by validity checks and never a mutation of its state files.
- **The run lives in a detached process that outlives its parent session.**
  The runner records `pid` and `pidNamespaceScope` in `status.json`; since
  0.71 it also watches the control inbox. The signal handler
  (`SIGUSR2`, `SIGBREAK` on win32) is registered for the runner's whole
  lifetime, but 0.76 treats it as a legacy fallback — Windows cannot deliver
  those signals cross-process (`ENOSYS`), which is why the package moved to
  the file inbox.
- **The package owns the meaning of a run.** `status.json` changes shape
  between package minors (0.24 → 0.71 → 0.76 each changed the control
  mechanism), so every field Pi Web uses must be optional, feature-detection
  must prefer artifacts over version numbers, and every failure must be
  reported.

## Decision

**Pi Web bridges two actions to a pi-subagents async run, both offered under
`POST /api/subagents/runs`: `pause` (interrupt) and `steer` (follow-up).**

- **Pause prefers the control inbox; the signal is a fallback.** When the
  run directory has a `control/` inbox (package ≥ 0.71, the live 0.76
  layout), the route writes `control/interrupt.json` atomically:
  `{ "type": "interrupt", "ts": <ms>, "source": "pi-web" }` — the same
  request the package's own supervisor writes. Otherwise (legacy artifact
  layout), it falls back to `process.kill(pid, SIGUSR2)` or `SIGBREAK` on
  win32, the handler the runner registered. The fallback path is best-effort:
  cross-uid and hardened hosts raise `EPERM`, Windows cannot deliver it, and
  a package minor may retire the handler — each a distinct reported error,
  never a silent no-op.
- **A delivery attempt is not an outcome.** The runner's handler is guarded
  by `state === "running"`, so a run that finished between the read and the
  delivery ignores the request, and `status.json` goes through a 100 ms
  coalescer, so a real flip can lag. The route re-reads `status.json` briefly
  and returns the **observed** state, including "delivered, still running".
- **Steering is state-dependent (owner decision: direct inbox write where
  possible).**
  - *Running run:* write a steer request into the run's inbox,
    `control/steer-requests/<13-digit-padded-ts>-<base64url(id)>.json`,
    `{ "type": "steer", "id": "<uuid>", "ts": <ms>, "message": "<non-empty,
    ≤ 128 KiB>", "mode"?: "steer" | "follow_up" | "auto", "targetIndex(es)"?,
    "source": "pi-web" }`, validated to the same rules the package enforces
    (`id` whitespace-free ≤ 256 chars, unique target indexes, no
    `targetIndex` alongside `targetIndexes`), after checking
    `control/steer-inbox-closed.json`. Target indexes mirror the package's
    own steer action: currently `running`/`pending` steps. Delivery outcome
    is **observed**, not assumed: `status.json`'s `steering.recent[]` tracks
    the request id through `scheduled → queued/routed → delivered/failed`;
    the route polls it briefly and aggregates the per-target states into the
    `steeringState` response field.
  - *Paused run:* inbox revival does not exist — the paused runner process is
    dead and revival semantics live inside the package's tool. Steer therefore
    falls back to parent-session mediation: resolve `status.sessionId` to a
    wrapper id and require a **live** RPC session from `lib/rpc-manager.ts`
    (`getRpcSession` + `isAlive`). It never calls `startRpcSession`: starting
    a parent session as a side effect of steering is out of scope. The route
    sends a prompt telling that session's model to invoke
    `subagent({ action: "resume", id: "<runId>", message: "<user message>" })`
    — `resume` is the tool's revival action for paused/completed children
    (and it refuses any session other than the launching parent). This arm
    costs a parent turn; the response labels it model-mediated.
- **Foreground runs are unsupported in v1.** No detached pid, no handle, no
  control inbox target. The route answers with a structured unsupported error
  and the UI disables the control with a reason, rather than failing silently.
- **`pi-subagents` stays optional and is not a dependency.** Nothing here is
  installed, versioned, or imported; absence and emptiness are ordinary states.
  When no run root exists, or the requested run has no `status.json`, the route
  answers `404` with a reason distinguishing "the package is not installed / has
  no runs" from "that run is gone", and the UI hides controls from data it
  already has (snapshot/runs, artifact presence), never by probing for the
  package.

## Interface

`POST /api/subagents/runs` — one control action per request. The route
re-reads `status.json` per request (no caching, like the other run readers).

```jsonc
// request
{ "runId": "<runId>", "action": "pause" | "steer", "message": "<steer only>" }

// 200, pause
{ "ok": true, "action": "pause", "runId": "…", "state": "paused",
  "transitioned": true, "mechanism": "control-inbox" | "signal" }

// 200, steer (running run, inbox write)
{ "ok": true, "action": "steer", "runId": "…", "delivery": "control-inbox",
  "requestId": "…", "steeringState": "queued" | "delivered" | "failed" | "unobserved",
  "unsteerableSteps": [] }

// 200, steer (paused run, parent-mediated)
{ "ok": true, "action": "steer", "runId": "…", "delivery": "parent-session",
  "delivered": true }
```

`runId` must match `[A-Za-z0-9._-]+`, reject the `.`/`..` segments explicitly,
and resolve to `<root>/async-subagent-runs/<runId>/` inside a resolved temp
root; anything else is a `400` that never touches the filesystem.

`pause` returns the state observed after the poll, with `transitioned: false`
when the run was still `running` at the end: a delivered request that did not
land is a `200` with an honest state, not an error. `steer` against a running
run aggregates the observed steering lifecycle into `steeringState`
(`delivered` also covers the package's `recovered`/`late` receipts; `failed`
means at least one targeted child refused delivery; `queued` means accepted
by the runner but the child has not confirmed; `unobserved` means the window
closed first); it does **not** report model action. Steer against a paused run reports that the instruction reached a live
parent, not that the model has acted on it.

**Errors** — `{ "error": "<human text>", "code": "<code>", "reason": "<detail>" }`

| HTTP | `code` | `reason` |
| --- | --- | --- |
| 400 | `invalid_request` | `run_id_invalid`; `body_invalid` (non-JSON request body); `action_invalid`; `message_required` (steer, no non-empty `message`); `steer_too_large` (> 128 KiB) |
| 404 | `run_not_found` | `no_run_roots` (no run root, or the env override absent); `no_status` (run dir or `status.json` missing) |
| 409 | `run_unsupported` | `no_pid` (foreground run, or a package version that omits `pid`/inbox — both arms need one of them) |
| 409 | `run_not_pausable` | `not_running`; `pid_unverifiable` (signal fallback with recorded vs current `pidNamespaceScope` disagree) |
| 409 | `steer_rejected` | `inbox_closed` (`steer-inbox-closed.json` present); `no_running_steps` (running run with no steerable child) |
| 409 | `parent_session_not_live` | `no_live_wrapper` (paused-run steer; parent on disk, not alive in this server) |
| 502 | `interrupt_failed` | `write_failed` (inbox write, e.g. EACCES/ENOSPC); `eperm`; `esrch` (pid gone, signal fallback); `enosys` (platform cannot deliver signals) |
| 502 | `steer_failed` | `write_failed` (inbox write); `send_failed` (live parent refused the prompt — busy turn, lost admission race, session copy in flight) |
| 500 | `internal_error` | `unexpected` (boundary catch; anything the control module does not map itself) |

**Pause guard and poll.** Before delivering: `state === "running"`; for the
inbox arm, the `control/` inbox must exist and the run dir must be a resolved
root; for the signal fallback, `pid` a numeric integer `> 1` and, when both
the recorded and the current `pidNamespaceScope` are present, no mismatch.
Then deliver and re-read `status.json` every ~200 ms for ~2 s, stopping early
on a state other than `running`; a timeout is the observed `running` state.

**Steer acceptance.** The steer request must pass the package's own validity
rules before the file is written; an invalid request is a `400`, not a file
the runner will silently discard.

## Consequences

- **Optional stays optional.** No import, no `package.json` entry, no source
  read from the package at runtime; without `pi-subagents` installed nothing
  changes — controls hidden, the route answering a distinguishable `404`.
- **Inbox writes are the package's own contract, observed not trusted.** The
  written shapes mirror the package's requestAsyncInterrupt/requestAsyncSteer
  validation; the runner consumes and routes them like any other supervisor.
  A package minor may change the inbox — feature detection (`control/`
  presence) falls back gracefully, and unobserved delivery states are
  reported as such, never invented.
- **Pid reuse is handled by refusal, not cleverness.** The signal fallback
  combines `state === "running"`, a numeric pid, and namespace-scope
  agreement; an unverifiable pid is not signaled, and a signal landing on a
  finished run is harmless — the runner's handler is itself guarded.
- **Steering a paused run costs a parent turn and is model-mediated.** The
  message reaches the parent model via `resume`, so it takes effect when the
  parent next runs, and only while that session is alive in this server.
- **Foreground runs, pre-0.71 artifact layouts, and Windows signal fallback
  have no pause path.** The first offers no detached handle; the second
  predates the inbox; on Windows signals cannot be delivered. Each answers
  with an actionable unsupported error, never a silent no-op.
- **The UI derives state from data it already has.** Controls are gated on
  `relation.runId` and run status (`pause` and `steer` for running; `steer`
  for paused), disabled with a tooltip otherwise, and refresh through the
  existing conventions (`trackPiSubagentSessionRefetches`, `refreshKey`).
- **What Pi Web reads stays a guess about someone else's format.** `pid`,
  `pidNamespaceScope`, `state`, and `steering` stay optional in a versioned
  artifact (`lifecycleArtifactVersion`); the parser tolerates their absence
  and the route degrades to a structured error.

## Documentation updates

Implementation must also update: (a) `AGENTS.md` — file-map entries for
`app/api/subagents/runs/` (route + test) and the pid/inbox parsing in
`lib/pi-subagents-runs.ts`; (b) `docs/agents/subagents.md` — a short section
covering pause-as-inbox/signal-fallback, steer-as-inbox,
paused-run parent-mediated resume, and absence behavior (see this ADR);
(c) i18n — every new user-facing string added to **all three** of
`lib/i18n/messages/{en,zh-CN,zh-TW}.ts` (enforced by
`lib/i18n/registry.test.mjs`); (d) verification — `node_modules/.bin/tsc
--noEmit`, `npm run lint`, and `node --test` for touched test files; no
`next build`, no dev servers.