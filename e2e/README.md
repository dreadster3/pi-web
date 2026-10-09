# CI and browser regression tests

Adapted from @Nuctori's CI/E2E proposal in #617 and #599. The performance
scanner, reverse reader, sidebar changes, and timing benchmarks are not included.

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm ci` installs devDependencies, which this suite needs (`playwright`,
`mammoth`, `react-markdown`, tailwind). A shell that exports
`NODE_ENV=production` makes npm omit them, and the dev server then fails to
compile the page. Run `env -u NODE_ENV npm ci` (or `npm ci --include=dev`) in
that case.

Playwright launches the Chromium revision pinned by `package-lock.json`;
`npx playwright install chromium` fetches it and is enough on hosts with a
normal C library set. On an immutable host such as NixOS the downloaded Chromium
cannot load `libglib-2.0.so.0` and friends. nixpkgs packages the same revision
with patched libraries, so point Playwright at it instead:

```sh
PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers) \
  npm run test:e2e
```

The script starts and stops its own Turbopack dev server on an available
loopback port, so it needs no `PLAYWRIGHT_BROWSERS_PATH` when the download
works. Run it in a checkout without an active dev server; Next.js
shares `.next/dev/lock` within a checkout and the failure message names the
lock's process and port. Delete `.next/dev/lock` if that process is gone (a
crashed server can leave it behind). All fixtures are created before
startup in a temporary `PI_CODING_AGENT_DIR` and removed on completion.
No model credentials or existing Pi sessions are needed.

CI runs lint, type checking, and unit tests in one job. A separate job builds
the application in a clean checkout and runs the same browser tests with
`E2E_SERVER_MODE=start` against `next start`. Do not build in a checkout used
for development.

Coverage:

- A 5,000-message session opens with exactly the last 50 entries, bounded
  detail/context responses, and no browser errors.
- Desktop and mobile scrolling load two consecutive older pages. Each response
  has the expected IDs, no gaps or duplicates, and the messages appear once in
  the chat. A small session checks pagination through the root.
- Branch context follows the selected leaf and excludes the other branch.
- Markdown, code blocks, and real tool-call/tool-result blocks render.
- Chat width and font size persist, existing drafts resize, and short settings
  panels keep every language option reachable on desktop and mobile.
- Interface/chat and monospace font lists and weights apply live, survive
  refresh, sync between tabs and reset independently without changing width or
  font size. Headings and Markdown emphasis retain their weights.
- Unknown sessions and paths outside the fixture project are rejected.
- A local extension checks dialog keyboard navigation, Esc cancellation,
  collapse/expand draft preservation, countdown display, and server-side expiry.

Model prompts, live model streaming, and agent execution are outside this suite.
Failures save a screenshot, Playwright trace, and server log under
`test-results/e2e/`; CI uploads that directory. Open a trace with
`npx playwright show-trace test-results/e2e/trace.zip`.
