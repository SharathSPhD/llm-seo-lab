import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readMatter(path: string): Record<string, string> {
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key.length > 0) out[key] = value;
  }
  return out;
}

describe("plugin.json manifest", () => {
  const manifestPath = join(pluginRoot, ".cursor-plugin", "plugin.json");

  it("exists at .cursor-plugin/plugin.json", () => {
    assert.ok(statSync(manifestPath).isFile(), "plugin.json should exist");
  });

  it("has required top-level fields", () => {
    const m = readJson(manifestPath) as Record<string, unknown>;
    for (const key of [
      "name",
      "version",
      "displayName",
      "description",
      "author",
      "license",
      "components",
    ]) {
      assert.ok(key in m, `manifest missing field: ${key}`);
    }
  });

  it("uses kebab-case name", () => {
    const m = readJson(manifestPath) as { name: string };
    assert.match(m.name, /^[a-z][a-z0-9-]*[a-z0-9]$/);
  });

  it("declares all expected component paths", () => {
    const m = readJson(manifestPath) as { components: Record<string, string> };
    for (const c of ["commands", "agents", "hooks", "skills", "mcpServers"]) {
      assert.ok(c in m.components, `missing component: ${c}`);
    }
  });

  it("all referenced component paths resolve", () => {
    const m = readJson(manifestPath) as { components: Record<string, string> };
    for (const [comp, rel] of Object.entries(m.components)) {
      const target = resolve(pluginRoot, rel);
      const stat = lstatSync(target);
      assert.ok(stat.isDirectory() || stat.isFile() || stat.isSymbolicLink(), `path missing: ${comp} -> ${rel}`);
    }
  });
});

describe("commands", () => {
  const commandsDir = join(pluginRoot, "commands");
  const expected = [
    "aeo-bootstrap.md",
    "aeo-audit.md",
    "aeo-fix.md",
    "aeo-track.md",
    "aeo-loop.md",
    "aeo-compete.md",
    "aeo-status.md",
  ];

  it("contains exactly the 7 expected command files", () => {
    const found = readdirSync(commandsDir).filter((f) => f.endsWith(".md")).sort();
    assert.deepEqual(found, [...expected].sort());
  });

  for (const file of expected) {
    it(`${file} has name + description frontmatter`, () => {
      const fm = readMatter(join(commandsDir, file));
      assert.ok(fm["name"], `${file} missing name`);
      assert.ok(fm["description"], `${file} missing description`);
      assert.match(fm["name"]!, /^aeo:[a-z-]+$/);
    });
  }
});

describe("agents", () => {
  const agentsDir = join(pluginRoot, "agents");

  it("contains aeo-loop.md", () => {
    const fm = readMatter(join(agentsDir, "aeo-loop.md"));
    assert.equal(fm["name"], "aeo-loop");
    assert.ok(fm["description"]);
  });
});

describe("hooks", () => {
  const hookPath = join(pluginRoot, "hooks", "on-pr-merge.json");

  it("on-pr-merge.json exists and is valid JSON with required fields", () => {
    const h = readJson(hookPath) as Record<string, unknown>;
    for (const key of ["name", "events", "action"]) {
      assert.ok(key in h, `hook missing field: ${key}`);
    }
    assert.deepEqual(h["events"], ["pr.merged"]);
  });
});

describe("mcp.json", () => {
  const mcpPath = join(pluginRoot, "mcp.json");

  it("exists and registers the llm-seo-lab MCP server", () => {
    const m = readJson(mcpPath) as { mcpServers: Record<string, { command: string; args: string[] }> };
    assert.ok(m.mcpServers["llm-seo-lab"], "llm-seo-lab MCP server not registered");
    const srv = m.mcpServers["llm-seo-lab"]!;
    assert.equal(srv.command, "node");
    assert.ok(srv.args.some((a) => a.includes("llm-seo-lab-mcp.mjs")));
    assert.ok(srv.args.includes("--stdio"));
  });
});

describe("skills symlink", () => {
  it("plugin/skills resolves to ../skills", () => {
    const real = realpathSync(join(pluginRoot, "skills"));
    assert.equal(real, realpathSync(resolve(pluginRoot, "..", "skills")));
  });

  it("contains the 6 skill directories the plugin depends on", () => {
    const expected = [
      "aeo-audit",
      "citation-oracle-loop",
      "competitive-citation-intel",
      "content-brief-from-gap",
      "freshness-radar",
      "schema-generator",
    ];
    const found = readdirSync(join(pluginRoot, "skills"));
    for (const s of expected) {
      assert.ok(found.includes(s), `skill missing: ${s}`);
    }
  });
});
