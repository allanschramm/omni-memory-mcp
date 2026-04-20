/**
 * Omni Memory MCP - TypeScript Types
 */

export type MemoryArea = "general" | "snippets" | "solutions" | "preferences";
export type SearchMode = "balanced" | "exact" | "broad";

export interface Memory {
  id: string;
  name?: string | null;
  content: string;
  area: MemoryArea;
  project: string | null;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  accessed_at?: string | null;
  access_count?: number;
  created_at: string;
  updated_at: string;
  decay_score?: number;
}

export interface AddMemoryArgs {
  name?: string;
  content: string;
  area?: MemoryArea;
  project?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface GetMemoryArgs {
  id: string;
}

export interface UpdateMemoryArgs {
  id: string;
  name?: string;
  content?: string;
  area?: MemoryArea;
  project?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface DeleteMemoryArgs {
  id: string;
}

export interface UpsertMemoryArgs {
  name?: string;
  match_name?: string;
  content: string;
  area?: MemoryArea;
  project?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  allow_create?: boolean;
}

export interface ListMemoryArgs {
  area?: MemoryArea;
  project?: string;
  tag?: string;
  limit?: number;
}

export interface SearchMemoryArgs {
  query: string;
  area?: MemoryArea;
  project?: string;
  limit?: number;
  enableAdvancedSyntax?: boolean;
  search_mode?: SearchMode;
  include_content?: boolean;
}

export interface MemoryContextPackArgs {
  query: string;
  area?: MemoryArea;
  project?: string;
  tag?: string;
  max_tokens?: number;
  max_memories?: number;
  search_mode?: SearchMode;
}

export interface MemoryContextPackMemory {
  id: string;
  name: string | null;
  area: MemoryArea;
  project: string | null;
  tags: string[];
  score: number;
  explanation: string;
  excerpt: string;
}

export interface MemoryContextPackResult {
  success: boolean;
  query: string;
  count: number;
  max_tokens: number;
  estimated_tokens: number;
  truncated: boolean;
  memories: MemoryContextPackMemory[];
}

export interface SearchResult extends Omit<Memory, "content"> {
  content?: string; // Optional to support Progressive Disclosure
  score: number;
  decay_score: number;
  explanation: string;
}

export interface MemoryStats {
  total_memories: number;
  by_area: Record<string, number>;
  by_project: Record<string, number>;
  total_size_bytes: number;
  event_counts: Record<string, number>;
}

export interface PruneMemoryArgs {
  threshold_score?: number;
  dry_run?: boolean;
}

export interface PruneMemoryResult {
  success: boolean;
  pruned_count: number;
  details?: { id: string, name: string | null }[];
}

export interface AddMemoryResult {
  success: boolean;
  id: string;
}

export interface DeleteMemoryResult {
  success: boolean;
  changes: number;
}

export interface UpsertMemoryResult {
  success: boolean;
  action: "created" | "updated" | "ambiguous" | "skipped";
  id?: string;
  changes?: number;
  candidates?: Array<{ id: string; name: string | null; project: string | null }>;
}

export interface ListMemoryResult {
  success: boolean;
  memories: Memory[];
  count: number;
}

export interface SearchMemoryResult {
  success: boolean;
  memories: SearchResult[];
  count: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
}
