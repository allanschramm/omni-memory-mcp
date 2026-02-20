import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";

let db: Database.Database;

function setupTestDb(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("journal_mode = WAL");

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

  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      project,
      tags,
      content='memories',
      content_rowid='rowid'
    )
  `);

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

  return database;
}

describe("Database", () => {
  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("should create memories table", () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'").get();
    expect(table).toBeDefined();
  });

  it("should create FTS5 virtual table", () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'").get();
    expect(table).toBeDefined();
  });

  it("should insert a memory", () => {
    const stmt = db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run("test-id", "Test content", "general", "test-project", "[]");
    expect(result.changes).toBe(1);
  });

  it("should retrieve a memory by id", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-2", "Test content 2", "snippets", "my-project", '["tag1", "tag2"]'
    );

    const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get("test-id-2") as Record<string, unknown>;
    expect(memory).toBeDefined();
    expect(memory.content).toBe("Test content 2");
    expect(memory.area).toBe("snippets");
    expect(memory.project).toBe("my-project");
  });

  it("should update a memory", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-3", "Original content", "general", null, "[]"
    );

    const result = db.prepare("UPDATE memories SET content = ?, updated_at = datetime('now') WHERE id = ?").run(
      "Updated content", "test-id-3"
    );

    expect(result.changes).toBe(1);

    const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get("test-id-3") as Record<string, unknown>;
    expect(memory.content).toBe("Updated content");
  });

  it("should delete a memory", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-4", "To be deleted", "general", null, "[]"
    );

    const result = db.prepare("DELETE FROM memories WHERE id = ?").run("test-id-4");
    expect(result.changes).toBe(1);

    const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get("test-id-4");
    expect(memory).toBeUndefined();
  });

  it("should search memories with FTS5", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-5", "TypeScript is a programming language", "general", null, "[]"
    );
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-6", "Python is another programming language", "general", null, "[]"
    );

    const results = db.prepare(`
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH 'TypeScript'
    `).all() as Record<string, unknown>[];

    expect(results.length).toBe(1);
    expect(results[0].content).toContain("TypeScript");
  });

  it("should list memories by project", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-7", "Content 1", "general", "project-a", "[]"
    );
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-8", "Content 2", "general", "project-b", "[]"
    );
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-9", "Content 3", "general", "project-a", "[]"
    );

    const results = db.prepare("SELECT * FROM memories WHERE project = ?").all("project-a") as Record<string, unknown>[];
    expect(results.length).toBe(2);
  });

  it("should list memories by area", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-10", "Snippet 1", "snippets", null, "[]"
    );
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-11", "General 1", "general", null, "[]"
    );

    const results = db.prepare("SELECT * FROM memories WHERE area = ?").all("snippets") as Record<string, unknown>[];
    expect(results.length).toBe(1);
    expect(results[0].area).toBe("snippets");
  });

  it("should filter memories by tag", () => {
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-12", "Tagged content", "general", null, '["important", "todo"]'
    );
    db.prepare("INSERT INTO memories (id, content, area, project, tags) VALUES (?, ?, ?, ?, ?)").run(
      "test-id-13", "Other content", "general", null, '["other"]'
    );

    const results = db.prepare("SELECT * FROM memories WHERE tags LIKE ?").all('%"important"%') as Record<string, unknown>[];
    expect(results.length).toBe(1);
  });
});
