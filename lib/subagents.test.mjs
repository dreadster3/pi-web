import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createJiti } from "jiti";

const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const testAgentDir = await mkdtemp(join(tmpdir(), "pi-web-subagents-global-"));
process.env.PI_CODING_AGENT_DIR = testAgentDir;

const {
  deleteSubagentProfile,
  deleteProjectSubagentProfile,
  listSubagentProfileSources,
  readSubagentRun,
  readSubagentSessionResources,
  saveSubagentProfile,
  saveProjectSubagentProfile,
  SUBAGENT_META_TYPE,
  SUBAGENT_STATUS_TYPE,
  SUBAGENT_RESULT_TYPE,
} = await createJiti(import.meta.url).import("./subagents.ts");
const { isSubagentProfileOverridden } = await createJiti(import.meta.url).import("./subagent-profile-precedence.ts");

after(async () => {
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  await rm(testAgentDir, { recursive: true, force: true });
});

const SCOPE_PRIORITY = { builtin: 0, global: 1, workspace: 2, project: 3 };

/** Highest-precedence source with this name, the order pi-web's panel lists sources in. */
function effectiveProfile(cwd, name) {
  return listSubagentProfileSources(cwd)
    .filter((item) => item.name.toLowerCase() === name.trim().toLowerCase())
    .sort((a, b) => SCOPE_PRIORITY[a.scope] - SCOPE_PRIORITY[b.scope])
    .at(-1);
}

function profile(overrides = {}) {
  return {
    name: "test-agent",
    displayName: " Test agent ",
    description: " Test description ",
    systemPrompt: " Test prompt. ",
    tools: ["read", "read", "unknown-tool"],
    loadSkills: false,
    loadExtensions: false,
    model: " provider/model ",
    thinking: "high",
    maxTurns: 4.9,
    inheritContext: false,
    runInBackground: false,
    enabled: true,
    ...overrides,
  };
}

test("override detection follows scope precedence case-insensitively", () => {
  const builtin = { name: "Reviewer", scope: "builtin" };
  const global = { name: "reviewer", scope: "global" };
  const workspace = { name: "REVIEWER", scope: "workspace" };
  const project = { name: "Reviewer", scope: "project" };
  const unrelated = { name: "other", scope: "builtin" };
  const profiles = [builtin, global, workspace, project, unrelated];

  assert.equal(isSubagentProfileOverridden(builtin, profiles), true);
  assert.equal(isSubagentProfileOverridden(global, profiles), true);
  assert.equal(isSubagentProfileOverridden(workspace, profiles), true);
  assert.equal(isSubagentProfileOverridden(project, profiles), false);
  assert.equal(isSubagentProfileOverridden(unrelated, profiles), false);
});

