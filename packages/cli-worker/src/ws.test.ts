import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { WsPublisher } from "./ws.ts";

function readWsTextFrame(buf: Buffer): { payload: string; rest: Buffer } | undefined {
  if (buf.length < 2) return undefined;
  const len1 = buf[1]! & 0x7f;
  let offset = 2;
  let len = len1;
  if (len1 === 126) {
    if (buf.length < 4) return undefined;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len1 === 127) {
    if (buf.length < 10) return undefined;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (buf.length < offset + len) return undefined;
  const payload = buf.subarray(offset, offset + len).toString("utf8");
  return { payload, rest: buf.subarray(offset + len) };
}

function handshake(port: number): Promise<{ socket: ReturnType<typeof connect>; key: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      const key = randomBytes(16).toString("base64");
      socket.write(
        `GET /events HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n\r\n`,
      );
      socket.once("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        if (!text.startsWith("HTTP/1.1 101")) {
          reject(new Error(`expected 101, got: ${text.split("\r\n")[0]}`));
          return;
        }
        resolve({ socket, key });
      });
    });
    socket.on("error", reject);
  });
}

describe("WsPublisher", () => {
  it("completes the WebSocket handshake with a correct accept header", async () => {
    const pub = new WsPublisher();
    const port = await pub.listen(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connect(port, "127.0.0.1", () => {
          const key = randomBytes(16).toString("base64");
          const expected = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
          socket.write(
            `GET /events HTTP/1.1\r\n` +
              `Host: 127.0.0.1:${port}\r\n` +
              `Upgrade: websocket\r\n` +
              `Connection: Upgrade\r\n` +
              `Sec-WebSocket-Key: ${key}\r\n` +
              `Sec-WebSocket-Version: 13\r\n\r\n`,
          );
          socket.once("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            try {
              assert.match(text, /HTTP\/1\.1 101/);
              assert.ok(text.includes(`Sec-WebSocket-Accept: ${expected}`));
              socket.destroy();
              resolve();
            } catch (e) {
              reject(e as Error);
            }
          });
        });
        socket.on("error", reject);
      });
    } finally {
      await pub.close();
    }
  });

  it("publishes events to subscribed clients", async () => {
    const pub = new WsPublisher();
    const port = await pub.listen(0);
    try {
      const { socket } = await handshake(port);
      try {
        const received = new Promise<string>((resolve) => {
          socket.on("data", (chunk: Buffer) => {
            const decoded = readWsTextFrame(chunk);
            if (decoded) resolve(decoded.payload);
          });
        });
        await new Promise((r) => setTimeout(r, 20));
        const delivered = pub.publish({
          type: "job.enqueued",
          job: {
            id: "j1",
            site_id: "s1",
            kind: "audit",
            status: "queued",
            enqueued_at: 1,
            attempt: 0,
            payload: {},
          },
        });
        assert.equal(delivered, 1);
        const payload = await received;
        const obj = JSON.parse(payload);
        assert.equal(obj.type, "job.enqueued");
        assert.equal(obj.job.id, "j1");
      } finally {
        socket.destroy();
      }
    } finally {
      await pub.close();
    }
  });

  it("subscriberCount tracks open connections", async () => {
    const pub = new WsPublisher();
    const port = await pub.listen(0);
    try {
      const { socket } = await handshake(port);
      const grew = await waitFor(() => pub.subscriberCount() === 1, 1000);
      assert.equal(grew, true, "expected subscriberCount to reach 1");
      socket.end();
      const shrank = await waitFor(() => pub.subscriberCount() === 0, 2000);
      assert.equal(shrank, true, "expected subscriberCount to drop to 0 after socket close");
    } finally {
      await pub.close();
    }
  });
});

async function waitFor(pred: () => boolean, timeout_ms: number): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout_ms) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return false;
}
