#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "..", "src", "cli.ts");

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings", cli, ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" } },
);
child.on("exit", (code) => process.exit(code ?? 1));
