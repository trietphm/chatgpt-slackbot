import dotenv from "dotenv-safe";
import OpenAI from "openai";
import slackifyMarkdown from "slackify-markdown";

const { App } = require("@slack/bolt");
const { Client } = require("@notionhq/client")
const { NotionToMarkdown } = require("notion-to-md");
const WAITING_REACTION_EMOJI = "eyes";

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
    model: 'gpt-4o',
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


// --------------------
// Handle Slack Events
// --------------------

// Save all the conversations so we can send this to openai again
// Map<slack_thread_id, ChatMessage[]>
let threadMap: Map<string, ChatMessage[]> = new Map();

// Listens to incoming direct messages
app.message(async ({ message, say, client, logger }) => {
  try {
    let prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");
    // Get the conversation for the thread
    const threadId = message.thread_ts || message.event_ts;

    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, message.channel, message.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    // Check if the message is a Notion page link
    const notionPageId = getNotionPageId(prompt);
    if (notionPageId != "") {
      // Read the notion page content and reply to the slack thread
      await readNotionPageAndReplySlack(notionPageId, threadId, message.ts, say);

      // Remove the waiting reaction emoji after response
      return removeWaitingEmoji(client, message.channel, message.ts);
    }

    if (prompt.trim().toLowerCase() == "summary") {
      const SlackThreadMessages = await fetchMessagesFromSlackThread(client, message.thread_ts, message.channel);
      prompt = "Please provide a summary of the following conversation:\n\n" + SlackThreadMessages
    }

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

    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, message.channel, message.ts)
  } catch (err) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: message.ts,
    });
    console.log("Object msg:", message);
    console.log("Text msg:", message.text);
    console.log(err);
  }
});

// Listens to mention
app.event("app_mention", async ({ event, context, client, say }) => {
  console.log("Mention: " + event.text);
  let prompt = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");
  try {
    // Get the conversation for the thread
    const threadId = event.thread_ts || event.event_ts;

    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, event.channel, event.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    // Check if the message is a Notion page link
    const notionPageId = getNotionPageId(prompt);
    if (notionPageId != "") {
      // Read the notion page content and reply to the slack thread
      await readNotionPageAndReplySlack(notionPageId, threadId, event.ts, say);

      // Remove the waiting reaction emoji after response
      return removeWaitingEmoji(client, event.channel, event.ts);
    }

    if (prompt.trim().toLowerCase() == "summary") {
      const SlackThreadMessages = await fetchMessagesFromSlackThread(client, event.thread_ts, event.channel);
      prompt = "Please provide a summary of the following conversation:\n\n" + SlackThreadMessages
    }

    let conversations = threadMap.get(threadId) || [];

    // Add the user message to the conversation
    conversations.push(newUserMessage(prompt));

    // Send the conversation to OpenAI
    let response = await askChatCompletion(conversations);
    if (!response) {
      await say({
        text: "ERROR: Something went wrong, please try again after a while.",
        thread_ts:event.ts,
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
      thread_ts:event.ts,
    });



    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, event.channel, event.ts)
  } catch (err) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: event.ts,
    });
    console.log("Object event:", event);
    console.log("Text event:", event.text);

    console.log(err);
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
