import OpenAI from "openai";
import { CONFIG } from "../config";
import { EmbeddingResponse } from "../types";

export class EmbeddingsService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: CONFIG.OPENAI.API_KEY,
    });
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: CONFIG.OPENAI.EMBEDDING_MODEL,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: CONFIG.OPENAI.EMBEDDING_MODEL,
        input: texts,
      });

      return {
        data: response.data.map((item, index) => ({
          embedding: item.embedding,
          index: index,
        })),
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          total_tokens: response.usage.total_tokens,
        },
      };
    } catch (error) {
      console.error('Error creating embeddings:', error);
      throw error;
    }
  }
} 