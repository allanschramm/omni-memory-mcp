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
  UpsertMemoryArgs,
  UpsertMemoryResult,
  UpdateMemoryArgs,
  ListMemoryArgs,
  SearchMemoryArgs,
  SearchResult,
  SearchMode,
  MemoryStats,
  PruneMemoryArgs,
  PruneMemoryResult,
  MemoryContextPackArgs,
  MemoryContextPackMemory,
  MemoryContextPackResult,
} from "./types.js";

type MemoryRow = Record<string, unknown>;
type MatchField = "name" | "content" | "project" | "tags";
const DEFAULT_CONTEXT_PACK_MAX_TOKENS = 1200;
const DEFAULT_CONTEXT_PACK_MAX_MEMORIES = 5;
const MAX_CONTEXT_PACK_CANDIDATES = 50;
const CONTEXT_PACK_HEADER_BUDGET = 40;
const CONTEXT_PACK_SECTION_BUDGET = 18;
const MIN_EXCERPT_TOKENS = 12;

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
      content TEXT NOT NULL,
      area TEXT DEFAULT 'general',
      project TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migrate existing schema
  const columns = database.pragma("table_info(memories)") as Array<{ name: string }>;
  const hasName = columns.some((c) => c.name === "name");

  if (!hasName) {
    database.exec("ALTER TABLE memories ADD COLUMN name TEXT");
    database.exec("ALTER TABLE memories ADD COLUMN metadata TEXT");
    database.exec("ALTER TABLE memories ADD COLUMN accessed_at TEXT");
    database.exec("ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0");

    // Recreate FTS
    database.exec("DROP TABLE IF EXISTS memories_fts");
    database.exec("DROP TRIGGER IF EXISTS memories_ai");
    database.exec("DROP TRIGGER IF EXISTS memories_ad");
    database.exec("DROP TRIGGER IF EXISTS memories_au");
  }

  // Create FTS5 virtual table
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      name,
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
      INSERT INTO memories_fts(rowid, name, content, project, tags)
      VALUES (new.rowid, COALESCE(new.name, ''), new.content, COALESCE(new.project, ''), new.tags);
    END
  `);

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, name, content, project, tags)
      VALUES('delete', old.rowid, COALESCE(old.name, ''), old.content, COALESCE(old.project, ''), old.tags);
    END
  `);

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, name, content, project, tags)
      VALUES('delete', old.rowid, COALESCE(old.name, ''), old.content, COALESCE(old.project, ''), old.tags);
      INSERT INTO memories_fts(rowid, name, content, project, tags)
      VALUES (new.rowid, COALESCE(new.name, ''), new.content, COALESCE(new.project, ''), new.tags);
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

  if (!hasName) {
    // Rebuild the FTS data
    database.exec(`
      INSERT INTO memories_fts(rowid, name, content, project, tags)
      SELECT rowid, COALESCE(name, ''), content, COALESCE(project, ''), tags FROM memories;
    `);
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

export function calculateDecayScore(
  createdAt: string,
  accessedAt: string | null,
  accessCount: number,
  baseScore: number = 0
): number {
  const lastAccess = accessedAt ? new Date(accessedAt) : new Date(createdAt);
  const now = new Date();
  const diffDays = Math.max(0, (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24));

  let score = baseScore;
  score += Math.min(1.0, accessCount * 0.05); // Bonus max +1.0
  score -= Math.min(5.0, diffDays * 0.1);     // Penalty max -5.0

  return Number(score.toFixed(3));
}

function rowToMemory(row: MemoryRow): Memory {
  const accessedAt = row.accessed_at as string | null;
  const accessCount = (row.access_count as number) || 0;
  const createdAt = row.created_at as string;

  return {
    id: row.id as string,
    name: row.name as string | null,
    content: row.content as string,
    area: (row.area as MemoryArea) || "general",
    project: row.project as string | null,
    tags: JSON.parse((row.tags as string) || "[]"),
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    accessed_at: accessedAt,
    access_count: accessCount,
    created_at: createdAt,
    updated_at: row.updated_at as string,
    decay_score: calculateDecayScore(createdAt, accessedAt, accessCount, 0),
  };
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function sanitizeFtsQuery(rawQuery: string): string {
  const clean = rawQuery.replace(/[\^+\-*'"~]/g, " ");
  return clean.trim() ? `"${clean.replace(/"/g, "\"\"").trim()}"` : rawQuery;
}

function hasTextMatch(value: string | null | undefined, token: string): boolean {
  return Boolean(value && value.toLowerCase().includes(token));
}

function getMatchedFields(memory: Memory, tokens: string[]): MatchField[] {
  if (tokens.length === 0) {
    return [];
  }

  const fields: MatchField[] = [];
  const tagsText = memory.tags.join(" ").toLowerCase();

  if (tokens.some((token) => hasTextMatch(memory.name ?? null, token))) {
    fields.push("name");
  }

  if (tokens.some((token) => hasTextMatch(memory.content, token))) {
    fields.push("content");
  }

  if (tokens.some((token) => hasTextMatch(memory.project, token))) {
    fields.push("project");
  }

  if (tokens.some((token) => tagsText.includes(token))) {
    fields.push("tags");
  }

  return fields;
}

function normalizeForExactMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMemoryName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeForExactMatch(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function estimateTokenCount(value: string): number {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function truncateExcerpt(content: string, maxTokens: number): { excerpt: string; truncated: boolean } {
  const normalized = normalizeWhitespace(content);

  if (!normalized) {
    return { excerpt: "", truncated: false };
  }

  if (maxTokens <= 0) {
    return { excerpt: "", truncated: true };
  }

  const maxChars = Math.max(1, maxTokens * 4);
  if (normalized.length <= maxChars) {
    return { excerpt: normalized, truncated: false };
  }

  const rawSlice = normalized.slice(0, Math.max(1, maxChars - 1));
  const safeSlice = rawSlice.length > 24
    ? rawSlice.slice(0, Math.max(1, rawSlice.lastIndexOf(" ")))
    : rawSlice;

  return {
    excerpt: `${safeSlice.trimEnd()}…`,
    truncated: true,
  };
}

function formatContextPackText(
  query: string,
  memories: MemoryContextPackMemory[],
  truncated: boolean
): string {
  const header = [
    `Context pack for "${query}"`,
    truncated
      ? "Compact excerpts only. Use 'memory_get' with an ID for the full memory."
      : "Use 'memory_get' with an ID for the full memory.",
  ].join("\n");

  if (memories.length === 0) {
    return `${header}\n\nNo matching memories found.`;
  }

  const sections = memories.map((memory, index) => {
    const title = memory.name || "Unnamed Memory";
    const project = memory.project ? ` [${memory.project}]` : "";
    const tags = memory.tags.length > 0 ? ` #${memory.tags.join(" #")}` : "";

    return [
      `${index + 1}. ${title}${project}`,
      `   ID: ${memory.id}`,
      `   Area: ${memory.area}${tags}`,
      `   Match: ${memory.explanation} (${(memory.score * 100).toFixed(0)}%)`,
      `   Excerpt: ${memory.excerpt || "(empty memory)"}`,
    ].join("\n");
  });

  return `${header}\n\n${sections.join("\n\n")}`;
}

function formatMatchExplanation(fields: MatchField[]): string {
  return fields.length > 0 ? `matched ${fields.join(", ")}` : "matched indexed fields";
}

function computeSearchScore(memory: Memory, query: string, baseScore: number, matchedFields: MatchField[], searchMode: SearchMode): number {
  let score = baseScore;
  const normalizedQuery = normalizeForExactMatch(query);
  const normalizedName = memory.name ? normalizeForExactMatch(memory.name) : "";
  const normalizedTags = memory.tags.map((tag) => normalizeForExactMatch(tag));

  if (normalizedName && normalizedName === normalizedQuery) {
    score += searchMode === "exact" ? 4 : 2.5;
  }

  if (matchedFields.includes("name")) {
    score += searchMode === "exact" ? 1.5 : 0.9;
  }

  if (matchedFields.includes("tags")) {
    score += normalizedTags.includes(normalizedQuery) ? 1.2 : 0.6;
  }

  if (matchedFields.includes("project")) {
    score += 0.2;
  }

  if ((memory.access_count ?? 0) > 0) {
    score += Math.min(0.35, (memory.access_count ?? 0) * 0.05);
  }

  if (searchMode === "broad" && matchedFields.includes("content")) {
    score += 0.2;
  }

  return Number(score.toFixed(3));
}

function toSearchResult(memory: Memory, query: string, baseScore: number, searchMode: SearchMode): SearchResult {
  const tokens = tokenizeQuery(query);
  const matchedFields = getMatchedFields(memory, tokens);
  const score = computeSearchScore(memory, query, baseScore, matchedFields, searchMode);

  return {
    id: memory.id,
    name: memory.name,
    area: memory.area,
    project: memory.project,
    tags: memory.tags,
    metadata: memory.metadata,
    accessed_at: memory.accessed_at,
    access_count: memory.access_count,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
    score,
    decay_score: calculateDecayScore(memory.created_at, memory.accessed_at ?? null, memory.access_count || 0, score),
    explanation: formatMatchExplanation(matchedFields),
  };
}

function getMemoriesByIds(ids: string[]): Map<string, Memory> {
  if (ids.length === 0) {
    return new Map();
  }

  const database = getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  const stmt = database.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`);
  const rows = stmt.all(...ids) as MemoryRow[];

  const results = new Map<string, Memory>();
  for (const row of rows) {
    const memory = rowToMemory(row);
    results.set(memory.id, memory);
  }
  return results;
}

function getMemoryRecord(id: string): Memory | null {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM memories WHERE id = ?");
  const row = stmt.get(id) as MemoryRow | undefined;

  return row ? rowToMemory(row) : null;
}

export function createMemoryContextPack(args: MemoryContextPackArgs): MemoryContextPackResult {
  const maxTokens = Math.min(Math.max(args.max_tokens ?? DEFAULT_CONTEXT_PACK_MAX_TOKENS, 200), 8000);
  const maxMemories = Math.min(Math.max(args.max_memories ?? DEFAULT_CONTEXT_PACK_MAX_MEMORIES, 1), 20);
  const candidateLimit = Math.min(MAX_CONTEXT_PACK_CANDIDATES, Math.max(maxMemories * 6, 10));
  const searchResults = searchMemories({
    query: args.query,
    area: args.area,
    project: args.project,
    limit: candidateLimit,
    search_mode: args.search_mode,
  });

  const filteredResults = args.tag
    ? searchResults.filter((memory) => memory.tags.includes(args.tag as string))
    : searchResults;

  const selected: MemoryContextPackMemory[] = [];
  let remainingTokens = Math.max(0, maxTokens - CONTEXT_PACK_HEADER_BUDGET);
  let truncated = filteredResults.length > maxMemories;

  // Optimized: fetch all candidate memories in one query
  const candidateIds = filteredResults.map((r) => r.id);
  const memoryMap = getMemoriesByIds(candidateIds);

  for (const result of filteredResults) {
    if (selected.length >= maxMemories) {
      truncated = true;
      break;
    }

    const memory = memoryMap.get(result.id);
    if (!memory) {
      continue;
    }

    const remainingSlots = Math.max(1, maxMemories - selected.length);
    const sectionBudget = Math.max(
      CONTEXT_PACK_SECTION_BUDGET + MIN_EXCERPT_TOKENS,
      Math.floor(remainingTokens / remainingSlots)
    );
    const excerptBudget = Math.max(MIN_EXCERPT_TOKENS, sectionBudget - CONTEXT_PACK_SECTION_BUDGET);

    if (remainingTokens < CONTEXT_PACK_SECTION_BUDGET + MIN_EXCERPT_TOKENS) {
      truncated = true;
      break;
    }

    const excerptResult = truncateExcerpt(memory.content, excerptBudget);
    let consumedTokens = estimateTokenCount(excerptResult.excerpt) + CONTEXT_PACK_SECTION_BUDGET;
    let excerpt = excerptResult.excerpt;
    let excerptTruncated = excerptResult.truncated;

    if (consumedTokens > remainingTokens) {
      const fallbackBudget = Math.max(MIN_EXCERPT_TOKENS, remainingTokens - CONTEXT_PACK_SECTION_BUDGET);
      const fallbackExcerpt = truncateExcerpt(memory.content, fallbackBudget);
      const fallbackTokens = estimateTokenCount(fallbackExcerpt.excerpt) + CONTEXT_PACK_SECTION_BUDGET;

      if (fallbackTokens > remainingTokens) {
        truncated = true;
        break;
      }

      consumedTokens = fallbackTokens;
      excerpt = fallbackExcerpt.excerpt;
      excerptTruncated = fallbackExcerpt.truncated;
    }

    selected.push({
      id: memory.id,
      name: memory.name || null,
      area: memory.area,
      project: memory.project,
      tags: memory.tags,
      score: result.score,
      explanation: result.explanation,
      excerpt,
    });

    remainingTokens -= consumedTokens;
    truncated = truncated || excerptTruncated;
  }

  if (selected.length < filteredResults.length) {
    truncated = true;
  }

  const text = formatContextPackText(args.query, selected, truncated);

  return {
    success: true,
    query: args.query,
    count: selected.length,
    max_tokens: maxTokens,
    estimated_tokens: estimateTokenCount(text),
    truncated,
    memories: selected,
  };
}

function findMemoriesByNormalizedName(matchName: string, project: string | null | undefined): Memory[] {
  const database = getDatabase();
  const normalizedTarget = normalizeMemoryName(matchName);

  if (!normalizedTarget) {
    return [];
  }

  let sql = "SELECT id, name FROM memories WHERE name IS NOT NULL";
  const params: Array<string | null> = [];

  if (project === undefined || project === null) {
    sql += " AND project IS NULL";
  } else {
    sql += " AND project = ?";
    params.push(project);
  }

  const stmt = database.prepare(sql);
  const rows = stmt.all(...params) as { id: string; name: string | null }[];

  const matchingIds = rows
    .filter((row) => normalizeMemoryName(row.name) === normalizedTarget)
    .map((row) => row.id);

  if (matchingIds.length === 0) {
    return [];
  }

  // Performance optimization: we fetch only the ID and Name first, so we can do the exact
  // normalized string match in JS without parsing JSON tags and metadata for thousands of rows.
  // Then we fetch the full rows only for the matched IDs.
  const fullRows = database.prepare(
    `SELECT * FROM memories WHERE id IN (${matchingIds.map(() => "?").join(",")})`
  ).all(...matchingIds) as MemoryRow[];

  return fullRows.map(rowToMemory);
}

export function addMemory(args: AddMemoryArgs): { id: string } {
  const database = getDatabase();
  const id = uuidv4();
  const area = args.area || "general";
  const project = args.project || null;
  const tags = JSON.stringify(args.tags || []);
  const name = args.name || null;
  const metadata = args.metadata ? JSON.stringify(args.metadata) : null;

  const stmt = database.prepare(`
    INSERT INTO memories (id, name, content, area, project, tags, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, name, args.content, area, project, tags, metadata);

  return { id };
}

export function getMemory(id: string): Memory | null {
  const database = getDatabase();

  // Track Active Forgetting / Progressive Disclosure metrics
  const updateStmt = database.prepare("UPDATE memories SET accessed_at = datetime('now'), access_count = access_count + 1 WHERE id = ?");
  updateStmt.run(id);
  return getMemoryRecord(id);
}

export function updateMemory(args: UpdateMemoryArgs): { changes: number } {
  const database = getDatabase();

  // First get existing memory
  const existing = getMemoryRecord(args.id);
  if (!existing) {
    return { changes: 0 };
  }

  // Merge updates
  const name = args.name !== undefined ? args.name : existing.name;
  const content = args.content ?? existing.content;
  const area = args.area ?? existing.area;
  const project = args.project !== undefined ? args.project : existing.project;
  const tags = args.tags !== undefined ? JSON.stringify(args.tags) : JSON.stringify(existing.tags);
  const metadata = args.metadata !== undefined ? (args.metadata === null ? null : JSON.stringify(args.metadata)) : existing.metadata === null ? null : JSON.stringify(existing.metadata);

  const stmt = database.prepare(`
    UPDATE memories 
    SET name = ?, content = ?, area = ?, project = ?, tags = ?, metadata = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(name, content, area, project, tags, metadata, args.id);

  return { changes: result.changes };
}

export function deleteMemory(id: string): { changes: number } {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM memories WHERE id = ?");
  const result = stmt.run(id);

  return { changes: result.changes };
}

export function upsertMemory(args: UpsertMemoryArgs): UpsertMemoryResult {
  const database = getDatabase();
  const matchName = args.match_name ?? args.name;
  const normalizedMatchName = normalizeMemoryName(matchName);

  if (!normalizedMatchName) {
    if (args.allow_create === false) {
      return {
        success: true,
        action: "skipped",
      };
    }

    const created = addMemory({
      name: args.name,
      content: args.content,
      area: args.area,
      project: args.project ?? undefined,
      tags: args.tags,
      metadata: args.metadata ?? undefined,
    });

    logShareEvent(database, "memory_upsert_created", {
      memoryId: created.id,
      matchedName: args.name,
      project: args.project ?? null,
    });

    return {
      success: true,
      action: "created",
      id: created.id,
    };
  }

  const candidates = findMemoriesByNormalizedName(normalizedMatchName, args.project);

  if (candidates.length > 1) {
    return {
      success: true,
      action: "ambiguous",
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name ?? null,
        project: candidate.project,
      })),
    };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    const updateResult = updateMemory({
      id: candidate.id,
      name: args.name,
      content: args.content,
      area: args.area,
      project: args.project,
      tags: args.tags,
      metadata: args.metadata,
    });

    logShareEvent(database, "memory_upsert_updated", {
      memoryId: candidate.id,
      matchedName: matchName,
      project: args.project ?? null,
    });

    return {
      success: true,
      action: "updated",
      id: candidate.id,
      changes: updateResult.changes,
    };
  }

  if (args.allow_create === false) {
    return {
      success: true,
      action: "skipped",
    };
  }

  const created = addMemory({
    name: args.name,
    content: args.content,
    area: args.area,
    project: args.project ?? undefined,
    tags: args.tags,
    metadata: args.metadata ?? undefined,
  });

  logShareEvent(database, "memory_upsert_created", {
    memoryId: created.id,
    matchedName: matchName,
    project: args.project ?? null,
  });

  return {
    success: true,
    action: "created",
    id: created.id,
  };
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
  const rows = stmt.all(...params) as MemoryRow[];

  return rows.map(rowToMemory);
}

export function getStats(): MemoryStats {
  const database = getDatabase();

  const totalRow = database.prepare("SELECT count(*) as c FROM memories").get() as { c?: number } | undefined;
  const total = totalRow?.c || 0;

  const byAreaRows = database.prepare("SELECT area, count(*) as c FROM memories GROUP BY area").all() as Array<{ area: string | null; c: number }>;
  const by_area = byAreaRows.reduce((acc, row) => {
    acc[row.area || "general"] = row.c;
    return acc;
  }, {} as Record<string, number>);

  const byProjectRows = database.prepare("SELECT project, count(*) as c FROM memories GROUP BY project").all() as Array<{ project: string | null; c: number }>;
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
      const stats = statSync(DB_PATH);
      total_size_bytes = stats.size;
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
  const searchMode = args.search_mode ?? "balanced";

  // Build FTS5 query with filters
  const ftsQuery = args.enableAdvancedSyntax ? args.query : sanitizeFtsQuery(args.query);

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
    const rows = stmt.all(...params) as Array<MemoryRow & { score?: number }>;

    return rows
      .map((row) => {
        const memory = rowToMemory(row);
        const baseScore = Math.abs(row.score ?? 0);
        return toSearchResult(memory, args.query, baseScore, searchMode);
      })
      .sort((left, right) => right.score - left.score);
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
  const searchMode = args.search_mode ?? "balanced";

  // Split query into individual words, ignore empty spaces
  const words = args.query.trim().split(/\s+/).filter(Boolean);

  let sql = "SELECT * FROM memories WHERE 1=1";
  const params: (string | number)[] = [];

  // If there are words, add a LIKE condition for each word
  if (words.length > 0) {
    for (const word of words) {
      sql += " AND (COALESCE(name, '') LIKE ? OR content LIKE ? OR COALESCE(project, '') LIKE ? OR tags LIKE ?)";
      params.push(`%${word}%`, `%${word}%`, `%${word}%`, `%${word}%`);
    }
  } else {
    // Fallback if empty query
    sql += " AND (COALESCE(name, '') LIKE ? OR content LIKE ? OR COALESCE(project, '') LIKE ? OR tags LIKE ?)";
    params.push(`%${args.query}%`, `%${args.query}%`, `%${args.query}%`, `%${args.query}%`);
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
  const rows = stmt.all(...params) as MemoryRow[];

  return rows
    .map((row) => toSearchResult(rowToMemory(row), args.query, 0.5, searchMode))
    .sort((left, right) => right.score - left.score);
}

export function pruneMemories(args: PruneMemoryArgs): PruneMemoryResult {
  const database = getDatabase();
  const threshold = args.threshold_score ?? 0;

  // We need to fetch all memories to calculate their dynamic decay score
  const stmt = database.prepare("SELECT * FROM memories");
  const rows = stmt.all() as MemoryRow[];

  const toPrune: { id: string; name: string | null }[] = [];

  for (const row of rows) {
    const memory = rowToMemory(row);
    if ((memory.decay_score ?? 0) < threshold) {
      toPrune.push({ id: memory.id, name: memory.name || null });
    }
  }

  if (!args.dry_run && toPrune.length > 0) {
    const deleteStmt = database.prepare("DELETE FROM memories WHERE id = ?");
    const deleteMany = database.transaction((ids: string[]) => {
      for (const id of ids) {
        deleteStmt.run(id);
      }
    });
    deleteMany(toPrune.map(p => p.id));
  }

  return {
    success: true,
    pruned_count: toPrune.length,
    details: toPrune
  };
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
