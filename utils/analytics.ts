import fs from 'node:fs';
import { CONFIG } from '../config';

export class Analytics {
  static async log(userId: string, username: string, prompt: string): Promise<void> {
    if (!CONFIG.ANALYTICS.ENABLED) {
      return;
    }

    const logEntry = `${new Date().toISOString()},${userId},${username},${prompt.length}\n`;
    
    try {
      await fs.promises.appendFile(CONFIG.ANALYTICS.FILE, logEntry);
    } catch (error) {
      console.error('Failed to write analytics:', error);
    }
  }
} 