test("project profiles override built-ins and round-trip their runtime settings", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    saveProjectSubagentProfile(cwd, {
      name: "Explore",
      displayName: "Repository scout",
      description: "Inspect this repository",
      systemPrompt: "Read carefully and report findings.",
      tools: ["read", "grep"],
      loadSkills: true,
      loadExtensions: true,
      model: "anthropic/test-model",
      thinking: "high",
      maxTurns: 8,
      inheritContext: true,
      runInBackground: true,
      enabled: true,
    });

    const profile = effectiveProfile(cwd, "Explore");
    assert.equal(profile.scope, "project");
    assert.equal(profile.displayName, "Repository scout");
    assert.deepEqual(profile.tools, ["read", "grep"]);
    assert.equal(profile.loadSkills, true);
    assert.equal(profile.loadExtensions, true);
    assert.equal(profile.thinking, "high");
    assert.equal(profile.maxTurns, 8);
    assert.equal(profile.inheritContext, true);
    assert.equal(profile.runInBackground, true);

    const source = await readFile(join(cwd, ".pi", "agents", "Explore.md"), "utf8");
    assert.match(source, /max_turns: 8/);
    assert.match(source, /load_skills: true/);
    assert.match(source, /load_extensions: true/);
    assert.match(source, /Read carefully and report findings\./);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("extension selectors stay readable on a profile without dropping built-in tools", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "agents", "legacy.md"),
      "---\ndescription: Legacy\ntools: read, ext:mcp/search, write\ndisallowed_tools: write\n---\nInspect only.\n",
    );
    const profile = effectiveProfile(cwd, "legacy");
    assert.deepEqual(profile.tools, ["read"]);
    assert.deepEqual(profile.extensionTools, ["ext:mcp/search"]);
    assert.equal(profile.loadSkills, false);
    assert.equal(profile.loadExtensions, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("reads tintinweb profile aliases and frontmatter identity", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-tintin-"));
  try {
    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    await writeFile(join(cwd, ".pi", "agents", "review.md"), `---
name: security-review
color: cyan
skills: true
extensions: false
prompt_mode: replace
isolation: worktree
persist_session: false
disallowed_tools: bash
---
Review securely.
`);
    const profile = effectiveProfile(cwd, "security-review");
    assert.equal(profile.name, "security-review");
    assert.equal(profile.loadSkills, true);
    assert.equal(profile.loadExtensions, false);
    assert.equal(profile.promptMode, "replace");
    assert.equal(profile.color, "cyan");
    assert.equal(profile.isolation, "worktree");
    assert.equal(profile.persistSession, false);
    assert.equal(profile.tools.includes("bash"), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("persisted subagent metadata reconstructs the final run", () => {
  const entries = [
    {
      type: "custom",
      customType: SUBAGENT_META_TYPE,
      id: "meta",
      parentId: null,
      timestamp: "2026-01-01T00:00:00.000Z",
      data: {
        version: 1,
        parentSessionId: "parent",
        parentSessionPath: "/tmp/parent.jsonl",
        parentToolCallId: "tool-call",
        profile: "Explore",
        description: "Find the parser",
        task: "Locate parser code",
        runInBackground: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      type: "custom",
      customType: SUBAGENT_RESULT_TYPE,
      id: "result",
      parentId: "meta",
      timestamp: "2026-01-01T00:01:00.000Z",
      data: {
        version: 1,
        status: "completed",
        completedAt: "2026-01-01T00:01:00.000Z",
        result: "Located it.",
      },
    },
  ];

  assert.deepEqual(readSubagentRun(entries, "child", "/tmp/child.jsonl"), {
    sessionId: "child",
    sessionPath: "/tmp/child.jsonl",
    parentSessionId: "parent",
    parentToolCallId: "tool-call",
    profile: "Explore",
    description: "Find the parser",
    task: "Locate parser code",
    runInBackground: true,
    status: "completed",
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    result: "Located it.",
  });
});

test("persisted subagent resources restore the exact isolated prompt and tools", () => {
  const entries = [{
    type: "custom",
    customType: SUBAGENT_META_TYPE,
    id: "meta",
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    data: {
      version: 1,
      parentSessionId: "parent",
      parentSessionPath: "/tmp/parent.jsonl",
      profile: "reviewer",
      resourceSnapshot: {
        version: 1,
        appendSystemPrompt: ["Review carefully.", "Inherited parent context."],
        tools: ["read", "grep", "web_search", "read"],
        loadSkills: true,
        loadExtensions: true,
      },
    },
  }];

  assert.deepEqual(readSubagentSessionResources(entries), {
    appendSystemPrompt: ["Review carefully.", "Inherited parent context."],
    tools: ["read", "grep", "web_search"],
    loadSkills: true,
    loadExtensions: true,
  });
});

test("legacy subagent resource snapshots keep skills and extensions disabled", () => {
  const entries = [{
    type: "custom",
    customType: SUBAGENT_META_TYPE,
    data: {
      version: 1,
      parentSessionId: "parent",
      parentSessionPath: "/tmp/parent.jsonl",
      resourceSnapshot: {
        version: 1,
        appendSystemPrompt: ["Stay focused."],
        tools: ["read"],
      },
    },
  }];

  assert.deepEqual(readSubagentSessionResources(entries), {
    appendSystemPrompt: ["Stay focused."],
    tools: ["read"],
    loadSkills: false,
    loadExtensions: false,
  });
});

test("an empty tool selection round-trips without restoring default tools", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    const saved = saveProjectSubagentProfile(cwd, profile({ tools: [] }));
    const loaded = effectiveProfile(cwd, saved.name);
    const source = await readFile(join(cwd, ".pi", "agents", `${saved.name}.md`), "utf8");

    assert.deepEqual(saved.tools, []);
    assert.deepEqual(loaded.tools, []);
    assert.match(source, /tools: none/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("saved profiles normalize runtime values and reject invalid settings", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    const saved = saveProjectSubagentProfile(cwd, profile());
    assert.equal(saved.displayName, "Test agent");
    assert.equal(saved.description, "Test description");
    assert.equal(saved.systemPrompt, "Test prompt.");
    assert.deepEqual(saved.tools, ["read"]);
    assert.equal(saved.model, "provider/model");
    assert.equal(saved.maxTurns, 4);
    assert.equal(saved.loadSkills, false);
    assert.equal(saved.loadExtensions, false);

    assert.throws(
      () => saveProjectSubagentProfile(cwd, profile({ name: "../escape" })),
      /Agent name may contain only/,
    );
    assert.throws(
      () => saveProjectSubagentProfile(cwd, profile({ thinking: "extreme" })),
      /Invalid thinking level/,
    );
    assert.throws(
      () => saveProjectSubagentProfile(cwd, profile({ maxTurns: Number.POSITIVE_INFINITY })),
      /Max turns must be a non-negative number/,
    );
    assert.throws(
      () => saveProjectSubagentProfile(cwd, profile({ maxTurns: -1 })),
      /Max turns must be a non-negative number/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("project profiles override workspace profiles and deletion restores the workspace version", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(cwd, ".agents"), { recursive: true });
    await writeFile(
      join(cwd, ".agents", "test-agent.md"),
      "---\ndescription: Workspace version\ntools: read\n---\nWorkspace prompt.\n",
    );
    saveProjectSubagentProfile(cwd, profile({ description: "Project version" }));
    assert.equal(effectiveProfile(cwd, "TEST-AGENT").description, "Project version");

    deleteProjectSubagentProfile(cwd, "test-agent");
    const restored = effectiveProfile(cwd, "test-agent");
    assert.equal(restored.scope, "workspace");
    assert.equal(restored.description, "Workspace version");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a session in a subdirectory reads project profiles from the nearest project root", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(root, ".pi", "agents"), { recursive: true });
    await writeFile(
      join(root, ".pi", "agents", "rooted.md"),
      "---\nname: rooted\ndescription: Defined at the project root\ntools: read\n---\nRoot prompt.\n",
    );
    const nested = join(root, "packages", "app");
    await mkdir(nested, { recursive: true });

    assert.equal(effectiveProfile(nested, "rooted").scope, "project");
    const saved = saveProjectSubagentProfile(nested, profile({ name: "nested", description: "From the subdirectory" }));
    assert.equal(saved.filePath, join(root, ".pi", "agents", "nested.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("global and project sources with the same name stay visible while project wins at runtime", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    saveSubagentProfile(cwd, "global", profile({ description: "Global version" }));
    saveSubagentProfile(cwd, "project", profile({ description: "Project version" }));

    const sources = listSubagentProfileSources(cwd)
      .filter((item) => item.name === "test-agent")
      .sort((a, b) => a.scope.localeCompare(b.scope));
    assert.deepEqual(sources.map((item) => item.scope), ["global", "project"]);
    assert.deepEqual(sources.map((item) => item.description), ["Global version", "Project version"]);

    const effective = effectiveProfile(cwd, "test-agent");
    assert.equal(effective.scope, "project");
    assert.equal(effective.description, "Project version");
  } finally {
    deleteSubagentProfile(cwd, "global", "test-agent");
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a disabled project profile is parsed with enabled: false", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    saveSubagentProfile(cwd, "global", profile({ description: "Global version" }));
    saveProjectSubagentProfile(cwd, profile({ enabled: false }));
    const sources = listSubagentProfileSources(cwd).filter((item) => item.name === "test-agent");
    const globalProfile = sources.find((item) => item.scope === "global");
    const projectProfile = sources.find((item) => item.scope === "project");

    assert.equal(isSubagentProfileOverridden(globalProfile, sources), true);
    assert.equal(isSubagentProfileOverridden(projectProfile, sources), false);
    assert.equal(effectiveProfile(cwd, "test-agent").enabled, false);
  } finally {
    deleteSubagentProfile(cwd, "global", "test-agent");
    await rm(cwd, { recursive: true, force: true });
  }
});

test("persisted runs distinguish interrupted, failed, aborted, and latest results", () => {
  const meta = {
    type: "custom",
    customType: SUBAGENT_META_TYPE,
    id: "meta",
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    data: {
      version: 1,
      parentSessionId: "parent",
      parentSessionPath: "/tmp/parent.jsonl",
      parentToolCallId: "tool-call",
      profile: "Explore",
      description: "Inspect",
      task: "Inspect files",
      runInBackground: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
  assert.equal(readSubagentRun([meta], "child", "/tmp/child.jsonl").status, "interrupted");

  const failed = {
    ...meta,
    id: "failed",
    customType: SUBAGENT_RESULT_TYPE,
    data: { version: 1, status: "failed", completedAt: "2026-01-01T00:01:00.000Z", error: "boom" },
  };
  const aborted = {
    ...failed,
    id: "aborted",
    data: { version: 1, status: "aborted", completedAt: "2026-01-01T00:02:00.000Z" },
  };
  assert.equal(readSubagentRun([meta, failed], "child", "/tmp/child.jsonl").status, "failed");
  assert.equal(readSubagentRun([meta, failed], "child", "/tmp/child.jsonl").error, "boom");
  assert.equal(readSubagentRun([meta, failed, aborted], "child", "/tmp/child.jsonl").status, "aborted");
  const resumed = { ...failed, id: "resumed", customType: SUBAGENT_STATUS_TYPE, data: { version: 1, status: "queued" } };
  assert.equal(readSubagentRun([meta, failed, resumed], "child", "/tmp/child.jsonl").status, "queued");
  assert.equal(readSubagentRun([{ ...meta, data: { version: 2 } }], "child", "/tmp/child.jsonl"), null);
});

test("project profile directories cannot escape the nearest project root through symbolic links", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "pi-web-subagent-boundary-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const cwd = join(base, "project", "nested");
  const outside = join(base, "outside");
  await mkdir(join(base, "project", ".agents"), { recursive: true });
  await mkdir(join(base, "project", ".pi"), { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(outside);
  await writeFile(join(outside, "secret.md"), "---\ndescription: Secret\n---\nprivate\n");

  try {
    await symlink(outside, join(base, "project", ".agents", "agents"), process.platform === "win32" ? "junction" : "dir");
    await symlink(outside, join(base, "project", ".pi", "agents"), process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("Creating symbolic links requires additional privileges on this platform");
      return;
    }
    throw error;
  }

  assert.equal(listSubagentProfileSources(cwd).some((item) => item.name === "secret"), false);
  assert.throws(
    () => saveProjectSubagentProfile(cwd, profile({ name: "escaped" })),
    /outside the project root/,
  );
  assert.throws(
    () => deleteProjectSubagentProfile(cwd, "secret"),
    /outside the project root/,
  );
  assert.match(await readFile(join(outside, "secret.md"), "utf8"), /private/);
});

test("a save keeps frontmatter keys this app does not manage", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    const file = join(cwd, ".pi", "agents", "orchestrator.md");
    await writeFile(
      file,
      [
        "---",
        "name: orchestrator",
        "description: Hands out work",
        "display_name: orchestrator",
        "tools: read, bash, edit, write, grep, find, ls, ext:pi-advisor-flow/ask_advisor",
        "skills: false",
        "extensions: pi-advisor-flow",
        "exclude_extensions: pi-advisor-flow",
        "allowed_subagents: thinker, executor",
        "disallowed_tools: write",
        "enabled: true",
        "inherit_context: false",
        "run_in_background: false",
        "---",
        "Dispatch the work.",
      ].join("\n"),
    );

    saveProjectSubagentProfile(cwd, profile({ name: "orchestrator", tools: ["read", "bash"] }));
    const source = await readFile(file, "utf8");

    assert.match(source, /^name: orchestrator$/m);
    assert.match(source, /allowed_subagents: thinker, executor/);
    assert.match(source, /exclude_extensions: pi-advisor-flow/);
    assert.match(source, /disallowed_tools: write/);
    assert.match(source, /skills: false/);
    assert.match(source, /extensions: pi-advisor-flow/);
    assert.match(source, /tools: read, bash, ext:pi-advisor-flow\/ask_advisor/);
    assert.match(source, /Test prompt\./);

    const loaded = effectiveProfile(cwd, "orchestrator");
    assert.deepEqual(loaded.tools, ["read", "bash"]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a save refuses to overwrite malformed existing frontmatter", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    const file = join(cwd, ".pi", "agents", "malformed.md");
    const source = "---\nallowed_subagents: [executor\n---\nKeep this file intact.\n";
    await writeFile(file, source);

    assert.throws(
      () => saveProjectSubagentProfile(cwd, profile({ name: "malformed" })),
      /existing frontmatter is invalid/,
    );
    assert.equal(await readFile(file, "utf8"), source);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the pi-subagents flag aliases are seeded, kept in step, and never overwrite a whitelist", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    const file = join(cwd, ".pi", "agents", "fresh.md");
    saveProjectSubagentProfile(cwd, profile({ name: "fresh", loadSkills: true, loadExtensions: true }));
    const seeded = await readFile(file, "utf8");
    assert.match(seeded, /load_skills: true/);
    assert.match(seeded, /skills: true/);
    assert.match(seeded, /load_extensions: true/);
    assert.match(seeded, /extensions: true/);

    saveProjectSubagentProfile(cwd, profile({ name: "fresh", loadSkills: false, loadExtensions: false }));
    const flipped = await readFile(file, "utf8");
    assert.match(flipped, /skills: false/);
    assert.match(flipped, /extensions: false/);

    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    const scoped = join(cwd, ".pi", "agents", "scoped.md");
    await writeFile(scoped, "---\ndescription: Scoped\nextensions: pi-advisor-flow\n---\nOnly the advisor.\n");
    saveProjectSubagentProfile(cwd, profile({ name: "scoped", loadExtensions: true }));
    assert.match(await readFile(scoped, "utf8"), /extensions: pi-advisor-flow/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("profile flags fall back to the pi-subagents spellings", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-subagents-"));
  try {
    await mkdir(join(cwd, ".pi", "agents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "agents", "legacy-flags.md"),
      "---\ndescription: Legacy flags\nskills: false\nextensions: pi-advisor-flow\n---\nScoped.\n",
    );

    const loaded = effectiveProfile(cwd, "legacy-flags");
    assert.equal(loaded.loadSkills, false);
    assert.equal(loaded.loadExtensions, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
