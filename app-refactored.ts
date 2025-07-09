import { App } from "@slack/bolt";
import { CONFIG } from "./config";
import { ConversationService } from "./services/conversation";
import { Logger } from "./utils/logger";
import { Analytics } from "./utils/analytics";
import { SlackService } from "./services/slack";
import { SlackMessage, SlackEvent } from "./types";
import { PROMPTS } from "./config";

class SlackChatApp {
  private app: App;
  private conversationService: ConversationService;

  constructor() {
    this.app = new App({
      token: CONFIG.SLACK.BOT_TOKEN,
      signingSecret: CONFIG.SLACK.SIGNING_SECRET,
      socketMode: true,
      appToken: CONFIG.SLACK.APP_TOKEN,
    });

    this.conversationService = new ConversationService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle direct messages
    this.app.message(this.handleMessage.bind(this));
    
    // Handle mentions
    this.app.event("app_mention", this.handleMention.bind(this));
  }

  private async handleMessage({ message, say, client }: any): Promise<void> {
    // Check if message has text or files (images)
    const hasText = message.text && message.text.trim().length > 0;
    const hasFiles = message.files && message.files.length > 0;
    
    if (!hasText && !hasFiles) {
      Logger.log(`Ignored message: ${JSON.stringify(message)}`);
      return;
    }

    await this.processSlackEvent(message, say, client);
  }

  private async handleMention({ event, say, client }: any): Promise<void> {
    Logger.log(`Mention: ${event.text}`);
    await this.processSlackEvent(event, say, client);
  }

  private async processSlackEvent(message: SlackMessage | SlackEvent, say: any, client: any): Promise<void> {
    try {
      const hasText = message.text && message.text.trim().length > 0;
      const prompt = hasText ? SlackService.extractRawPrompt(message.text || '') : '';
      const threadId = SlackService.getThreadId(message as SlackMessage);
      
      // Add waiting reaction
      await this.conversationService.getSlackService().addWaitingReaction(
        client, 
        message.channel, 
        message.ts
      );
      
      Logger.log(`Sent message: ${prompt}`);

      // Process the prompt command
      const promptCommand = await this.conversationService.processPromptCommand(
        prompt, 
        client, 
        message as SlackMessage, 
        say
      );

      // Handle different actions
      switch (promptCommand.action) {
        case 'read_notion_page':
          // Already handled in processPromptCommand
          break;
        case 'summary':
        case 'thread':
          await this.conversationService.replyToSlack(
            promptCommand.prompt, 
            threadId, 
            message as SlackMessage, 
            say,
            client
          );
          break;
        case 'none':
          await this.conversationService.replyToSlack(
            prompt, 
            threadId, 
            message as SlackMessage, 
            say,
            client
          );
          break;
      }

      // Remove waiting reaction
      await this.conversationService.getSlackService().removeWaitingReaction(
        client, 
        message.channel, 
        message.ts
      );

      // Log analytics
      const username = this.conversationService.getSlackService().getUserName(message.user);
      await Analytics.log(message.user, username, prompt);

    } catch (error) {
      await this.handleError(error, say, message);
    }
  }

  private async handleError(error: any, say: any, message: SlackMessage | SlackEvent): Promise<void> {
    await say({
      text: PROMPTS.ERROR,
      thread_ts: message.ts,
    });
    
    Logger.error('Error processing message', {
      message: message,
      text: message.text,
      error: error
    });
  }

  async start(): Promise<void> {
    try {
      await this.app.start();
      Logger.info("⚡️ Slack chat app is running!");
    } catch (error) {
      Logger.error("Failed to start app", error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.conversationService.getSlackService().loadUsers(this.app.client);
      Logger.info("Slack users loaded successfully");
    } catch (error) {
      Logger.error("Error during initialization", error);
    }
  }

  async test(): Promise<any> {
    try {
      const authTest = await this.app.client.auth.test();
      console.log("Auth test successful:", authTest);
      return authTest;
    } catch (error) {
      Logger.error("Error during auth test", error);
      throw error;
    }
  }
}

// Auto restart functionality
const startApp = async (): Promise<void> => {
  const app = new SlackChatApp();
  
  try {
    await app.initialize();

    // Get bot user info
    await app.test();
    await app.start();
  } catch (error) {
    Logger.error("App crashed, restarting...", error);
    setTimeout(() => startApp(), 5000); // Restart after 5 seconds
  }
};

// Start the application
startApp().catch((error) => {
  Logger.error("Failed to start application", error);
  process.exit(1);
}); 
