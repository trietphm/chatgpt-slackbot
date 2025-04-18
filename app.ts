import dotenv from "dotenv-safe";
import OpenAI from "openai";
import slackifyMarkdown from "slackify-markdown";

const { App } = require("@slack/bolt");
const { Client } = require("@notionhq/client")
const { NotionToMarkdown } = require("notion-to-md");
const WAITING_REACTION_EMOJI = "working-on-it";
const fs = require('node:fs');

dotenv.config();
let SlackUsers: Map<string, string> = new Map();
// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, 
  appToken: process.env.SLACK_APP_TOKEN,
});

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], 
});

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// passing notion client to the option
const n2m = new NotionToMarkdown({ notionClient: notion });

enum Role {
  user,
  assistant,
  system,
}

interface ChatMessage {
  role: string,
  content: string
}

async function askChatCompletion(messages) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: messages
  });

  return completion.choices[0]?.message?.content;
}

function newUserMessage(message: string): ChatMessage {
  return { role: Role[Role.user], content: message }
}

function newAssistantMessage(message: string): ChatMessage {
  return { role: Role[Role.assistant], content: message }
}

function newSystemMessage(message: string): ChatMessage {
  return { role: Role[Role.system], content: message }
}

async function reactWaitingEmoji(client, channel, ts) {
  client.reactions.add({
      channel: channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: ts,
    });
}

async function removeWaitingEmoji(client, channel, ts) {
  client.reactions.remove({
      channel: channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: ts,
    });
}

const logWithTimestamp = (message: string): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};


async function fetchMessagesFromSlackThread(client, threadTs, channel) {
  const response = await client.conversations.replies({
    channel: channel,
    ts: threadTs,
  })
 
  // Get all messages from the thread and combine them into a single prompt
  let conversations = "";
  for (let message of response.messages) {
    conversations += SlackUsers.get(message.user) + ": " + message.text + "\n";
    if (message.attachments && message.attachments.length > 0) {
      let attachMessage = message.attachments[0].pretext? message.attachments[0].pretext + ": " : "";

      attachMessage += message.attachments[0].text || message.attachments[0].fallback;
      conversations += SlackUsers.get(message.user) + " attach: " + attachMessage + "\n";
    }
  }
  return conversations;
}

async function getMarkdownDataFromNotionPage(pageId: string) {
  if (process.env.NOTION_TOKEN == "") {
    return {success: "false", message: "Notion token is missing"};
  }

  let mdString;

  try {
    const mdblocks = await n2m.pageToMarkdown(pageId);
    mdString = n2m.toMarkdownString(mdblocks);
  } catch (error) {
    return {success: "false", message: "Error while fetching Notion page, please make sure to connect the page with ChatGPT Integration. Error: " + error};
  }

  return {success: "true", message: mdString.parent};
}

async function addNotionPageIntoThread(pageId: string, threadId: string) {
  const data = await getMarkdownDataFromNotionPage(pageId);
  if (data.success == "false") {
    return {success: false, message: data.message};
  }

  let conversations = threadMap.get(threadId) || [];
  const prompt = "You are a helpful assistant who answers questions about the following Notion page:\n\n" + data.message;

  // Add the user message to the conversation
  conversations.push(newUserMessage(prompt));
  conversations.push(newAssistantMessage("I have read the Notion page content. Ask me any questions about it!"));
 
  // Update the threadMap
  threadMap.set(threadId, conversations);
  return {success: true, message: ""};
}

function getNotionPageId(message: string): string{
  const regex = /^<https:\/\/www\.notion\.so\/[^\/]+\/[^\/]+-([0-9a-f]{32})>$/;
  const match = message.match(regex);

  if (match) {
      return match[1];
  } else {
      // Return null or an appropriate message if no match is found
      return "";
  }
}

async function readNotionPageAndReplySlack(pageId: string, threadId: string, slackTs: any, say: any) {
  const result = await addNotionPageIntoThread(pageId, threadId);
  if (!result.success) {
    say({
      text: result.message,
      thread_ts: slackTs,
    });
  } else {
    say({
      text: "I have read the Notion page content. Ask me any questions about it!",
      thread_ts: slackTs,
    });
  }
}

function getRawPrompt(message: string) {
  // Remove the @mention from the message
  return message.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "").trim();
}

async function getPromptCommand(prompt: string, client: any, message: any, say: any) {
  const threadId = message.thread_ts || message.event_ts;
    console.log("thread");
  // Check if the message is a Notion page link
  const notionPageId = getNotionPageId(prompt);
  if (notionPageId != "") {
    readNotionPageAndReplySlack(notionPageId, threadId, message.ts, say);

    return { action: 'read_notion_page', value: notionPageId, prompt: prompt };
  }

  // Single word command "summary"
  if (prompt.toLowerCase() == "summary") {
    console.log("Summary command detected");
    const SlackThreadMessages = await fetchMessagesFromSlackThread(client, message.thread_ts, message.channel);
    prompt = "Read the following Slack thread and provide a concise summary (max 5 sentences) highlighting only the key points. Also, list any action items or decisions that were made. Omit minor details and repetitive information. If conversations are very long, consider chunking by time/topic and summarizing each: \n\n"
    prompt += SlackThreadMessages;

    return { action: 'summary', value: prompt, prompt: prompt };
  }

  // If the first word of the prompt is thread, the rest of the prompt is the new prompt
  if (prompt.startsWith("thread")) {
    const SlackThreadMessages = await fetchMessagesFromSlackThread(client, message.thread_ts, message.channel);
    prompt = prompt.substring(prompt.indexOf(" ") + 1);
    prompt += "\n\n" + SlackThreadMessages;

    return { action: 'thread', value: prompt, prompt: prompt };
  }

  return { action: 'none', value: '', prompt: prompt };
}

