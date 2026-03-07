/**
 * Omni Memory MCP - Database Module
 * SQLite + FTS5 for local memory storage and full-text search
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { join, dirname, isAbsolute, resolve, normalize } from "path";
import { mkdirSync, existsSync, statSync } from "fs";
import { homedir } from "os";
import type {
  Memory,
  MemoryArea,
  AddMemoryArgs,
  UpdateMemoryArgs,
  UpsertMemoryArgs,
  ListMemoryArgs,
  SearchMemoryArgs,
  SearchResult,
  MemoryStats,
  UpsertMemoryResult,
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
    ? (process.env.OMNI_MEMORY_DB === ":memory:" ? ":memory:" : normalizeUserPath(process.env.OMNI_MEMORY_DB))
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

  if (DB_PATH !== ":memory:") {
    const dbDirectory = dirname(DB_PATH);
    if (!existsSync(dbDirectory)) {
      mkdirSync(dbDirectory, { recursive: true });
    }
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
      name TEXT,
      content TEXT NOT NULL,
      area TEXT DEFAULT 'general',
      project TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  ensureMemoriesColumn(database, "name", "TEXT");
  database.exec("CREATE INDEX IF NOT EXISTS idx_memories_project_name ON memories(project, name)");

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

  database.exec(`
    CREATE TABLE IF NOT EXISTS share_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      memory_id TEXT,
      matched_name TEXT,
      project TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function ensureMemoriesColumn(database: Database.Database, columnName: string, columnDefinition: string): void {
  const columns = database.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    database.exec(`ALTER TABLE memories ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function logShareEvent(
  database: Database.Database,
  eventName: string,
  details: { memoryId?: string; matchedName?: string; project?: string | null } = {}
): void {
  const stmt = database.prepare(`
    INSERT INTO share_events (id, event_name, memory_id, matched_name, project)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuidv4(),
    eventName,
    details.memoryId || null,
    details.matchedName || null,
    details.project || null
  );
}

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? null,
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
  const name = args.name || null;
  const tags = JSON.stringify(args.tags || []);

  const stmt = database.prepare(`
    INSERT INTO memories (id, name, content, area, project, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, name, args.content, area, project, tags);

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
  const name = args.name !== undefined ? args.name : existing.name;
  const tags = args.tags !== undefined ? JSON.stringify(args.tags) : JSON.stringify(existing.tags);

  const stmt = database.prepare(`
    UPDATE memories 
    SET name = ?, content = ?, area = ?, project = ?, tags = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(name, content, area, project, tags, args.id);

  return { changes: result.changes };
}

function findCanonicalMemory(matchName: string, project?: string): Memory | null {
  const database = getDatabase();
  const projectValue = project ?? null;
  const stmt = database.prepare(`
    SELECT *
    FROM memories
    WHERE name = ?
      AND (
        (? IS NULL AND project IS NULL)
        OR project = ?
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const row = stmt.get(matchName, projectValue, projectValue) as Record<string, unknown> | undefined;

  return row ? rowToMemory(row) : null;
}

export function upsertMemory(args: UpsertMemoryArgs): UpsertMemoryResult {
  const canonicalName = args.match_name ?? args.name ?? null;
  const allowCreate = args.allow_create ?? true;

  if (!canonicalName) {
    const created = addMemory({
      content: args.content,
      name: args.name,
      area: args.area,
      project: args.project,
      tags: args.tags,
    });

    logShareEvent(getDatabase(), "memory_upsert_created", {
      memoryId: created.id,
      matchedName: args.name ?? undefined,
      project: args.project ?? null,
    });

    return {
      action: "created",
      id: created.id,
      matched_name: args.name ?? null,
    };
  }

  const existing = findCanonicalMemory(canonicalName, args.project);

  if (existing) {
    updateMemory({
      id: existing.id,
      content: args.content,
      area: args.area,
      project: args.project,
      tags: args.tags,
      name: args.name ?? existing.name ?? canonicalName,
    });

    logShareEvent(getDatabase(), "memory_upsert_updated", {
      memoryId: existing.id,
      matchedName: canonicalName,
      project: args.project ?? null,
    });

    return {
      action: "updated",
      id: existing.id,
      matched_name: canonicalName,
    };
  }

  if (!allowCreate) {
    return {
      action: "not_found",
      id: null,
      matched_name: canonicalName,
    };
  }

  const created = addMemory({
    content: args.content,
    name: args.name ?? canonicalName,
    area: args.area,
    project: args.project,
    tags: args.tags,
  });

  logShareEvent(getDatabase(), "memory_upsert_created", {
    memoryId: created.id,
    matchedName: canonicalName,
    project: args.project ?? null,
  });

  return {
    action: "created",
    id: created.id,
    matched_name: canonicalName,
  };
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

export function getStats(): MemoryStats {
  const database = getDatabase();
  const totalRow = database.prepare("SELECT count(*) as c FROM memories").get() as { c: number } | undefined;
  const total = totalRow?.c || 0;

  const byAreaRows = database.prepare("SELECT area, count(*) as c FROM memories GROUP BY area").all() as Array<{
    area: string | null;
    c: number;
  }>;
  const by_area = byAreaRows.reduce((acc, row) => {
    acc[row.area || "general"] = row.c;
    return acc;
  }, {} as Record<string, number>);

  const byProjectRows = database.prepare("SELECT project, count(*) as c FROM memories GROUP BY project").all() as Array<{
    project: string | null;
    c: number;
  }>;
  const by_project = byProjectRows.reduce((acc, row) => {
    acc[row.project || "unassigned"] = row.c;
    return acc;
  }, {} as Record<string, number>);

  const eventRows = database.prepare("SELECT event_name, count(*) as c FROM share_events GROUP BY event_name").all() as Array<{
    event_name: string;
    c: number;
  }>;
  const event_counts = eventRows.reduce((acc, row) => {
    acc[row.event_name] = row.c;
    return acc;
  }, {} as Record<string, number>);

  let total_size_bytes = 0;
  if (DB_PATH !== ":memory:" && existsSync(DB_PATH)) {
    try {
      total_size_bytes = statSync(DB_PATH).size;
    } catch {
      // Ignore if stat fails
    }
  }

  return {
    total_memories: total,
    by_area,
    by_project,
    total_size_bytes,
    event_counts,
  };
}

export function searchMemories(args: SearchMemoryArgs): SearchResult[] {
  const database = getDatabase();
  const limit = Math.min(args.limit || 10, 50);

  // Helper to sanitize FTS5 query to prevent syntax errors on special chars
  // Removes unmatched quotes and escapes FTS keywords if present
  const sanitizeFtsQuery = (rawQuery: string): string => {
    let clean = rawQuery.replace(/[\^+\-*'"~]/g, " "); // Replace FTS5 syntax chars with spaces
    // Alternatively, you could wrap the whole thing in double quotes, 
    // but simply stripping operators guarantees no parse error for plain text queries
    return clean.trim() ? `"${clean.replace(/"/g, '""').trim()}"` : rawQuery;
  };

  // Build FTS5 query with filters
  let ftsQuery = args.enableAdvancedSyntax ? args.query : sanitizeFtsQuery(args.query);

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
    if (args.enableAdvancedSyntax) {
      throw new Error(`Invalid FTS5 advanced syntax: ${error instanceof Error ? error.message : String(error)}`);
    }
    // FTS5 might fail on special characters, fallback to LIKE search
    return fallbackSearch(args);
  }
}

export function fallbackSearch(args: SearchMemoryArgs): SearchResult[] {
  const database = getDatabase();
  const limit = Math.min(args.limit || 10, 50);

  // Split query into individual words, ignore empty spaces
  const words = args.query.trim().split(/\s+/).filter(Boolean);

  let sql = "SELECT * FROM memories WHERE 1=1";
  const params: (string | number)[] = [];

  // If there are words, add a LIKE condition for each word
  if (words.length > 0) {
    for (const word of words) {
      sql += " AND content LIKE ?";
      params.push(`%${word}%`);
    }
  } else {
    // Fallback if empty query
    sql += " AND content LIKE ?";
    params.push(`%${args.query}%`);
  }

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
    db.exec("DROP TABLE IF EXISTS share_events");
    db.exec("DROP TABLE IF EXISTS memories");
    db.exec("DROP TABLE IF EXISTS memories_fts");
    db.exec("DROP TRIGGER IF EXISTS memories_ai");
    db.exec("DROP TRIGGER IF EXISTS memories_ad");
    db.exec("DROP TRIGGER IF EXISTS memories_au");
    initializeSchema(db);
  }
}
