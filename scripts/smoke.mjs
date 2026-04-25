#!/usr/bin/env node
// smoke.mjs — end-to-end smoke test for the llm-seo-lab daemon.
//
// Boots the cli-worker daemon on ephemeral ports, then verifies:
//   1. /health returns status: "ok" within 5s
//   2. The WebSocket port accepts a handshake
//   3. SIGTERM drains and exits cleanly
//
// Exits 0 on success, non-zero on any failure. Intended for CI and `npm run smoke`.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { createHash, randomBytes } from "node:crypto";

const DEADLINE_MS = 15_000;

function log(msg) {
  process.stderr.write(`[smoke] ${msg}\n`);
}

function waitFor(pred, timeoutMs, intervalMs = 100) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        if (await pred()) return resolve(true);
      } catch {
        /* keep polling */
      }
      if (Date.now() - t0 > timeoutMs) return reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function pickPort() {
  return 9000 + Math.floor(Math.random() * 1000);
}

async function fetchHealth(port) {
  const r = await fetch(`http://127.0.0.1:${port}/health`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function wsHandshake(port) {
  return new Promise((resolve, reject) => {
    const key = randomBytes(16).toString("base64");
    const expected = createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    const sock = connect({ host: "127.0.0.1", port }, () => {
      sock.write(
        [
          "GET / HTTP/1.1",
          `Host: 127.0.0.1:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    let buf = "";
    sock.on("data", (chunk) => {
      buf += chunk.toString("binary");
      if (buf.includes("\r\n\r\n")) {
        const accept = /sec-websocket-accept:\s*(.+)\r\n/i.exec(buf)?.[1]?.trim();
        sock.end();
        if (accept === expected) resolve(true);
        else reject(new Error(`WS handshake mismatch: got ${accept}, want ${expected}`));
      }
    });
    sock.on("error", reject);
    sock.on("close", () => reject(new Error("WS socket closed before handshake")));
    setTimeout(() => {
      try { sock.destroy(); } catch { /* already closed */ }
      reject(new Error("WS handshake timeout"));
    }, 4000);
  });
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "llm-seo-lab-smoke-"));
  const wsPort = pickPort();
  const httpPort = wsPort + 1;
  log(`data_dir=${dataDir} ws=${wsPort} http=${httpPort}`);

  const repoRoot = new URL("..", import.meta.url).pathname;
  const child = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "packages/cli-worker/src/cli.ts",
      "daemon",
      "start",
      "--data-dir",
      dataDir,
      "--ws-port",
      String(wsPort),
      "--http-port",
      String(httpPort),
    ],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
  );

  let stdout = "";
  child.stdout.on("data", (b) => (stdout += b.toString()));
  child.stderr.on("data", (b) => process.stderr.write(`[daemon] ${b.toString()}`));

  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));

  let exitCode = 1;
  try {
    log("waiting for /health");
    await waitFor(async () => {
      const h = await fetchHealth(httpPort);
      return h.status === "ok";
    }, DEADLINE_MS);
    log("/health: ok");

    log("ws handshake");
    await wsHandshake(wsPort);
    log("ws: ok");

    log("SIGTERM");
    child.kill("SIGTERM");
    const result = await Promise.race([
      exited,
      new Promise((_, reject) => setTimeout(() => reject(new Error("daemon did not exit in 8s")), 8000)),
    ]);
    log(`exit code=${result.code} signal=${result.signal}`);
    exitCode = result.code === 0 ? 0 : result.code ?? 1;
  } catch (e) {
    log(`FAIL: ${e.message}`);
    log(`stdout: ${stdout.slice(0, 400)}`);
    try { child.kill("SIGKILL"); } catch { /* already dead */ }
  } finally {
    try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  return exitCode;
}

const code = await main();
process.exit(code);
