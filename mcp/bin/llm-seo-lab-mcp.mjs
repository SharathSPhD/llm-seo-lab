#!/usr/bin/env node --experimental-strip-types --no-warnings
import { startServer } from "../src/server.ts";

const portArg = process.argv.find((a) => a.startsWith("--port="));
const port = portArg
  ? parseInt(portArg.split("=")[1], 10)
  : process.env["LLM_SEO_LAB_MCP_PORT"]
    ? parseInt(process.env["LLM_SEO_LAB_MCP_PORT"], 10)
    : 7301;

const dataArg = process.argv.find((a) => a.startsWith("--data-dir="));
const dataDir = dataArg
  ? dataArg.split("=")[1]
  : process.env["LLM_SEO_LAB_DATA_DIR"];

const useStdio = process.argv.includes("--stdio");

startServer({
  httpPort: port,
  enableStdio: useStdio,
  ...(dataDir ? { dataDir } : {}),
})
  .then((s) => {
    const ports = s.http?.port ?? "n/a";
    const transports = [s.http ? "http" : null, s.stdio ? "stdio" : null].filter(Boolean).join(",");
    process.stderr.write(
      `[mcp] llm-seo-lab MCP server up — transports=${transports || "none"} httpPort=${ports} tools=${s.registry.size()} dataDir=${s.ctx.dataDir}\n`,
    );
  })
  .catch((e) => {
    process.stderr.write(`[mcp] failed: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
