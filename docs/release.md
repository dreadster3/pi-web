# Releases

release-please owns the version bookkeeping; you own the *when*. It keeps one
accumulating release pull request open, and merging that PR is the release.

Nothing releases until you merge the bot's PR, and no workflow ever pushes to `main`
— it is protected by this repository's ruleset (*Default*: pull requests required, no
bypass actors), so every change to it, including the version bump, arrives as a PR.

## One-time setup (do this before the first release)

One thing must exist, and it is not a stored npm token: the npm trusted publisher.

### The npm trusted publisher

**Do this before the first publish, or it fails with `ENONPMTOKEN`.** This repo stores
no npm token, so npm has to trust the workflow instead.

1. Open <https://www.npmjs.com/package/@dreadster3/pi-web/access> (npm account with
   publish rights on `@dreadster3/pi-web`).
2. Add a **Trusted Publisher** for GitHub Actions with exactly these values:
   - Repository owner: `dreadster3`
   - Repository name: `pi-web`
   - Workflow name: `release.yml`
   - Environment: `release`
3. In the repository's *Settings → Environments*, create an environment named `release`.
   It must exist before you register the publisher: the `environment:` field has to name a
   real environment, and it is where publish approval gating will hang.
4. Save.

The runner needs npm ≥ 11.5 and Node ≥ 22.14, which the workflow's Node 24 provides.
Provenance is generated automatically on this path — no `--provenance` flag, no token.

## The release ritual

### 1. Let the bot propose a version

On every push to `main`, the `release-please` job reads the conventional commits since
the last release and opens (or updates) **one** pull request that:

- bumps `version` in `package.json` and `package-lock.json`,
- writes the new section at the top of `CHANGELOG.md`.

`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major.

While a release PR is open, further merges to `main` add to it rather than opening a
second one — review it whenever you like.

### 2. Adjust the version if you want to

Two documented overrides:

- **`Release-As: x.y.z` in a commit body** on `main` forces the next release PR to that
  version:
  `git commit --allow-empty -m "chore: release 2.0.0" -m "Release-As: 2.0.0"`
- **Edit the release PR's title.** release-please reads the version back out of the
  title on its next run.

See <https://github.com/googleapis/release-please#how-do-i-change-the-version-number>.

### 3. Merge the release PR (or don't)

- **Ship it:** merge. In that same run release-please commits the version, pushes the
  tag `vX.Y.Z` and creates the GitHub release; job `publish` is then unblocked by
  `needs: release-please` and runs immediately.
- **Hold it back:** leave the PR open. Nothing is released. This is the entire
  hold-back mechanism.

`publish` does, from the released tag:

1. checks out the tag's commit,
2. `npm ci`,
3. `npm run build` — required, not `--if-present`: the tarball ships `.next` and
   `next.config.ts` bakes `NEXT_PUBLIC_APP_VERSION` from `package.json`, so a skipped
   build would publish an empty artifact reporting the wrong version,
4. `npm test`,
5. `npm publish --access public`, with provenance attached automatically by the trusted
   publisher.

## nix builds: no hash to maintain

`package.nix` takes its npm dependencies straight from `package-lock.json` through
`importNpmLock`, so there is no `npmDepsHash` to refresh and no caretaker workflow —
a version bump or a dependency change is just a lock edit. (`#24` retired the old
fixed-output `npmDepsHash` scheme.) Nothing about a release needs nix work.

## Where the version lives

| Place | Written by | Truth for |
| --- | --- | --- |
| `package.json` / `package-lock.json` / `CHANGELOG.md` | the merged release PR | what the tree and the next build are |
| the git tag `vX.Y.Z` | release-please, on that same merge | which commit shipped |
| the npm registry | the `publish` job | what consumers install |

```bash
npm view @dreadster3/pi-web version   # the latest published version
git tag --sort=-v:refname | head -1   # the latest release tag
```

## Retired

- **`npm run release` from a laptop.** The script is gone; publishing is CI-only.
- **Hand-made version PRs.** release-please opens them.
- **Hand-written bilingual release notes.** `CHANGELOG.md` is bot-written, in English,
  and the GitHub release is created from it.

## Verifying a release

```bash
npm view @dreadster3/pi-web version
npm view @dreadster3/pi-web@<version> dist.attestations   # provenance

git fetch --tags origin
git tag --sort=-v:refname | head -3
gh release view v<version> --repo dreadster3/pi-web
```

## If a run fails

- **`ENONPMTOKEN` / "Invalid npm token"** — the trusted publisher is missing or its
  owner/repo/workflow/environment values do not match. Do the setup above.
- **No release PR appears** — no releasable commit since the last release (all
  `chore:`/`docs:`/`test:`). Merge a `feat:`/`fix:`, or force one with `Release-As:`.
- **The release PR has no checks** — expected, not a failure. The bot runs on the
  default `GITHUB_TOKEN`, and a PR opened with it does not trigger other workflows. This
  is accepted because publish is chained by `needs:` in the same run, the ruleset
  requires no status checks, and release PRs only touch version fields and the
  changelog. If required status checks
  are ever added to the ruleset, give the `release-please` job an App token
  (`actions/create-github-app-token`) so the release PR triggers them.
- **Merged the PR but no tag/release** — re-run the workflow
  (*Actions → Release → Run workflow*); re-runs re-detect the merged PR.
