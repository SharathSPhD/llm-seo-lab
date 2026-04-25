import { createServer, type Server } from "node:http";
import type { DaemonHealth } from "../types.ts";

export interface HealthDeps {
  health: () => DaemonHealth;
}

/**
 * Tiny HTTP server that serves /health. Read-only, no auth (binds 127.0.0.1
 * by default; the dashboard reaches it through the local loopback).
 */
export class HealthServer {
  private readonly server: Server;
  private readonly deps: HealthDeps;

  constructor(deps: HealthDeps) {
    this.deps = deps;
    this.server = createServer((req, res) => {
      if (req.method === "GET" && (req.url === "/health" || req.url === "/health/")) {
        const body = JSON.stringify(this.deps.health());
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(body);
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found\n");
    });
  }

  listen(port: number, host = "127.0.0.1"): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, host, () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
        else resolve(port);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
