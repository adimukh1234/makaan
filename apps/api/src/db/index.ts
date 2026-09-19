import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';

/**
 * `node:sqlite` is loaded through createRequire so bundlers and test runners do
 * not try to resolve it as an npm package.
 */
const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as {
  DatabaseSync: new (path: string) => NodeDatabaseSync;
};

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

export type Database = NodeDatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new sqlite.DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db: Database): void {
  const schema = readFileSync(SCHEMA_URL, 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(schema);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
