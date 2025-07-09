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

  static createUserMessage(content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>): ChatMessage {
    return { role: Role.user, content };
  }

  static createAssistantMessage(content: string): ChatMessage {
    return { role: Role.assistant, content };
  }

  static createSystemMessage(content: string): ChatMessage {
    return { role: Role.system, content };
  }

  static createUserMessageWithImages(text: string, images: string[]): ChatMessage {
    if (images.length === 0) {
      return this.createUserMessage(text);
    }

    const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [];
    
    // Add text content if present
    if (text.trim()) {
      content.push({ type: 'text', text });
    }

    // Add image content
    for (const image of images) {
      content.push({ type: 'image_url', image_url: { url: image } });
    }

    return { role: Role.user, content };
  }
} 