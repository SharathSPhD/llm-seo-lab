/**
 * FsJsonlSink — appends every event to `data/use-cases/<id>/state.jsonl`.
 *
 * Append-only filesystem write. For v0.4.0 the lab still treats JSONL as
 * canonical, so this sink runs in production paths.
 */

import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { JsonlEvent, JsonlSink } from "../jsonl.ts";

export interface FsJsonlSinkOptions {
  baseDir: string;
}

export class FsJsonlSink implements JsonlSink {
  private readonly baseDir: string;

  constructor(opts: FsJsonlSinkOptions) {
    this.baseDir = opts.baseDir;
  }

  async append(use_case_id: string, event: JsonlEvent): Promise<void> {
    const filePath = join(this.baseDir, use_case_id, "state.jsonl");
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  }
}
