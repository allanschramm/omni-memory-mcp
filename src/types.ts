/**
 * Omni Memory MCP - TypeScript Types
 */

export type MemoryArea = "general" | "snippets" | "solutions" | "preferences";

export interface Memory {
  id: string;
  content: string;
  area: MemoryArea;
  project: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AddMemoryArgs {
  content: string;
  area?: MemoryArea;
  project?: string;
  tags?: string[];
}

export interface GetMemoryArgs {
  id: string;
}

export interface UpdateMemoryArgs {
  id: string;
  content?: string;
  area?: MemoryArea;
  project?: string;
  tags?: string[];
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
}

export interface SearchResult extends Memory {
  score: number;
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
