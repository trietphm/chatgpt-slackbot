import * as dotenv from "dotenv-safe";

dotenv.config();

export const CONFIG = {
  SLACK: {
    BOT_TOKEN: process.env['SLACK_BOT_TOKEN']!,
    SIGNING_SECRET: process.env['SLACK_SIGNING_SECRET']!,
    APP_TOKEN: process.env['SLACK_APP_TOKEN']!,
  },
  OPENAI: {
    API_KEY: process.env['OPENAI_API_KEY']!,
    MODEL: 'gpt-4.1',
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
} as const;

export const PROMPTS = {
  SUMMARY: "Read the following Slack thread and provide a concise summary (max 5 sentences) highlighting only the key points. Also, list any action items or decisions that were made. List out questions or concern that have not been cleared. Omit minor details and repetitive information. If conversations are very long, consider chunking by time/topic and summarizing each:",
  NOTION_CONTEXT: "You are a helpful assistant who answers questions about the following Notion page:\n\n",
  NOTION_READY: "I have read the Notion page content. Ask me any questions about it!",
  ERROR: "ERROR: Something went wrong, please try again after a while.",
} as const; 
