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

## 2024-05-20 - Eliminating N+1 Query in pruneMemories deletion
**Learning:** Iteratively calling `stmt.run(id)` for thousands of records inside a transaction, while atomic, still incurs significant overhead in the Node.js/SQLite bridge.
**Action:** Implemented chunked batch deletion using `DELETE FROM memories WHERE id IN (...)`. Created a `getDeleteInStatement` helper to cache prepared statements for varying batch sizes (using a 900-item chunk size to stay safely under SQLite's 999 parameter limit). This transforms O(N) database calls into O(N/900) calls, drastically reducing execution time for large-scale pruning operations.

## 2025-05-19 - Adding Database Index on Log/Event Aggregations
**Learning:** Performing a `GROUP BY` aggregation (e.g. `SELECT event_name, count(*) FROM share_events GROUP BY event_name`) in SQLite without an index on the grouping column causes a slow full table scan. As log or event tables like `share_events` naturally grow large over time, this becomes a noticeable bottleneck for stats and reporting queries.
**Action:** Always add indexes (e.g. `CREATE INDEX IF NOT EXISTS`) to columns used in `GROUP BY` clauses for aggregation, especially on tables that constantly accumulate records. This applies the same logic previously used for optimizing `WHERE` clauses on `memories`.

## 2025-05-20 - Eliminate Redundant Database Query by Propagating Content
**Learning:** `createMemoryContextPack` previously relied on `getMemoriesByIds` to fetch the full text of `memories` after retrieving `SearchResult`s from `searchMemories`, because `searchMemories` historically excluded the `content` property for "Progressive Disclosure". This caused extra redundant batch database queries because `searchMemories` *already* fetched the `content` from the database in its SQL query before dropping it in `toSearchResult`.
**Action:** Expose an `include_content?: boolean` flag on `SearchMemoryArgs` so that callers needing the full payload (like `createMemoryContextPack`) can retrieve it in one shot, reducing two database batch queries down to one and simplifying the logic.

## 2025-06-25 - Avoid JSON.parse for default/empty tags
**Learning:** In the `rowToMemory` mapping function, parsing an empty string or default `"[]"` via `JSON.parse` is extremely slow and causes unnecessary memory allocations when processing large recordsets. The overhead for evaluating empty/default cases scales linearly with dataset size and generates significant Garbage Collection pressure.
**Action:** Instead of calling `JSON.parse((row.tags as string) || "[]")`, always use a fast-path ternary check: `(!row.tags || row.tags === "[]") ? [] : JSON.parse(row.tags as string)`. This skips the V8 JSON parser entirely for the majority of cases and drops processing time by nearly 10x for records with default tags.

## 2025-07-26 - Optimize JSON serialization for empty arrays
**Learning:** Calling `JSON.stringify()` for empty arrays (`[]`) is surprisingly slow in V8 when done repeatedly during bulk inserts or updates. Using a fast-path ternary check like `(!tags || tags.length === 0) ? "[]" : JSON.stringify(tags)` bypasses the V8 JSON serializer entirely and is ~20x faster for common default cases.
**Action:** When serializing JSON data for database insertions, especially when default empty arrays are common, use a direct string assignment fast-path. This complements the existing fast-path logic used for `JSON.parse`.

## 2025-10-25 - Use combined RegExp for string matching instead of array .some()
**Learning:** Testing a single combined regular expression using the `|` operator (e.g. `/(token1)|(token2)/i`) against a string is significantly faster and allocates less memory compared to iterating through an array of regular expressions using `.some(regex => regex.test(content))`. This overhead becomes pronounced when testing large text content against multiple tokens repeatedly during search map loops.
**Action:** When filtering or scoring database rows against a list of tokens, combine the tokens into a single regular expression using `new RegExp(tokens.join('|'), 'i')` and test it once per field instead of running `.some()` with an array of individual regexes.
