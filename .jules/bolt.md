## 2024-05-28 - Optimizing Database Selects for JSON Columns
**Learning:** Using `SELECT *` combined with ORM-style row mappers (like `rowToMemory`) that aggressively parse JSON columns (`tags`, `metadata`) for every returned row can be a massive performance bottleneck when filtering a large dataset in JavaScript.
**Action:** When filtering rows in JavaScript based on a subset of simple columns (like `name` or `id`), fetch only those required columns first (`SELECT id, name FROM ...`). Perform the JavaScript filtering, and then execute a secondary query (`SELECT * FROM ... WHERE id IN (...)`) to retrieve and parse the full row data only for the matching subset. This avoids unnecessary JSON parsing for discarded rows and significantly improves performance.

## 2024-05-31 - Mitigating N+1 Queries in Memory Iteration
**Learning:** `createMemoryContextPack` experienced N+1 query patterns because it fetched full memory contents individually using `getMemoryRecord` within a loop. This degrades performance as datasets and request payload grows.
**Action:** Created `getMemoriesByIds` to batch-fetch `Memory` structures using `IN` clauses with pre-extracted IDs. Also learned to chunk these IDs (e.g., in batches of 900) to adhere to SQLite's `SQLITE_LIMIT_VARIABLE_NUMBER` limits.

## 2024-06-05 - Avoid SELECT * for Dynamic Metric Calculation
**Learning:** Full table scans loading `SELECT *` into Node.js memory just to compute a dynamic metric (like decay score) across all rows can cause severe memory bloat and OOMs when tables contain large text (`content`) or JSON fields (`tags`, `metadata`). The overhead is not just DB I/O, but also JavaScript garbage collection and unnecessary `JSON.parse` executions for every row.
**Action:** When evaluating dataset-wide metrics to identify rows for actions like pruning, write queries that fetch only the minimal numeric and timestamp columns required for the calculation. Avoid using generic row mappers (`rowToMemory`) that aggressively parse large payloads when you only need a few fields.

## 2024-06-12 - Hoisting Invariant String Processing Outside Search Loops
**Learning:** Functions like `tokenizeQuery` and `normalizeForExactMatch` were being executed repeatedly inside `.map()` loops when transforming database rows into `SearchResult` objects. Because the search query text remains exactly the same for every row in a single result set, re-tokenizing and re-normalizing the query per row introduced unnecessary overhead.
**Action:** When mapping over database result sets (like in `searchMemories` and `fallbackSearch`), identify invariant values and compute them exactly once before the loop begins. Passing these pre-computed values down into helper functions drastically reduces redundant allocations and parsing time.

## 2025-02-12 - Replacing toLowerCase/includes loop with Regex tests for Search Mapping
**Learning:** Inside `getMatchedFields`, invoking `.toLowerCase()` on potentially large fields (like `memory.content`) inside a mapping loop over multiple database results causes massive redundant string allocations. Using `Array.some(token => content.toLowerCase().includes(token))` creates significant GC pressure and CPU overhead compared to case-insensitive regular expressions.
**Action:** Pre-compile query tokens into case-insensitive regular expressions outside the loop (`new RegExp(token, 'i')`). Inside the loop, test these pre-compiled regexes directly against the original string fields instead of lowering the strings. This avoids duplicating large strings in memory and is drastically faster. Additionally, lazily perform operations like `normalizeForExactMatch` only when a match is verified to avoid unnecessary computations.

## 2025-02-28 - Optimizing listMemories with explicit SELECT
**Learning:** Using `SELECT *` in `listMemories` loads full `content` blobs into Node.js memory just to discard them, as the API implements Progressive Disclosure and doesn't return `content`. For large payloads, this causes massive GC pressure, unnecessary memory allocations, and slows down database queries significantly.
**Action:** Replace `SELECT *` with an explicit column selection (`SELECT id, name, '' as content, area, ...`) for list queries that do not return the full `content`. This prevents loading large strings entirely from the database to memory, decreasing response time and GC overhead drastically.
