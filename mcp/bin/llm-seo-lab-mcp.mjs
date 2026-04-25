#!/usr/bin/env node --experimental-strip-types --no-warnings
import { startServer } from "../src/server.ts";

const portArg = process.argv.find((a) => a.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : undefined;
const useStdio = process.argv.includes("--stdio") || port === undefined;

startServer({
  httpPort: port,
  enableStdio: useStdio,
}).then((s) => {
  const ports = s.http?.port ?? "n/a";
  const transports = [s.http ? "http" : null, s.stdio ? "stdio" : null].filter(Boolean).join(",");
  process.stderr.write(
    `[mcp] llm-seo-lab MCP server up — transports=${transports || "none"} httpPort=${ports} tools=${s.registry.size()}\n`,
  );
}).catch((e) => {
  process.stderr.write(`[mcp] failed: ${e?.stack ?? e}\n`);
  process.exit(1);
});
