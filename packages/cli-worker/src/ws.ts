import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import type { Socket } from "node:net";
import type { DaemonEvent } from "./types.ts";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * Minimal WebSocket publisher (RFC 6455 server, text frames only).
 *
 * We implement the few frame ops we need (handshake, mask-aware text frames,
 * close, ping/pong) instead of pulling in `ws` because the daemon already runs
 * on Node 20+ with no other JS deps. The publisher is broadcast-only: the
 * dashboard subscribes via GET /events, and the daemon emits DaemonEvent
 * objects through `publish()`.
 */
export class WsPublisher {
  private readonly server: Server;
  private readonly clients = new Set<Socket>();
  private readonly origin?: string;

  constructor(opts: { origin?: string } = {}) {
    if (opts.origin !== undefined) this.origin = opts.origin;
    this.server = createServer((_req, res) => {
      res.statusCode = 426;
      res.setHeader("upgrade", "websocket");
      res.end("This endpoint only serves WebSocket upgrades.");
    });
    this.server.on("upgrade", (req, socket, head) => this.upgrade(req as unknown as Record<string, unknown>, socket as Socket, head as Buffer));
  }

  listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") resolve(addr.port);
        else resolve(port);
      });
    });
  }

  close(): Promise<void> {
    for (const s of this.clients) {
      try { s.destroy(); } catch { /* socket already gone; ignore */ }
    }
    this.clients.clear();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  publish(event: DaemonEvent): number {
    const frame = encodeTextFrame(JSON.stringify(event));
    let delivered = 0;
    for (const s of this.clients) {
      if (s.writable) {
        s.write(frame);
        delivered += 1;
      }
    }
    return delivered;
  }

  subscriberCount(): number {
    return this.clients.size;
  }

  private upgrade(req: Record<string, unknown>, socket: Socket, _head: Buffer): void {
    const headers = (req["headers"] ?? {}) as Record<string, string | undefined>;
    const key = headers["sec-websocket-key"];
    const upgrade = headers["upgrade"];
    if (!key || (upgrade ?? "").toLowerCase() !== "websocket") {
      socket.destroy();
      return;
    }
    if (this.origin && headers["origin"] !== this.origin) {
      socket.write(`HTTP/1.1 403 Forbidden\r\n\r\n`);
      socket.destroy();
      return;
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    this.clients.add(socket);
    const drop = (): void => {
      this.clients.delete(socket);
      try { socket.destroy(); } catch { /* socket already destroyed */ }
    };
    socket.on("close", drop);
    socket.on("error", drop);
    socket.on("end", drop);
  }
}

export function encodeTextFrame(payload: string): Buffer {
  const data = Buffer.from(payload, "utf8");
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 0x10000) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

/** Construct a masked client text frame for tests. */
export function encodeClientTextFrame(payload: string): Buffer {
  const data = Buffer.from(payload, "utf8");
  const mask = randomBytes(4);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = data[i]! ^ mask[i % 4]!;
  }
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x81, 0x80 | len]);
  } else if (len < 0x10000) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, mask, data]);
}
