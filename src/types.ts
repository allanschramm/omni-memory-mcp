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

export interface UpdateMemoryResult {
  success: boolean;
  changes: number;
}

export interface DeleteMemoryResult {
  success: boolean;
  changes: number;
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
