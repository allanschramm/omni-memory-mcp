/**
 * Omni Memory MCP - Database Module
 * SQLite + FTS5 for local memory storage and full-text search
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { join, dirname, isAbsolute, resolve, normalize } from "path";
import { mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import type {
  Memory,
  MemoryArea,
  AddMemoryArgs,
  UpdateMemoryArgs,
  ListMemoryArgs,
  SearchMemoryArgs,
  SearchResult,
} from "./types.js";

function expandHomePath(inputPath: string): string {
  if (inputPath === "~") {
    return homedir();
  }

  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    return join(homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function normalizeUserPath(inputPath: string): string {
  const trimmedPath = inputPath.trim();
  const expandedPath = expandHomePath(trimmedPath);

  if (isAbsolute(expandedPath)) {
    return normalize(expandedPath);
  }

  return normalize(resolve(process.cwd(), expandedPath));
}

function resolveStoragePaths(): { dataDir: string; dbPath: string } {
  const defaultDir = join(homedir(), ".omni-memory");
  const dataDir = normalizeUserPath(process.env.OMNI_MEMORY_DIR || defaultDir);
  const dbPath = process.env.OMNI_MEMORY_DB
    ? normalizeUserPath(process.env.OMNI_MEMORY_DB)
    : join(dataDir, "omni-memory.db");

  return { dataDir, dbPath };
}

const { dataDir: DATA_DIR, dbPath: DB_PATH } = resolveStoragePaths();

let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (db) return db;

  // Ensure storage directories exist
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbDirectory = dirname(DB_PATH);
  if (!existsSync(dbDirectory)) {
    mkdirSync(dbDirectory, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initializeSchema(db);
  return db;
}

function initializeSchema(database: Database.Database): void {
  // Create memories table
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      area TEXT DEFAULT 'general',
      project TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create FTS5 virtual table
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      project,
      tags,
      content='memories',
      content_rowid='rowid'
    )
  `);

  // Create triggers for FTS sync
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, project, tags)
      VALUES (new.rowid, new.content, COALESCE(new.project, ''), new.tags);
    END
  `);

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project, tags)
      VALUES('delete', old.rowid, old.content, COALESCE(old.project, ''), old.tags);
    END
  `);

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project, tags)
      VALUES('delete', old.rowid, old.content, COALESCE(old.project, ''), old.tags);
      INSERT INTO memories_fts(rowid, content, project, tags)
      VALUES (new.rowid, new.content, COALESCE(new.project, ''), new.tags);
    END
  `);
}

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    content: row.content as string,
    area: (row.area as MemoryArea) || "general",
    project: row.project as string | null,
    tags: JSON.parse((row.tags as string) || "[]"),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function addMemory(args: AddMemoryArgs): { id: string } {
  const database = getDatabase();
  const id = uuidv4();
  const area = args.area || "general";
  const project = args.project || null;
  const tags = JSON.stringify(args.tags || []);

  const stmt = database.prepare(`
    INSERT INTO memories (id, content, area, project, tags)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, args.content, area, project, tags);

  return { id };
}

export function getMemory(id: string): Memory | null {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM memories WHERE id = ?");
  const row = stmt.get(id) as Record<string, unknown> | undefined;

  return row ? rowToMemory(row) : null;
}

export function updateMemory(args: UpdateMemoryArgs): { changes: number } {
  const database = getDatabase();

  // First get existing memory
  const existing = getMemory(args.id);
  if (!existing) {
    return { changes: 0 };
  }

  // Merge updates
  const content = args.content ?? existing.content;
  const area = args.area ?? existing.area;
  const project = args.project !== undefined ? args.project : existing.project;
  const tags = args.tags !== undefined ? JSON.stringify(args.tags) : JSON.stringify(existing.tags);

  const stmt = database.prepare(`
    UPDATE memories 
    SET content = ?, area = ?, project = ?, tags = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(content, area, project, tags, args.id);

  return { changes: result.changes };
}

export function deleteMemory(id: string): { changes: number } {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM memories WHERE id = ?");
  const result = stmt.run(id);

  return { changes: result.changes };
}

export function listMemories(args: ListMemoryArgs): Memory[] {
  const database = getDatabase();
  const limit = Math.min(args.limit || 50, 100);

  let sql = "SELECT * FROM memories WHERE 1=1";
  const params: (string | number)[] = [];

  if (args.area) {
    sql += " AND area = ?";
    params.push(args.area);
  }

  if (args.project) {
    sql += " AND project = ?";
    params.push(args.project);
  }

  if (args.tag) {
    sql += " AND tags LIKE ?";
    params.push(`%"${args.tag}"%`);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const stmt = database.prepare(sql);
  const rows = stmt.all(...params) as Record<string, unknown>[];

  return rows.map(rowToMemory);
}

export function searchMemories(args: SearchMemoryArgs): SearchResult[] {
  const database = getDatabase();
  const limit = Math.min(args.limit || 10, 50);

  // Build FTS5 query with filters
  let ftsQuery = args.query;

  // Add area filter to query
  if (args.area) {
    // We'll filter results after search
  }

  // Build SQL for FTS search
  let sql = `
    SELECT m.*, fts.rank as score
    FROM memories m
    JOIN memories_fts fts ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
  `;
  const params: (string | number)[] = [ftsQuery];

  if (args.area) {
    sql += " AND m.area = ?";
    params.push(args.area);
  }

  if (args.project) {
    sql += " AND m.project = ?";
    params.push(args.project);
  }

  sql += " ORDER BY fts.rank LIMIT ?";
  params.push(limit);

  try {
    const stmt = database.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map((row) => ({
      ...rowToMemory(row),
      score: Math.abs(row.score as number) || 0,
    }));
  } catch (error) {
    // FTS5 might fail on special characters, fallback to LIKE search
    return fallbackSearch(args);
  }
}

function fallbackSearch(args: SearchMemoryArgs): SearchResult[] {
  const database = getDatabase();
  const limit = Math.min(args.limit || 10, 50);

  let sql = "SELECT * FROM memories WHERE content LIKE ?";
  const params: (string | number)[] = [`%${args.query}%`];

  if (args.area) {
    sql += " AND area = ?";
    params.push(args.area);
  }

  if (args.project) {
    sql += " AND project = ?";
    params.push(args.project);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const stmt = database.prepare(sql);
  const rows = stmt.all(...params) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...rowToMemory(row),
    score: 0.5, // Default score for fallback search
  }));
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export { resolveStoragePaths, normalizeUserPath };

// For testing
export function resetDatabase(): void {
  if (db) {
    db.exec("DROP TABLE IF EXISTS memories");
    db.exec("DROP TABLE IF EXISTS memories_fts");
    db.exec("DROP TRIGGER IF EXISTS memories_ai");
    db.exec("DROP TRIGGER IF EXISTS memories_ad");
    db.exec("DROP TRIGGER IF EXISTS memories_au");
    initializeSchema(db);
  }
}
