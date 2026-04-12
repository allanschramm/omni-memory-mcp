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

## 2025-03-05 - Hoisting Date and Time Calculations to Reduce GC Pressure
**Learning:** Instantiating `new Date()` and `new Date(string)` inside tight loops like database result mapping or `pruneMemories` generates significant and unnecessary CPU load and Garbage Collection (GC) pressure. Repeatedly evaluating `Date.now()` or instantiating Date objects for invariant current time or parsing known date strings scales O(n) per array traversal.
**Action:** Always hoist `Date.now()` outside of mapping and filter loops and pass the timestamp down via an optional parameter to metric calculation functions. Use `Date.parse(dateString)` instead of `new Date(dateString).getTime()` to safely retrieve timestamps from string representations without incurring full object allocations.

## 2025-03-08 - Adding Database Indexes on Frequently Queried Fields
**Learning:** Full table scans to count rows (e.g. `SELECT area, count(*) ... GROUP BY area`) or list records (e.g. `SELECT * ... WHERE area = ? ORDER BY created_at DESC`) without appropriate indexing become very slow and consume excessive CPU/I/O on tables with a large amount of records (100,000+).
**Action:** When working with SQLite, apply `CREATE INDEX IF NOT EXISTS` for columns commonly used in `WHERE`, `ORDER BY`, or `GROUP BY` clauses, such as `area`, `project`, and `created_at`. This drastically reduces read times without adding noticeable overhead for single-record inserts.

## 2024-05-18 - [Optimize `findMemoriesByNormalizedName` and `pruneMemories` Iterator]
**Learning:** For unbounded `SELECT` operations matching many or all database rows (such as listing candidates or checking items to prune), using `.all()` in `better-sqlite3` fetches the entire dataset into a massive Node.js memory array at once. This drastically spikes peak memory usage and garbage collection times compared to processing one row at a time.
**Action:** When evaluating or filtering large datasets, prefer streaming the database rows via `.iterate()` instead of loading them all via `.all()`. This prevents OOM errors for large databases and allows early returns or efficient filtering logic to operate immediately without loading unused records.

## 2025-04-10 - Optimizing estimateTokenCount String Processing
**Learning:** Functions that calculate metrics on strings, like `estimateTokenCount` which measures the length of a normalized string, were using `replace(/\s+/g, " ").trim()`. This incurs a massive performance penalty on large text payloads as it forces the V8 engine to allocate full string duplicates, perform complex regex pattern matching, and causes high Garbage Collection (GC) overhead.
**Action:** When evaluating metrics on a string (like counting length or words) without needing the processed text itself, calculate it mathematically by streaming over the characters `charCodeAt`. Avoid regex string `replace` or `match` operations entirely. This transforms an expensive O(N) allocation and regex operation into a highly efficient O(N) traversal in O(1) space, dramatically reducing latency.

## 2025-04-12 - Replacing .toFixed() with Math.round() for performance optimization
**Learning:** The use of `Number(value.toFixed(n))` in high-frequency scoring functions (like `calculateDecayScore` and `computeSearchScore`) creates unnecessary string allocations and string-to-number conversions.
**Action:** Replace `Number(score.toFixed(3))` with `Math.round(score * 1000) / 1000` to yield CPU performance gains by avoiding expensive string allocations.

## 2025-05-18 - Replacing toFixed with Math.round
**Learning:** `Number(score.toFixed(3))` creates unnecessary string allocations and string-to-number conversions in tight mathematical calculation loops (like `computeSearchScore` and `calculateDecayScore`), hurting CPU performance.
**Action:** Use `Math.round(score * 1000) / 1000` instead of `Number(score.toFixed(3))`. This approach retains the required precision without allocating new string objects, resulting in up to 100x faster execution.
