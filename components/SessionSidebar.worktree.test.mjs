import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");

test("uses the server-resolved current worktree identity", () => {
  assert.match(source, /currentWorktreePath: string \| null/);
  assert.match(
    source,
    /const currentWorktree =[\s\S]*?worktreeState\.currentWorktreePath[\s\S]*?worktree\.path === worktreeState\.currentWorktreePath/,
  );
  assert.match(source, /if \(currentWorktreePath === path\) setSelectedCwd\(worktreeState\.projectRoot\)/);
  assert.doesNotMatch(source, /const isCurrent = wt\.path === selectedCwd/);
});

test("lists local branches for quick switching next to the worktrees", () => {
  // The API carries the branch list, and a branch that already has a checkout
  // selects that worktree instead of creating one.
  assert.match(source, /branches: string\[\]/);
  assert.match(source, /branches: d\.branches \?\? \[\]/);
  assert.match(source, /t\("sidebar\.localBranches"\)/);
  assert.match(
    source,
    /const worktreeForBranch = worktreeState\.worktrees\.find\(\(w\) => w\.branch === branch\)/,
  );
  assert.match(
    source,
    /worktreeForBranch\n\s+\? \(setSelectedCwd\(worktreeForBranch\.path\), setWtDropdownOpen\(false\), setWtError\(null\), setWtFilter\(""\)\)\n\s+: void handleUseBranch\(branch\)/,
  );
  // The branch list honors the worktree filter, and creation is one shared flow.
  assert.match(
    source,
    /const visibleBranches = wtFilter\.trim\(\)[\s\S]*?worktreeState\.branches\.filter/,
  );
  assert.match(source, /const handleCreateWorktree = useCallback\(\s*\(\) => handleUseBranch\(wtNewBranch\)/);
});
