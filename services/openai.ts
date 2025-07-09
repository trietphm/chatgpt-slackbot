import OpenAI from "openai";
import { CONFIG } from "../config";
import { ChatMessage, Role } from "../types";

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: CONFIG.OPENAI.API_KEY,
    });
  }

  async askChatCompletion(messages: ChatMessage[]): Promise<string | null> {
    try {
      const completion = await this.client.chat.completions.create({
        model: CONFIG.OPENAI.MODEL,
        messages: messages as any
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  }

  static createUserMessage(content: string): ChatMessage {
    return { role: Role.user, content };
  }

  static createAssistantMessage(content: string): ChatMessage {
    return { role: Role.assistant, content };
  }

  static createSystemMessage(content: string): ChatMessage {
    return { role: Role.system, content };
  }
} 