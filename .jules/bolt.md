## 2024-05-28 - Optimizing Database Selects for JSON Columns
**Learning:** Using `SELECT *` combined with ORM-style row mappers (like `rowToMemory`) that aggressively parse JSON columns (`tags`, `metadata`) for every returned row can be a massive performance bottleneck when filtering a large dataset in JavaScript.
**Action:** When filtering rows in JavaScript based on a subset of simple columns (like `name` or `id`), fetch only those required columns first (`SELECT id, name FROM ...`). Perform the JavaScript filtering, and then execute a secondary query (`SELECT * FROM ... WHERE id IN (...)`) to retrieve and parse the full row data only for the matching subset. This avoids unnecessary JSON parsing for discarded rows and significantly improves performance.

## 2024-05-31 - Mitigating N+1 Queries in Memory Iteration
**Learning:** `createMemoryContextPack` experienced N+1 query patterns because it fetched full memory contents individually using `getMemoryRecord` within a loop. This degrades performance as datasets and request payload grows.
**Action:** Created `getMemoriesByIds` to batch-fetch `Memory` structures using `IN` clauses with pre-extracted IDs. Also learned to chunk these IDs (e.g., in batches of 900) to adhere to SQLite's `SQLITE_LIMIT_VARIABLE_NUMBER` limits.
