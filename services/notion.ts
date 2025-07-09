import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { CONFIG } from "../config";
import { NotionResponse } from "../types";

export class NotionService {
  private client: Client;
  private n2m: NotionToMarkdown;

  constructor() {
    this.client = new Client({
      auth: CONFIG.NOTION.TOKEN,
    });
    this.n2m = new NotionToMarkdown({ notionClient: this.client });
  }

  async getMarkdownDataFromPage(pageId: string): Promise<NotionResponse> {
    if (!CONFIG.NOTION.TOKEN) {
      return { success: false, message: "Notion token is missing" };
    }

    try {
      const mdblocks = await this.n2m.pageToMarkdown(pageId);
      const mdString = this.n2m.toMarkdownString(mdblocks);
      return { success: true, message: mdString.parent };
    } catch (error) {
      return { 
        success: false, 
        message: `Error while fetching Notion page, please make sure to connect the page with ChatGPT Integration. Error: ${error}` 
      };
    }
  }

  static extractPageId(message: string): string {
    const regex = /^<https:\/\/www\.notion\.so\/[^\/]+\/[^\/]+-([0-9a-f]{32})>$/;
    const match = message.match(regex);
    return match ? match[1] : "";
  }
} 