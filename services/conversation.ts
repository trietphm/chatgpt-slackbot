import { ChatMessage, PromptCommand, SlackMessage } from "../types";
import { OpenAIService } from "./openai";
import { NotionService } from "./notion";
import { SlackService } from "./slack";
import { PROMPTS } from "../config";
import slackifyMarkdown from "slackify-markdown";

export class ConversationService {
  private threadMap: Map<string, ChatMessage[]> = new Map();
  private openaiService: OpenAIService;
  private notionService: NotionService;
  private slackService: SlackService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.notionService = new NotionService();
    this.slackService = new SlackService();
  }

  async processPromptCommand(
    prompt: string, 
    client: any, 
    message: SlackMessage, 
    say: any
  ): Promise<PromptCommand> {
    const threadId = SlackService.getThreadId(message);

    // Check if the message is a Notion page link
    const notionPageId = NotionService.extractPageId(prompt);
    if (notionPageId) {
      await this.handleNotionPage(notionPageId, threadId, message.ts, say);
      return { action: 'read_notion_page', value: notionPageId, prompt };
    }

    // Handle summary command
    if (prompt.toLowerCase() === "summary") {
      const threadMessages = await this.slackService.fetchThreadMessages(
        client, 
        message.thread_ts!, 
        message.channel
      );
      const summaryPrompt = `${PROMPTS.SUMMARY}\n\n${threadMessages}`;
      return { action: 'summary', value: summaryPrompt, prompt: summaryPrompt };
    }

    // Handle thread command
    if (prompt.startsWith("thread")) {
      const threadMessages = await this.slackService.fetchThreadMessages(
        client, 
        message.thread_ts!, 
        message.channel
      );
      const newPrompt = prompt.substring(prompt.indexOf(" ") + 1);
      const fullPrompt = `${newPrompt}\n\n${threadMessages}`;
      return { action: 'thread', value: fullPrompt, prompt: fullPrompt };
    }

    return { action: 'none', value: '', prompt };
  }

  async replyToSlack(prompt: string, threadId: string, message: SlackMessage, say: any, client?: any): Promise<void> {
    let conversations = this.threadMap.get(threadId) || [];

    // If this is a new thread or we don't have conversation history, fetch the thread
    if (conversations.length === 0 && client) {
      await this.loadThreadHistory(threadId, message.channel, client);
      conversations = this.threadMap.get(threadId) || [];
    } else if (conversations.length > 0 && client) {
      // If we have existing conversations, make sure we have the latest thread context
      // This ensures we don't miss any recent messages
      await this.updateThreadHistory(threadId, message.channel, client);
      conversations = this.threadMap.get(threadId) || [];
    }

    // Process images if client is provided
    let processedPrompt = prompt;
    let images: string[] = [];
    
    if (client) {
      const processed = await this.slackService.processMessageImages(message, client);
      processedPrompt = processed.text;
      images = processed.images;
    }

    // If no text prompt but we have images, create a default prompt
    if (!processedPrompt.trim() && images.length > 0) {
      processedPrompt = "Please analyze this image and describe what you see.";
    }

    // Add the user message to the conversation (with images if present)
    if (images.length > 0) {
      conversations.push(OpenAIService.createUserMessageWithImages(processedPrompt, images));
    } else {
      conversations.push(OpenAIService.createUserMessage(processedPrompt));
    }

    // Send the conversation to OpenAI
    const response = await this.openaiService.askChatCompletion(conversations);
    if (!response) {
      await say({
        text: PROMPTS.ERROR,
        thread_ts: message.ts,
      });
      return;
    }

    // Add the response to the conversation
    conversations.push(OpenAIService.createAssistantMessage(response));
    
    // Update the threadMap
    this.threadMap.set(threadId, conversations);

    // Send response to Slack
    await say({
      text: slackifyMarkdown(response),
      thread_ts: message.ts,
    });
  }

  /**
   * Load and process the entire thread history
   */
  private async loadThreadHistory(threadId: string, channel: string, client: any): Promise<void> {
    try {
      console.log(`Loading thread history for thread: ${threadId}`);
      
      // Fetch all messages in the thread
      const response = await client.conversations.replies({
        channel: channel,
        ts: threadId,
      });

      const conversations: ChatMessage[] = [];
      
      // Process each message in the thread
      for (const msg of response.messages) {
        // Skip bot messages to avoid loops
        if (msg.bot_id) {
          continue;
        }

        const userName = this.slackService.getUserName(msg.user);
        let messageText = msg.text || '';
        
        // Process images in the message
        const processed = await this.slackService.processMessageImages(msg, client);
        const images = processed.images;
        
        // Create the message content
        if (images.length > 0) {
          // If there are images, create a multi-modal message
          const content = `${userName}: ${messageText}`;
          conversations.push(OpenAIService.createUserMessageWithImages(content, images));
        } else if (messageText.trim()) {
          // If there's only text, create a text message
          const content = `${userName}: ${messageText}`;
          conversations.push(OpenAIService.createUserMessage(content));
        }
      }

      // Store the thread history
      this.threadMap.set(threadId, conversations);
      console.log(`Loaded ${conversations.length} messages from thread history`);
      
    } catch (error) {
      console.error('Error loading thread history:', error);
    }
  }

  /**
   * Update existing thread history with any new messages
   */
  private async updateThreadHistory(threadId: string, channel: string, client: any): Promise<void> {
    try {
      console.log(`Updating thread history for thread: ${threadId}`);
      
      // Fetch all messages in the thread
      const response = await client.conversations.replies({
        channel: channel,
        ts: threadId,
      });

      const existingConversations = this.threadMap.get(threadId) || [];
      const newConversations: ChatMessage[] = [];
      
      // Process each message in the thread
      for (const msg of response.messages) {
        // Skip bot messages to avoid loops
        if (msg.bot_id) {
          continue;
        }

        const userName = this.slackService.getUserName(msg.user);
        let messageText = msg.text || '';
        
        // Process images in the message
        const processed = await this.slackService.processMessageImages(msg, client);
        const images = processed.images;
        
        // Create the message content
        if (images.length > 0) {
          // If there are images, create a multi-modal message
          const content = `${userName}: ${messageText}`;
          newConversations.push(OpenAIService.createUserMessageWithImages(content, images));
        } else if (messageText.trim()) {
          // If there's only text, create a text message
          const content = `${userName}: ${messageText}`;
          newConversations.push(OpenAIService.createUserMessage(content));
        }
      }

      // Only update if we have new messages
      if (newConversations.length > existingConversations.length) {
        this.threadMap.set(threadId, newConversations);
        console.log(`Updated thread history: ${newConversations.length} messages`);
      }
      
    } catch (error) {
      console.error('Error updating thread history:', error);
    }
  }

  private async handleNotionPage(pageId: string, threadId: string, slackTs: string, say: any): Promise<void> {
    const data = await this.notionService.getMarkdownDataFromPage(pageId);
    if (!data.success) {
      await say({
        text: data.message,
        thread_ts: slackTs,
      });
      return;
    }

    let conversations = this.threadMap.get(threadId) || [];
    const prompt = `${PROMPTS.NOTION_CONTEXT}${data.message}`;

    // Add the context and confirmation messages
    conversations.push(OpenAIService.createUserMessage(prompt));
    conversations.push(OpenAIService.createAssistantMessage(PROMPTS.NOTION_READY));
 
    // Update the threadMap
    this.threadMap.set(threadId, conversations);

    await say({
      text: PROMPTS.NOTION_READY,
      thread_ts: slackTs,
    });
  }

  getSlackService(): SlackService {
    return this.slackService;
  }
} 