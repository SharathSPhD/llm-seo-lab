/**
 * SQLite bootstrap helpers — open or initialize the local DB,
 * apply migrations, and return a `JsonlSqliteDriver` ready to use.
 *
 * Migration files live at `infra/d1/migrations/*.sql` and are shared
 * with Cloudflare D1 (run via `wrangler d1 migrations apply`).
 */

import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface InitSqliteOptions {
  /** Absolute path to the SQLite DB file. */
  dbPath: string;
  /** Absolute path to the directory containing `*.sql` migrations. */
  migrationsDir: string;
}

/**
 * Open a `better-sqlite3` Database with the migration applied. The
 * import is lazy so callers that never construct the local driver
 * (e.g. Workers/Pages runtime) don't need `better-sqlite3` resolvable.
 */
export async function openLocalSqlite(opts: InitSqliteOptions): Promise<{
  db: import("better-sqlite3").Database;
  applied: string[];
}> {
  const { default: BetterSqlite3 } = await import("better-sqlite3");
  const dir = dirname(opts.dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new BetterSqlite3(opts.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const applied = await applyMigrations(db, opts.migrationsDir);
  return { db, applied };
}

async function applyMigrations(
  db: import("better-sqlite3").Database,
  migrationsDir: string,
): Promise<string[]> {
  db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  const { readdirSync } = await import("node:fs");
  const files = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
    : [];
  const applied: string[] = [];
  const has = db.prepare("select 1 from schema_migrations where name = ?");
  const insert = db.prepare("insert into schema_migrations (name) values (?)");
  for (const f of files) {
    if (has.get(f)) continue;
    const sql = await readFile(join(migrationsDir, f), "utf8");
    db.exec(sql);
    insert.run(f);
    applied.push(f);
  }
  return applied;
}
