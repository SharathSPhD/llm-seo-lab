import { watch } from "node:fs";
import type { FileSystemWatcher } from "../types.ts";

export class NodeFsWatcher implements FileSystemWatcher {
  watch(path: string, cb: (evt: { type: "add" | "change" | "remove"; path: string }) => void): () => void {
    const watcher = watch(path, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const type = eventType === "rename" ? "add" : "change";
      cb({ type, path: filename });
    });
    return () => watcher.close();
  }
}
