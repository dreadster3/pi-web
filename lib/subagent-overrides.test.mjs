import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createJiti } from "jiti";

const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const testAgentDir = await mkdtemp(join(tmpdir(), "pi-web-subagent-overrides-"));
process.env.PI_CODING_AGENT_DIR = testAgentDir;

const { getUserSubagentSettingsPath, setSubagentOverrideDisabled } = await createJiti(import.meta.url)
  .import("./subagent-overrides.ts");

const settingsPath = getUserSubagentSettingsPath();

after(async () => {
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  await rm(testAgentDir, { recursive: true, force: true });
});

async function resetSettings(value) {
  await rm(settingsPath, { force: true });
  if (value !== undefined) await writeFile(settingsPath, JSON.stringify(value, null, 2));
}

async function readSettings() {
  return JSON.parse(await readFile(settingsPath, "utf8"));
}

test("disable writes the override, creating nested objects, and preserves other settings", async () => {
  await resetSettings({
    theme: "dark",
    subagents: { defaultModel: "prov/default", agentOverrides: { reviewer: { description: "Tuned" } } },
  });

  setSubagentOverrideDisabled("/tmp/cwd", "reviewer", true);

  const settings = await readSettings();
  assert.equal(settings.theme, "dark");
  assert.equal(settings.subagents.defaultModel, "prov/default");
  assert.equal(settings.subagents.agentOverrides.reviewer.description, "Tuned");
  assert.equal(settings.subagents.agentOverrides.reviewer.disabled, true);
});

test("disable creates the settings file and nested objects when none exist", async () => {
  await resetSettings(undefined);
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);

  const settings = await readSettings();
  assert.deepEqual(settings, { subagents: { agentOverrides: { oracle: { disabled: true } } } });
});

test("enable removes only the disabled key and keeps the rest of the entry", async () => {
  await resetSettings({
    subagents: { agentOverrides: { reviewer: { description: "Tuned", disabled: true, model: "p/m" } } },
  });

  setSubagentOverrideDisabled("/tmp/cwd", "reviewer", false);

  const settings = await readSettings();
  assert.deepEqual(settings.subagents.agentOverrides.reviewer, { description: "Tuned", model: "p/m" });
});

test("enable prunes an entry that becomes empty, then agentOverrides, then subagents", async () => {
  await resetSettings({ subagents: { agentOverrides: { reviewer: { disabled: true } }, defaultModel: "prov/default" } });
  setSubagentOverrideDisabled("/tmp/cwd", "reviewer", false);
  assert.deepEqual(await readSettings(), { subagents: { defaultModel: "prov/default" } });

  await resetSettings({ subagents: { agentOverrides: { reviewer: { disabled: true } } } });
  setSubagentOverrideDisabled("/tmp/cwd", "reviewer", false);
  assert.deepEqual(await readSettings(), {});
});

test("enable with no existing override is a no-op that does not create a file", async () => {
  await resetSettings(undefined);
  setSubagentOverrideDisabled("/tmp/cwd", "missing", false);
  await assert.rejects(readFile(settingsPath, "utf8"), { code: "ENOENT" });
});

test("the write is idempotent and preserves unrelated nested subagents keys", async () => {
  await resetSettings({ subagents: { disableBuiltins: true, agentScanDirs: ["~/agents"], agentOverrides: {} } });
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);

  const settings = await readSettings();
  assert.equal(settings.subagents.disableBuiltins, true);
  assert.deepEqual(settings.subagents.agentScanDirs, ["~/agents"]);
  assert.deepEqual(settings.subagents.agentOverrides, { oracle: { disabled: true } });
});

test("an existing file's permission bits survive the atomic replace", async () => {
  await resetSettings({ subagents: {} });
  await chmod(settingsPath, 0o640);
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);
  assert.equal((await stat(settingsPath)).mode & 0o777, 0o640);
});

test("the settings directory is created when it is missing", async () => {
  await rm(testAgentDir, { recursive: true, force: true });
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);
  assert.deepEqual(await readSettings(), { subagents: { agentOverrides: { oracle: { disabled: true } } } });
  await rm(testAgentDir, { recursive: true, force: true });
});

test("a non-user scope is rejected rather than silently writing", async () => {
  await resetSettings(undefined);
  assert.throws(() => setSubagentOverrideDisabled("/tmp/cwd", "oracle", true, "project"), /not supported/);
  await assert.rejects(readFile(settingsPath, "utf8"), { code: "ENOENT" });
});

test("a non-object settings file is refused instead of being replaced", async () => {
  await mkdir(testAgentDir, { recursive: true });
  await writeFile(settingsPath, "[]");
  assert.throws(() => setSubagentOverrideDisabled("/tmp/cwd", "oracle", true), /expected an object/);
  assert.equal(await readFile(settingsPath, "utf8"), "[]");
});

test("no temp files are left behind after a write", async () => {
  await resetSettings(undefined);
  setSubagentOverrideDisabled("/tmp/cwd", "oracle", true);
  const entries = await readdir(testAgentDir);
  assert.deepEqual(entries.filter((name) => name.endsWith(".tmp")), []);
});
