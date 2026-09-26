import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, statSync } from "fs";
import { homedir } from "os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from "path";
import { CONFIG_DIR_NAME, DefaultPackageManager, SettingsManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import { parseFrontmatter } from "./frontmatter";

/**
 * The pi-subagents agent catalog for one cwd: every agent definition the
 * installed `pi-subagents` package and pi's settings files make available.
 *
 * Pi Web does not import pi-subagents — its exports map forbids `src/*` — so
 * this module reads the same files `src/agents/agents.js` discovers and
 * reimplements the read-only half of that discovery. Only files are read, and
 * nothing here executes agent code.
 *
 * Sources follow pi-subagents' precedence: project > user > package > builtin.
 * Same-name entries from every source are listed; rows a higher-precedence
 * source shadows carry `overriddenBy`.
 */

export type AgentCatalogSource = "builtin" | "package" | "user" | "project";

export interface AgentCatalogAgent {
  name: string;
  displayName?: string;
  description: string;
  source: AgentCatalogSource;
  filePath: string;
  aliases?: string[];
  model?: string;
  thinking?: string;
  tools?: string[];
  excludeTools?: string[];
  advertise?: boolean;
  disabled?: boolean;
  /** Source of the same-name entry that wins over this one, if any. */
  overriddenBy?: AgentCatalogSource;
  /** Set only when the definition provably cannot run — an external CLI missing from PATH. */
  executable?: boolean;
}

/** pi-subagents' `AGENT_SOURCE_PRIORITY`. */
const SOURCE_RANK: Record<AgentCatalogSource, number> = {
  builtin: 0,
  package: 1,
  user: 2,
  project: 3,
};

const EXTRA_AGENT_DIRS_ENV = "PI_SUBAGENT_EXTRA_AGENT_DIRS";
const PI_SUBAGENTS_PACKAGE = "pi-subagents";

/** Override fields this catalog shows. Everything else in a settings override is runtime-only. */
interface CatalogSettings {
  overrides: Record<string, Record<string, unknown>>;
  defaultModel?: string;
  defaultProvider?: string;
  defaultThinking?: string;
  disableBuiltins?: boolean;
  agentScanDirs: string[];
}

function emptySettings(): CatalogSettings {
  return { overrides: {}, agentScanDirs: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function manifestAgentDirs(section: unknown): string[] {
  if (!isRecord(section) || !Array.isArray(section.agents)) return [];
  return section.agents.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Booleans in an agent file read as YAML (`true`) or as the string pi-subagents'
 * own line parser produces (`"true"`); both mean the same thing here.
 */
function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** `parseFrontmatterList`: comma-separated scalars, YAML block lists, or a repeated key's list. */
function frontmatterList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = Array.isArray(value)
    ? value.map(String)
    : String(value)
      .split("\n")
      .flatMap((line) => {
        const text = line.trim();
        const item = /^-\s+(.+)$/.exec(text);
        return (item?.[1] ?? text).split(",");
      });
  const items = raw.map((entry) => entry.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function readSubagentSettings(filePath: string): CatalogSettings {
  const subagents = readJsonObject(filePath)?.subagents;
  if (!isRecord(subagents)) return emptySettings();

  const overrides: Record<string, Record<string, unknown>> = {};
  if (isRecord(subagents.agentOverrides)) {
    for (const [name, value] of Object.entries(subagents.agentOverrides)) {
      if (isRecord(value)) overrides[name] = value;
    }
  }
  return {
    overrides,
    ...(stringValue(subagents.defaultModel) ? { defaultModel: stringValue(subagents.defaultModel) } : {}),
    ...(stringValue(subagents.defaultProvider) ? { defaultProvider: stringValue(subagents.defaultProvider) } : {}),
    ...(stringValue(subagents.defaultThinking) ? { defaultThinking: stringValue(subagents.defaultThinking) } : {}),
    ...(typeof subagents.disableBuiltins === "boolean" ? { disableBuiltins: subagents.disableBuiltins } : {}),
    agentScanDirs: Array.isArray(subagents.agentScanDirs)
      ? subagents.agentScanDirs.filter((dir): dir is string => typeof dir === "string" && dir.trim().length > 0)
      : [],
  };
}

function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function realPathOrResolve(dir: string): string {
  try {
    return realpathSync.native(dir);
  } catch {
    return resolve(dir);
  }
}

/** `~/.pi` and `~/.agents` are user configuration, never an implicit project. */
function isHomeDirectory(dir: string): boolean {
  const windowsProfile = process.env.HOMEDRIVE && process.env.HOMEPATH
    ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
    : undefined;
  for (const value of [homedir(), process.env.HOME, process.env.USERPROFILE, windowsProfile]) {
    const trimmed = value?.trim();
    if (!trimmed || !isDirectory(trimmed)) continue;
    if (realPathOrResolve(trimmed) === realPathOrResolve(dir)) return true;
  }
  return false;
}

function projectRootCandidates(cwd: string): string[] {
  const roots: string[] = [];
  let current = resolve(cwd);
  while (true) {
    if (isDirectory(current) && isHomeDirectory(current)) return roots;
    if (isDirectory(join(current, CONFIG_DIR_NAME)) || isDirectory(join(current, ".agents"))) {
      roots.push(current);
    }
    const parent = dirname(current);
    if (parent === current) return roots;
    current = parent;
  }
}

function findNearestGitRoot(cwd: string): string | null {
  let current = resolve(cwd);
  while (true) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * `findConfiguredProjectRoot`: the nearest ancestor holding `.pi` or `.agents`,
 * unless a `subagents.projectRootResolution: "git-root"` setting in the walk
 * redirects discovery to the repository root.
 */
export function findConfiguredProjectRoot(cwd: string): string | null {
  const candidates = projectRootCandidates(cwd);
  const nearest = candidates[0];
  if (!nearest) return null;

  let policyRoot: string | undefined;
  let policyIndex = -1;
  for (const [index, candidate] of candidates.entries()) {
    const mode = readJsonObject(join(candidate, CONFIG_DIR_NAME, "settings.json"))?.subagents;
    const resolution = isRecord(mode) ? mode.projectRootResolution : undefined;
    if (resolution === "nearest") return nearest;
    if (resolution === "git-root") {
      policyRoot = candidate;
      policyIndex = index;
      break;
    }
  }
  if (!policyRoot) return nearest;

  const gitRoot = findNearestGitRoot(cwd);
  const gitProjectRoot = gitRoot
    ? candidates.slice(policyIndex).find((candidate) => resolve(candidate) === resolve(gitRoot))
    : undefined;
  const configuredGitRoot = existsSync(join(policyRoot, ".git")) ? policyRoot : undefined;
  return gitProjectRoot ?? configuredGitRoot ?? nearest;
}

function existingDirs(dirs: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const dir of dirs) {
    if (!dir || !existsSync(dir) || seen.has(dir)) continue;
    seen.add(dir);
    result.push(dir);
  }
  return result;
}

function expandHome(filePath: string): string {
  if (filePath === "~") return homedir();
  if (filePath.startsWith("~/")) return join(homedir(), filePath.slice(2));
  return filePath;
}

/** Relative scan dirs resolve against the settings file, not the process cwd. */
function resolveScanDirs(entries: readonly string[], baseDir: string): string[] {
  return entries.map((entry) => {
    const expanded = expandHome(entry.trim());
    return isAbsolute(expanded) ? expanded : resolve(baseDir, expanded);
  });
}

function agentDir(): string {
  try {
    return getAgentDir();
  } catch {
    return "";
  }
}

/**
 * pi's own package-source resolution for the root of a configured package:
 * `npm:`/`git:` live under the scope's `npm/node_modules` or `git/` tree, and a
 * `file:`/bare path is resolved against the scope's base dir (agent dir for a
 * user package, `<cwd>/.pi` for a project package).
 */
function resolvePackageSource(source: string, scope: "user" | "project", cwd: string, userAgentDir: string): string | undefined {
  const trimmed = source.trim();
  const baseDir = scope === "project" ? join(cwd, CONFIG_DIR_NAME) : userAgentDir;
  if (trimmed.startsWith("npm:")) {
    const name = trimmed.slice(4).replace(/@[^@/]*$/, "").trim();
    return name ? join(baseDir, "npm", "node_modules", name) : undefined;
  }
  if (trimmed.startsWith("git:")) {
    const spec = trimmed.slice(4).replace(/@[^@/]*$/, "").replace(/\.git$/, "");
    const slash = spec.indexOf("/");
    return slash < 0 ? undefined : join(baseDir, "git", spec.slice(0, slash), spec.slice(slash + 1));
  }
  const local = trimmed.startsWith("file:") ? trimmed.slice(5) : trimmed;
  if (!local || /^[a-z]+:\/\//i.test(local)) return undefined;
  const expanded = expandHome(local);
  return isAbsolute(expanded) ? expanded : resolve(baseDir, expanded);
}

function userAgentDirs(settings: CatalogSettings): string[] {
  const dir = agentDir();
  return existingDirs([
    ...(process.env[EXTRA_AGENT_DIRS_ENV] ?? "").split(delimiter),
    ...(dir ? resolveScanDirs(settings.agentScanDirs, dir) : []),
    dir ? join(dir, "agents") : "",
    join(homedir(), ".agents"),
  ]);
}

/**
 * `findConfiguredProjectRoot(cwd) ?? cwd`, so a bare directory is its own
 * project. `.pi/agents` ranks above the legacy `.agents` only by directory
 * order — both are read.
 */
function projectAgentDirs(cwd: string): { root: string; dirs: string[] } {
  const root = findConfiguredProjectRoot(cwd) ?? resolve(cwd);
  const settingsPath = join(root, CONFIG_DIR_NAME, "settings.json");
  const settings = readSubagentSettings(settingsPath);
  return {
    root,
    dirs: existingDirs([
      ...resolveScanDirs(settings.agentScanDirs, dirname(settingsPath)),
      join(root, ".agents"),
      join(root, CONFIG_DIR_NAME, "agents"),
    ]),
  };
}

/** Agent dirs declared by a package's own manifest, plus pi-subagents' bundled `agents/`. */
function packageAgentDirs(cwd: string): { dirs: string[]; builtinDirs: string[] } {
  const dirs: string[] = [];
  const builtinDirs: string[] = [];
  try {
    // `resolvePath` turns the package source into its on-disk root with the same
    // base dir pi's own package manager uses; its `installedPath` is unset for
    // some local forms, so derive from the source instead of trusting it.
    const userAgentDir = agentDir();
    const settingsManager = SettingsManager.create(cwd, userAgentDir || undefined, { projectTrusted: true });
    const manager = new DefaultPackageManager({ cwd, agentDir: userAgentDir, settingsManager });
    for (const pkg of manager.listConfiguredPackages()) {
      const packageRoot = pkg.installedPath ?? resolvePackageSource(pkg.source, pkg.scope, cwd, userAgentDir);
      if (!packageRoot) continue;
      const manifest = readJsonObject(join(packageRoot, "package.json"));
      if (stringValue(manifest?.name) === PI_SUBAGENTS_PACKAGE) {
        // The bundled built-ins are `<pkgRoot>/agents`, not a manifest entry.
        builtinDirs.push(join(packageRoot, "agents"));
      }
      const declaredAgents = [
        manifestAgentDirs(manifest?.["pi-subagents"]),
        manifestAgentDirs(isRecord(manifest?.pi) ? manifest.pi.subagents : undefined),
      ].flat();
      for (const entry of declaredAgents) dirs.push(resolve(packageRoot, entry));
    }
  } catch {
    // Configured packages are optional; a broken settings file must not hide the rest.
  }
  return { dirs: existingDirs(dirs), builtinDirs: existingDirs(builtinDirs) };
}

function commandAvailable(command: string): boolean {
  const hasSeparator = command.includes("/") || command.includes("\\");
  const candidates = isAbsolute(command) || hasSeparator
    ? [resolve(command)]
    : (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((dir) => join(dir, command));
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const candidate of candidates) {
    for (const extension of extensions) {
      try {
        accessSync(`${candidate}${extension}`, constants.X_OK);
        return true;
      } catch {
        // Keep probing.
      }
    }
  }
  return false;
}

function parseAgentFile(filePath: string, source: AgentCatalogSource): AgentCatalogAgent | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const { data } = parseFrontmatter(content);
  if (!data) return null;
  // pi-subagents skips a definition missing either key, so the catalog does too.
  const name = stringValue(data.name);
  const description = stringValue(data.description);
  if (!name || !description) return null;

  const aliases = frontmatterList(data.aliases ?? data.alias)?.filter((alias, index, all) => alias !== name && all.indexOf(alias) === index);
  const tools = frontmatterList(data.tools);
  const excludeTools = frontmatterList(data.excludeTools);
  const thinking = (stringValue(data.thinking) ?? (booleanValue(data.thinking) === false ? "false" : undefined))?.toLowerCase();
  const runner = isRecord(data.runner) ? data.runner : undefined;
  const runnerCommand = runner?.type === "external-cli" ? stringValue(runner.command) : undefined;
  const displayName = stringValue(data.display_name);
  const model = stringValue(data.model);
  const advertise = booleanValue(data.advertise);

  return {
    name,
    ...(displayName ? { displayName } : {}),
    description,
    source,
    filePath,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
    ...(tools ? { tools } : {}),
    ...(excludeTools ? { excludeTools } : {}),
    ...(thinking && thinking !== "false" ? { thinking } : {}),
    ...(advertise !== undefined ? { advertise } : {}),
    ...(model ? { model } : {}),
    ...(runnerCommand && !commandAvailable(runnerCommand) ? { executable: false } : {}),
  };
}

/** pi-subagents prunes these directory names while walking an agent directory. */
function prunedAgentDirName(name: string): boolean {
  return name === ".git" || name === "node_modules" || name === ".pi" || name === "sync-backups";
}

/** `isLegacyAgentSkillPath`: `.agents/skills` holds skills, not agent definitions. */
function isLegacySkillDir(rootDir: string, dir: string): boolean {
  const parts = relative(rootDir, dir).split(/[/\\]/).map((part) => part.toLowerCase());
  if (basename(rootDir).toLowerCase() === ".agents") parts.unshift(".agents");
  return parts.some((part, index) => part === ".agents" && parts[index + 1] === "skills");
}

function isNestedProjectRoot(rootDir: string, dir: string): boolean {
  return resolve(dir) !== resolve(rootDir)
    && (isDirectory(join(dir, CONFIG_DIR_NAME)) || isDirectory(join(dir, ".agents")));
}

function readAgentDir(dir: string, source: AgentCatalogSource): AgentCatalogAgent[] {
  const rows: AgentCatalogAgent[] = [];
  const visited = new Set<string>();
  const walk = (current: string): void => {
    let real: string;
    try {
      real = realpathSync(current);
    } catch {
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(entryPath))) {
        if (!prunedAgentDirName(entry.name) && !isLegacySkillDir(dir, entryPath) && !isNestedProjectRoot(dir, entryPath)) {
          walk(entryPath);
        }
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      if (!entry.name.endsWith(".md") || entry.name.endsWith(".chain.md")) continue;
      const row = parseAgentFile(entryPath, source);
      if (row) rows.push(row);
    }
  };
  walk(dir);
  return rows;
}

function applyOverride(row: AgentCatalogAgent, override: Record<string, unknown> | undefined): AgentCatalogAgent {
  if (!override) return row;
  const next: AgentCatalogAgent = { ...row };
  const description = stringValue(override.description);
  if (description) next.description = description;
  if (override.model === false) delete next.model;
  else if (typeof override.model === "string") next.model = override.model;
  if (override.thinking === false) delete next.thinking;
  else if (typeof override.thinking === "string") next.thinking = override.thinking;
  if (override.tools === "inherit") delete next.tools;
  else if (override.tools === false) next.tools = [];
  else if (Array.isArray(override.tools)) next.tools = override.tools.map(String);
  if (override.excludeTools === false) delete next.excludeTools;
  else if (Array.isArray(override.excludeTools)) next.excludeTools = override.excludeTools.map(String);
  if (typeof override.disabled === "boolean") next.disabled = override.disabled;
  return next;
}

/** pi-subagents' `applySubagentDefaults`, reduced to the fields this panel shows. */
function applyDefaults(row: AgentCatalogAgent, settings: CatalogSettings): AgentCatalogAgent {
  const next: AgentCatalogAgent = { ...row };
  // pi-subagents keeps `model` and `modelProvider` separate; the panel shows one
  // string, so only a bare model id gets the configured provider folded in.
  if (!next.model && settings.defaultModel) next.model = settings.defaultModel;
  if (next.model && settings.defaultProvider && !next.model.includes("/")) {
    next.model = `${settings.defaultProvider}/${next.model}`;
  }
  if (!next.thinking && settings.defaultThinking) next.thinking = settings.defaultThinking;
  return next;
}

/**
 * Every agent definition visible for `cwd`, including rows shadowed by a
 * higher-precedence source. Never throws: missing directories, a missing
 * `pi-subagents` install, unreadable files and malformed settings all mean
 * "no entry".
 */
export function listAgentCatalog(cwd: string): AgentCatalogAgent[] {
  const dir = agentDir();
  const userSettings = readSubagentSettings(dir ? join(dir, "settings.json") : "");
  const project = projectAgentDirs(cwd);
  const projectSettings = readSubagentSettings(join(project.root, CONFIG_DIR_NAME, "settings.json"));
  const { dirs: packageDirs, builtinDirs } = packageAgentDirs(cwd);

  const sources: Array<{ source: AgentCatalogSource; dirs: string[] }> = [
    { source: "builtin", dirs: builtinDirs },
    { source: "package", dirs: packageDirs },
    { source: "user", dirs: userAgentDirs(userSettings) },
    { source: "project", dirs: project.dirs },
  ];

  const effectiveDefaults: CatalogSettings = {
    overrides: {},
    defaultModel: projectSettings.defaultModel ?? userSettings.defaultModel,
    defaultProvider: projectSettings.defaultProvider ?? userSettings.defaultProvider,
    defaultThinking: projectSettings.defaultThinking ?? userSettings.defaultThinking,
    agentScanDirs: [],
  };

  const scored: Array<{ row: AgentCatalogAgent; rank: number }> = [];
  for (const { source, dirs } of sources) {
    const rows = dirs.flatMap((agentDirPath) => readAgentDir(agentDirPath, source));
    // Built-ins and packages are first-wins across directories, user and project last-wins.
    const ordered = source === "package" ? [...rows].reverse() : rows;
    const seenPaths = new Set<string>();
    ordered.forEach((row, index) => {
      if (seenPaths.has(row.filePath)) return;
      seenPaths.add(row.filePath);
      // A settings override applies to every source; the built-in scope resolves
      // project-then-user, a custom definition merges user-then-project.
      const override = source === "builtin"
        ? projectSettings.overrides[row.name] ?? userSettings.overrides[row.name]
        : { ...userSettings.overrides[row.name], ...projectSettings.overrides[row.name] };
      let next = applyDefaults(applyOverride(row, override), effectiveDefaults);
      if (source === "builtin" && next.disabled !== true) {
        const projectBulk = projectSettings.disableBuiltins === true;
        const userBulk = projectSettings.disableBuiltins === undefined && userSettings.disableBuiltins === true;
        if (projectBulk || userBulk) next = { ...next, disabled: true };
      }
      scored.push({ row: next, rank: SOURCE_RANK[source] * 1_000_000 + index });
    });
  }

  // Per name: the highest-precedence entry wins, and every other row of that
  // name reports which source shadowed it. Same-source collisions (two packages
  // or two user dirs defining one name) count too, so the comparison is by the
  // winning rank, not by the source id.
  const winners = new Map<string, { rank: number; source: AgentCatalogSource }>();
  for (const { row, rank } of scored) {
    const current = winners.get(row.name);
    if (!current || rank > current.rank) winners.set(row.name, { rank, source: row.source });
  }

  return scored
    .map(({ row, rank }) => {
      const winner = winners.get(row.name);
      return winner && winner.rank > rank ? { ...row, overriddenBy: winner.source } : row;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
}
