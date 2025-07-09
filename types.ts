export enum Role {
  user = 'user',
  assistant = 'assistant',
  system = 'system',
}

export interface ChatMessage {
  role: string;
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface PromptCommand {
  action: 'read_notion_page' | 'summary' | 'thread' | 'none';
  value: string;
  prompt: string;
}

export interface NotionResponse {
  success: boolean;
  message: string;
}

export interface SlackMessage {
  text?: string;
  user: string;
  ts: string;
  thread_ts?: string;
  event_ts?: string;
  channel: string;
  attachments?: Array<{
    pretext?: string;
    text?: string;
    fallback?: string;
  }>;
}

export interface SlackEvent {
  text: string;
  user: string;
  ts: string;
  thread_ts?: string;
  event_ts?: string;
  channel: string;
}

// Knowledge Base Types
export interface KnowledgeChunk {
  id: string;
  content: string;
  filename: string;
  chunk_index: number;
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
}

export interface SearchResult {
  content: string;
  filename: string;
  chunk_index: number;
  similarity: number;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface KnowledgeBaseConfig {
  folder_path: string;
  chunk_size: number;
  chunk_overlap: number;
  model: string;
} 