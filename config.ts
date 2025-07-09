import dotenv from "dotenv-safe";

dotenv.config();

export const CONFIG = {
  SLACK: {
    BOT_TOKEN: process.env['SLACK_BOT_TOKEN']!,
    SIGNING_SECRET: process.env['SLACK_SIGNING_SECRET']!,
    APP_TOKEN: process.env['SLACK_APP_TOKEN']!,
  },
  OPENAI: {
    API_KEY: process.env['OPENAI_API_KEY']!,
    MODEL: 'gpt-4',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  },
  NOTION: {
    TOKEN: process.env['NOTION_TOKEN'] || "",
  },
  ANALYTICS: {
    ENABLED: process.env['ENABLE_ANALYTICS'] === 'true',
    FILE: process.env['ANALYTICS_FILE'] || 'analytics.csv',
  },
  EMOJI: {
    WAITING: "hourglass_flowing_sand",
  },
  DATABASE: {
    HOST: process.env['DB_HOST'] || 'localhost',
    PORT: parseInt(process.env['DB_PORT'] || '5432'),
    DATABASE: process.env['DB_NAME'] || 'knowledge_base',
    USER: process.env['DB_USER'] || 'postgres',
    PASSWORD: process.env['DB_PASSWORD'] || '',
    SSL: process.env['DB_SSL'] === 'true',
  },
  KNOWLEDGE_BASE: {
    FOLDER_PATH: process.env['KB_FOLDER_PATH'] || './knowledge',
    CHUNK_SIZE: parseInt(process.env['KB_CHUNK_SIZE'] || '1000'),
    CHUNK_OVERLAP: parseInt(process.env['KB_CHUNK_OVERLAP'] || '200'),
    SEARCH_LIMIT: parseInt(process.env['KB_SEARCH_LIMIT'] || '5'),
    SIMILARITY_THRESHOLD: parseFloat(process.env['KB_SIMILARITY_THRESHOLD'] || '0.7'),
  },
  API: {
    PORT: parseInt(process.env['API_PORT'] || '3000'),
  },
} as const;

export const PROMPTS = {
  SUMMARY: "Read the following Slack thread and provide a concise summary (max 5 sentences) highlighting only the key points. Also, list any action items or decisions that were made. List out questions or concern that have not been cleared. Omit minor details and repetitive information. If conversations are very long, consider chunking by time/topic and summarizing each:",
  NOTION_CONTEXT: "You are a helpful assistant who answers questions about the following Notion page:\n\n",
  NOTION_READY: "I have read the Notion page content. Ask me any questions about it!",
  ERROR: "ERROR: Something went wrong, please try again after a while.",
  KNOWLEDGE_BASE_CONTEXT: "You are a helpful assistant with access to a knowledge base. Use the following context to answer the user's question. If the context doesn't contain enough information to answer the question, say so. Always cite your sources by mentioning the filename.\n\nContext:\n",
} as const; 
