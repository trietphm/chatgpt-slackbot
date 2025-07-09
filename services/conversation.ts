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

  async replyToSlack(prompt: string, threadId: string, message: SlackMessage, say: any): Promise<void> {
    let conversations = this.threadMap.get(threadId) || [];

    // Add the user message to the conversation
    conversations.push(OpenAIService.createUserMessage(prompt));

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