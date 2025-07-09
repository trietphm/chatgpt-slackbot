import { CONFIG } from "../config";
import { SlackMessage } from "../types";
import axios from "axios";

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

  /**
   * Extract image URLs from Slack message
   */
  static extractImageUrls(message: any): string[] {
    const imageUrls: string[] = [];

    // Check for files with image types
    if (message.files && Array.isArray(message.files)) {
      for (const file of message.files) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          // Use the file ID for downloading
          if (file.id) {
            imageUrls.push(file.id);
          }
        }
      }
    }

    // Check for image attachments
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        if (attachment.image_url) {
          imageUrls.push(attachment.image_url);
        }
        if (attachment.thumb_url) {
          imageUrls.push(attachment.thumb_url);
        }
      }
    }

    return imageUrls;
  }

  /**
   * Download image and convert to base64
   */
  async downloadImageAsBase64(imageUrlOrId: string, client: any): Promise<string | null> {
    try {
      let fileId = imageUrlOrId;
      
      // If it's a URL, extract the file ID
      if (imageUrlOrId.includes('/')) {
        fileId = imageUrlOrId.split('/').pop()?.split('?')[0] || '';
      }
      
      if (!fileId) {
        console.error('Could not extract file ID from:', imageUrlOrId);
        return null;
      }

      // Get file info from Slack
      const fileInfo = await client.files.info({
        file: fileId,
      });

      if (fileInfo.file && fileInfo.file.url_private) {
        // Download the image using the private URL
        const imageResponse = await axios.get(fileInfo.file.url_private, {
          headers: {
            'Authorization': `Bearer ${CONFIG.SLACK.BOT_TOKEN}`,
          },
          responseType: 'arraybuffer',
        });

        const base64 = Buffer.from(imageResponse.data).toString('base64');
        const mimeType = fileInfo.file.mimetype || 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
      }
    } catch (error) {
      console.error('Error downloading image:', error);
    }

    return null;
  }

  /**
   * Process message and extract images as base64
   */
  async processMessageImages(message: any, client: any): Promise<{ text: string; images: string[] }> {
    const text = message.text || '';
    const imageUrls = SlackService.extractImageUrls(message);
    const base64Images: string[] = [];

    console.log(`Processing message with ${imageUrls.length} images found`);

    for (const imageUrl of imageUrls) {
      console.log(`Downloading image: ${imageUrl}`);
      const base64Image = await this.downloadImageAsBase64(imageUrl, client);
      if (base64Image) {
        base64Images.push(base64Image);
        console.log(`Successfully converted image to base64`);
      } else {
        console.log(`Failed to convert image to base64`);
      }
    }

    return { text, images: base64Images };
  }
} 