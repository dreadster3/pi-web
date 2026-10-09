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
  inbox** (`control/interrupt.json`, `control/steer-requests/`,
  `control/stop-requests/`) — the channel
  the package itself has used for interrupt, steer and stop delivery since 0.71,
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

**Pi Web bridges three actions to a pi-subagents async run, all offered under
`POST /api/subagents/runs`: `pause` (interrupt, resumable), `stop` (hard stop)
and `steer` (follow-up).**

- **Stop ends the run; Pause parks it.** The owner's decision: the chat
  composer's Stop must not leave a resumable pause behind, because the parent
  orchestrator would see a "paused, waiting" notice from what the user pressed
  Stop on. Stop therefore uses the package's own stop channel — the third arm
  of the same control inbox — and the run reaches `stopped`, which no send can
  revive. Pause keeps the interrupt lane and stays resumable.

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
- **A delivery attempt is not an outcome.** The runner's handlers are guarded
  by `state === "running"`, so a run that finished between the read and the
  delivery ignores the request, and `status.json` goes through a 100 ms
  coalescer, so a real flip can lag. The route re-reads `status.json` briefly
  and returns the **observed** state, including "delivered, still running".
- **Stop prefers the stop channel; a legacy layout only pauses.** Where the run
  directory has a `control/` inbox, Stop checks
  `control/stop-inbox-closed.json` first (present → `409 stop_rejected /
  inbox_closed`, the package's own refusal), writes
  `control/stop-requests/<13-digit-padded-ts>-<uuid>.json` as
  `{ "type": "stop", "ts": <ms>, "source": "pi-web" }` (the package's
  `requestAsyncStop` shape, and its file-name contract), then re-checks the
  marker and deletes the request if the runner closed its inbox meanwhile — the
  package takes such a late request back, so a later revival cannot consume a
  stale stop. A package ≥ 0.76 runner consumes it and ends the run `stopped`.
  A **legacy** (pre-0.71) artifact has no stop channel: its only handler is the
  interrupt, so that arm signals and then reports the `paused` state it actually
  observed (`state: "paused"`, `mechanism: "signal"`) rather than claiming a
  stop that did not happen. The UI notice names that honestly.
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
  and the UI offers no state buttons (the gate stays closed), rather than
  failing silently.
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
{ "runId": "<runId>", "action": "pause" | "stop" | "steer",
  "message": "<steer only>",
  "targetIndex": "<steer only, one child of a chain>" }

// 200, pause
{ "ok": true, "action": "pause", "runId": "…", "state": "paused",
  "transitioned": true, "mechanism": "control-inbox" | "signal" }

// 200, stop (hard stop; `state` is what the poll observed)
{ "ok": true, "action": "stop", "runId": "…", "state": "stopped",
  "transitioned": true, "mechanism": "control-inbox" | "signal" }

// 200, steer (running run, inbox write)
{ "ok": true, "action": "steer", "runId": "…", "delivery": "control-inbox",
  "requestId": "…", "steeringState": "queued" | "delivered" | "failed" | "unobserved",
  "unsteerableSteps": [] }

// 200, steer (paused run, parent-mediated)
{ "ok": true, "action": "steer", "runId": "…", "delivery": "parent-session",
  "delivered": true }
```

`targetIndex` names **one** child of a run for `steer`, overriding the
default all-running set: the chat steers exactly the transcript it is showing.
It is a single non-negative integer ≤ 1 000 000 (never an array — the package's
`targetIndexes` stays internal to the auto-selection), accepted for `steer`
only, and validated against `run.steps` before any write: an out-of-range index
is a `409 target_out_of_range`, and a child that is not `running`/`queued` is a
`409 target_not_steerable`. On the paused arm it becomes the `index` of the
parent-mediated `resume` call.

`GET /api/subagents/runs?runId=` — one run's observed state, **read-only**:
`{ "ok": true, "runId": "…", "state": "…", "mode": "…", "steps": ["running", …],
  "steering": [{ "requestId": "…", "states": ["queued", …] }] }`.
A child transcript's composer has no `subagent-async` widget of its own (the
package scopes that widget to the launching session), so it polls this to gate
Send/Stop and to clear a queued steer row; `steps` is the artifact's own order,
which is what `targetIndex` addresses, and `steering` is the run's own
`steering.recent[]` projected to the request id and its per-target states —
nothing else crosses the wire. It resolves and parses through the same code as
the control actions and refuses with the same `{error, code, reason}` shape,
writing nothing.

`runId` must match `[A-Za-z0-9._-]+`, reject the `.`/`..` segments explicitly,
and resolve to `<root>/async-subagent-runs/<runId>/` inside a resolved temp
root; anything else is a `400` that never touches the filesystem.

`pause` returns the state observed after the poll, with `transitioned: false`
when the run was still `running` at the end: a delivered request that did not
land is a `200` with an honest state, not an error. `stop` reports the same way,
and its `state` is **never** assumed: the inbox arm normally observes
`stopped`, while the legacy signal arm observes `paused` and reports it as
such — a legacy fallback pauses, and the UI says so rather than naming a stop
that did not happen. `steer` against a running
run aggregates the observed steering lifecycle into `steeringState`
(`delivered` also covers the package's `recovered`/`late` receipts; `failed`
means at least one targeted child refused delivery; `queued` means accepted
by the runner but the child has not confirmed; `unobserved` means the window
closed first); it does **not** report model action. Steer against a paused run reports that the instruction reached a live
parent, not that the model has acted on it.

**Errors** — `{ "error": "<human text>", "code": "<code>", "reason": "<detail>" }`

| HTTP | `code` | `reason` |
| --- | --- | --- |
| 400 | `invalid_request` | `run_id_invalid`; `body_invalid` (non-JSON request body); `action_invalid`; `message_required` (steer, no non-empty `message`); `steer_too_large` (> 128 KiB); `target_index_invalid` (`targetIndex` not a single non-negative integer, or sent for `pause`) |
| 404 | `run_not_found` | `no_run_roots` (no run root, or the env override absent); `no_status` (run dir or `status.json` missing) |
| 409 | `run_unsupported` | `no_pid` (foreground run, or a package version that omits `pid`/inbox — both arms need one of them) |
| 409 | `run_not_pausable` | `not_running`; `pid_unverifiable` (signal fallback with recorded vs current `pidNamespaceScope` disagree) |
| 409 | `stop_rejected` | `inbox_closed` (`stop-inbox-closed.json` present, before the write or right after it); `not_running` (the stop guard is the same `state === "running"`); `no_pid` (legacy layout with no usable pid) |
| 409 | `steer_rejected` | `inbox_closed` (`steer-inbox-closed.json` present); `no_running_steps` (running run with no steerable child); `target_out_of_range` (`targetIndex` ≥ `run.steps.length`); `target_not_steerable` (the named child is not `running`/`queued`) |
| 409 | `parent_session_not_live` | `no_live_wrapper` (paused-run steer; parent on disk, not alive in this server) |
| 502 | `interrupt_failed` | `write_failed` (inbox write, e.g. EACCES/ENOSPC); `eperm`; `esrch` (pid gone, signal fallback); `enosys` (platform cannot deliver signals) |
| 502 | `stop_failed` | `write_failed` (stop request write); `eperm`; `esrch`; `enosys` (legacy signal arm) |
| 502 | `steer_failed` | `write_failed` (inbox write); `send_failed` (live parent refused the prompt — busy turn, lost admission race, session copy in flight) |
| 500 | `internal_error` | `unexpected` (boundary catch; anything the control module does not map itself) |

**Pause guard and poll.** Before delivering: `state === "running"`; for the
inbox arm, the `control/` inbox must exist and the run dir must be a resolved
root; for the signal fallback, `pid` a numeric integer `> 1` and, when both
the recorded and the current `pidNamespaceScope` are present, no mismatch.
Then deliver and re-read `status.json` every ~200 ms for ~2 s, stopping early
on a state other than `running`; a timeout is the observed `running` state.

**Stop guard and poll.** The same guard and the same poll, with the stop inbox
instead of the interrupt one: `stop-inbox-closed.json` is checked **before**
the write (a `409 stop_rejected / inbox_closed`) and again right after it, in
which case the just-written request is removed — the package's own
`requestAsyncStop` does the same, so a stop that arrived as the runner closed
its inbox cannot be consumed by a later revival. On the legacy arm `no_pid`
and `pid_unverifiable` are `stop_rejected` rather than `run_not_pausable`, so
the UI reads one error code per action.

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
- **A UI Stop hard-stops; a UI Pause keeps the resumable loop.** Stop ends the
  run through the package's stop channel, so the parent orchestrator never sees
  a resumable "paused, waiting" notice from a Stop gesture. Pause is the
  resumable gesture, and the composer's next send turns it into a
  parent-mediated resume. On a pre-0.71 artifact the two collapse into the one
  interrupt path, which pauses: the response carries the observed `paused`
  state and the notice says the run paused because it has no stop channel,
  rather than claiming a stop.
- **A queued steer is visible until the run confirms it.** A live run's chat
  keeps the steers it sent as queued rows, the same affordance as the main
  agent's queued message: recorded when the route answers `steeringState:
  "queued"`, cleared when the poll reads the request's receipt out of
  `steering.recent[]` — `delivered` (also the package's `recovered`/`late`) clears
  it and re-reads the transcript that now holds the message, `failed` clears it
  with the same error notice a refused prompt gets. The rows are **ephemeral
  client state**, deliberately not persisted: the run's own artifact is the
  durable record, so a reload simply shows the transcript and any still-unrouted
  request is invisible until it lands — never a row the client invented and
  cannot reconcile.
- **The UI derives state from data it already has.** The chat composer is the
  control surface: it shows one row, Steer then Stop and Pause, the same
  gestures as a main-agent send and stop. Both state buttons read the run's own
  `state` — `relation.status` seeds the first paint,
  `GET /api/subagents/runs?runId=` keeps it honest while the child chat is open —
  and a terminal run clears them so the composer falls back to a plain prompt. A
  control response refetches through the existing conventions
  (`onSubagentRunControl` → `refreshKey`), and a stop that observed a terminal
  state closes the gate without waiting for the next poll.
- **No extra control UI.** Steering is a normal message send inside the
  subagent's chat, and Stop/Pause are the existing composer affordances: no
  per-run menu, button or panel row is added, and the Agents panel stays a
  read-only view.
- **What Pi Web reads stays a guess about someone else's format.** `pid`,
  `pidNamespaceScope`, `state`, and `steering` stay optional in a versioned
  artifact (`lifecycleArtifactVersion`); the parser tolerates their absence
  and the route degrades to a structured error.

## Documentation updates

Implementation must also update: (a) `AGENTS.md` — file-map entries for
`app/api/subagents/runs/` (route + test) and the pid/inbox parsing in
`lib/pi-subagents-runs.ts`; (b) `docs/agents/subagents.md` — a short section
covering the chat composer as the control surface, pause-as-inbox/signal-fallback,
steer-as-inbox and its `targetIndex`, paused-run parent-mediated resume, the
read-only single-run status read, and absence behavior (see this ADR);
(c) i18n — every new user-facing string added to **all three** of
`lib/i18n/messages/{en,zh-CN,zh-TW}.ts` (enforced by
`lib/i18n/registry.test.mjs`); (d) verification — `node_modules/.bin/tsc
--noEmit`, `npm run lint`, and `node --test` for touched test files; no
`next build`, no dev servers.