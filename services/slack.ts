import { CONFIG } from "../config";
import { SlackMessage } from "../types";

export class SlackService {
  private users: Map<string, string> = new Map();

  constructor() {}

  async addWaitingReaction(client: any, channel: string, timestamp: string): Promise<void> {
    try {
      await client.reactions.add({
        channel,
        name: CONFIG.EMOJI.WAITING,
        timestamp,
      });
    } catch (error: any) {
      // Log the error but don't fail the entire operation
      console.error('Error adding waiting reaction:', error);
      if (error?.data?.error === 'invalid_name') {
        console.error(`Emoji "${CONFIG.EMOJI.WAITING}" not found in workspace. Please use a valid emoji name.`);
      }
    }
  }

  async removeWaitingReaction(client: any, channel: string, timestamp: string): Promise<void> {
    try {
      await client.reactions.remove({
        channel,
        name: CONFIG.EMOJI.WAITING,
        timestamp,
      });
    } catch (error: any) {
      // Ignore "no_reaction" error as it just means the reaction wasn't there
      if (error?.data?.error !== 'no_reaction') {
        console.error('Error removing waiting reaction:', error);
      }
    }
  }

  async fetchThreadMessages(client: any, threadTs: string, channel: string): Promise<string> {
    try {
      const response = await client.conversations.replies({
        channel,
        ts: threadTs,
      });

      let conversations = "";
      for (const message of response.messages) {
        const userName = this.users.get(message.user) || message.user;
        conversations += `${userName}: ${message.text}\n`;
        
        if (message.attachments && message.attachments.length > 0) {
          const attachment = message.attachments[0];
          const attachMessage = attachment.pretext 
            ? `${attachment.pretext}: ${attachment.text || attachment.fallback}`
            : attachment.text || attachment.fallback;
          conversations += `${userName} attach: ${attachMessage}\n`;
        }
      }
      return conversations;
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return "";
    }
  }

  async loadUsers(client: any): Promise<void> {
    try {
      const users = await client.users.list();
      for (const user of users.members) {
        const name = user.name + (user.real_name ? ` (${user.real_name})` : "");
        this.users.set(user.id, name);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  getUserName(userId: string): string {
    return this.users.get(userId) || userId;
  }

  static extractRawPrompt(message: string): string {
    return message.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "").trim();
  }

  static getThreadId(message: SlackMessage): string {
    return message.thread_ts || message.event_ts || message.ts;
  }
} 