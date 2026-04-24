## 2024-04-24 - Statement Caching Bottlenecks

**Learning:** Repeatedly evaluating `database.prepare()` inside functions like `getStats` that perform numerous static queries causes significant compilation overhead in SQLite.
**Action:** Always extract static `better-sqlite3` statements to module-level variables (or a caching mechanism) to be compiled once. Ensure memory management is handled by explicitly nulling them during connection lifecycle changes like `closeDatabase`.