async function replyToSlack(prompt: string, threadId: string, message: any, say: any) {
  let conversations = threadMap.get(threadId) || [];

  // Add the user message to the conversation
  conversations.push(newUserMessage(prompt));

  // Send the conversation to OpenAI
  let response = await askChatCompletion(conversations);
  if (!response) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: message.ts,
    });
    return;
  }
  // Add the response to the conversation
  conversations.push(newAssistantMessage(response));
  
  // Update the threadMap
  threadMap.set(threadId, conversations);

  // Send response to Slack
  await say({
    text: slackifyMarkdown(response),
    thread_ts: message.ts,
  });
}

// --------------------
// Handle Slack Events
// --------------------

// Save all the conversations so we can send this to openai again
// Map<slack_thread_id, ChatMessage[]>
let threadMap: Map<string, ChatMessage[]> = new Map();

// Listens to incoming direct messages
app.message(async ({ message, say, client, logger }) => {
  // Ignore messages that has no text
  if (!message.text) {
    console.log("Ignored message:", message);
    return;
  }

  try {
    let prompt = getRawPrompt(message.text);
    // Get the conversation for the thread
    const threadId = message.thread_ts || message.event_ts;
    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, message.channel, message.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    let promptCommand = await getPromptCommand(prompt, client, message, say);
    switch (promptCommand.action) {
      case 'read_notion_page':
        const notionPageId = promptCommand.value;
        await readNotionPageAndReplySlack(notionPageId, threadId, message.ts, say);
        return;

      case 'thread':
      case 'summary':
        prompt = promptCommand.prompt;
        console.log("summary prompt:", prompt);
        await replyToSlack(prompt, threadId, message, say);
        break;

      case 'none':
        await replyToSlack(prompt, threadId, message, say);
        // Do nothing
        break;
    }
    console.log("Prompt command:", promptCommand);

    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, message.channel, message.ts)

    // Log the analytic
    analyticLog(message.user, SlackUsers.get(message.user), prompt);
  } catch (err) {
    errorHandler(err, say, message);
  }
});

// Listens to mention
app.event("app_mention", async ({ event, context, client, say }) => {
  console.log("Mention: " + event.text);
  let prompt = getRawPrompt(event.text);
  try {
    // Get the conversation for the thread
    const threadId = event.thread_ts || event.event_ts;

    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, event.channel, event.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    let promptCommand = await getPromptCommand(prompt, client, event, say);
    switch (promptCommand.action) {
      case 'read_notion_page':
        const notionPageId = promptCommand.value;
        await readNotionPageAndReplySlack(notionPageId, threadId, event.ts, say);
        return;

      case 'thread':
      case 'summary':
        prompt = promptCommand.prompt;
        console.log("Mention promptCommand:", promptCommand);
        console.log("Mention summary prompt:", prompt);
        await replyToSlack(prompt, threadId, event, say);
        break;

      case 'none':
        // Do nothing
        await replyToSlack(prompt, threadId, event, say);
        break;
    }

    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, event.channel, event.ts)

    // Log the analytic
    analyticLog(event.user, SlackUsers.get(event.user), prompt);
  } catch (err) {
    errorHandler(err, say, event);
  }
});

// --------------------
// End Handle Slack Events
// --------------------

// Auto restart the app when it disconnects from the Slack websocket
const startApp = async () => {
  try {
    await app.start();

  } catch (error) {
      console.error(error);
      console.error("Caught server disconnect error. Restarting app...");
      return startApp();
  }
}

async function initDataFromSlack() {
  try {
    // Get bot id
    //const authResult = await app.client.auth.test();
    //SlackBotID = authResult.user_id;

    // get users list
    const users = await app.client.users.list();
    for (let user of users.members) {
      const name = user.name + (user.real_name ? ` (${user.real_name})` : "");
      SlackUsers.set(user.id, name);
    }

  } catch (error) {
    // Log any errors that occur
    console.error('Error during authentication test:', error);
  }
}

initDataFromSlack();
(async () => {
  await startApp();

  console.log("⚡️ Slack chat app is running at port 4000!");
})();

// This function will log the analytic data to a file
async function analyticLog(user_id, username, prompt) {
  if (!process.env.ENABLE_ANALYTICS) {
    return;
  }

  // write to ANALYTICS_FILE
  // The format will be datetime, user_id, username, prompt_length
  fs.appendFile(process.env.ANALYTICS_FILE, `${new Date().toISOString()},${user_id},${username},${prompt.length}\n`, (err) => {
    if (err) {
      console.log('Failed to write analytic:', err);
    }
  });
}

// error handling
async function errorHandler(err, say, message) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: message.ts,
    });
    console.log("Object msg:", message);
    console.log("Text msg:", message.text);
    console.log(err);
    console.error('Error:', err);
}
