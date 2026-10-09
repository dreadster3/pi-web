import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
// The picker replaced the sidebar's own worktree dropdown: the local branches'
// quick switch and delete rows live there now.
const picker = await readFile(new URL("./ProjectWorktreePicker.tsx", import.meta.url), "utf8");

test("uses the server-resolved current worktree identity", () => {
  assert.match(source, /currentWorktreePath: string \| null/);
  assert.match(
    source,
    /const currentWorktree =[\s\S]*?worktreeState\.currentWorktreePath[\s\S]*?worktree\.path === worktreeState\.currentWorktreePath/,
  );
  assert.match(source, /if \(currentWorktreePath === path\) setSelectedCwd\(project\.root\);/);
  assert.doesNotMatch(source, /const isCurrent = wt\.path === selectedCwd/);
});

test("lists local branches for quick switching next to the worktrees", () => {
  // The API carries the branch list, the sidebar keeps it on its worktree
  // state, and the picker lists it under the checkouts.
  assert.match(source, /branches: string\[\]/);
  assert.match(source, /branches: d\.branches \?\? \[\]/);
  assert.match(picker, /t\("sidebar\.localBranches"\)/);
  assert.match(
    picker,
    /const holder = \(worktrees \?\? \[\]\)\.find\(\(worktree\) => worktree\.branch === branch\)/,
  );
  // A branch a checkout holds moves there; any other creates the checkout in
  // one shared flow with the "New worktree…" form.
  assert.match(
    picker,
    /if \(holder\) \{[\s\S]*?onPick\(\{ cwd: holder\.path, projectKey: project\.key, projectRoot: project\.root \}, "worktree"\)[\s\S]*?\n          \}\n          void createWorktreeAtBranch\(branch\);/,
  );
  assert.match(picker, /const createWorktreeAtBranch = async \(branch: string\) => \{/);
});

test("deletes an unheld local branch from the dropdown behind a confirm row", () => {
  // The branch row carries a bin button only for branches no worktree holds,
  // and it opens the confirm body rather than deleting at once.
  assert.match(
    picker,
    /secondary: onDeleteBranch && !holder \? \{[\s\S]*?label: t\("sidebar\.deleteBranchTitle", \{ branch \}\)[\s\S]*?showBody\(\{ kind: "delete-branch", branch, force: false, busy: false, error: null \}\)/,
  );
  // The confirm row asks before deleting; the unmerged pass is the force retry.
  assert.match(picker, /body\?\.kind === "delete-branch" && body\.branch === branch/);
  assert.match(
    picker,
    /<BranchConfirmRow\s+busy=\{body\.busy\}\s+force=\{body\.force\}/,
  );
  assert.match(
    picker,
    /t\(force \? "sidebar\.confirmForceDeleteBranch" : "sidebar\.confirmDeleteBranch"\)/,
  );
  assert.match(picker, /onDelete=\{\(\) => \{ void deleteBranch\(branch, body\.force\); \}\}/);
  // API call: the unmerged 409 arms the force retry, success refreshes the
  // list without closing the menu (the sidebar keeps the dropdown out of it).
  assert.match(
    source,
    /const handleDeleteBranch = useCallback\(async \(project: ProjectChoice, branch: string, force: boolean\): Promise<BranchDeletion> => \{[\s\S]*?fetch\("\/api\/branches", \{[\s\S]*?method: "DELETE"[\s\S]*?branch, force \}\),/,
  );
  assert.match(source, /if \(data\.unmerged && !force\) return "unmerged";/);
  assert.match(source, /setWtRefreshKey\(\(k\) => k \+ 1\);\n      return "deleted";/);
  assert.match(
    picker,
    /if \(result === "unmerged"\) return \{ \.\.\.menuState, body: \{ kind: "delete-branch", branch, force: true, busy: false, error: null \} \};/,
  );
  assert.doesNotMatch(source, /handleDeleteBranch[\s\S]{0,600}?setWtDropdownOpen\(false\)/);
});
