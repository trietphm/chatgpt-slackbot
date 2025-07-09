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