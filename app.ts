import dotenv from "dotenv-safe";
import OpenAI from "openai";
import { ChatGPTAPI } from "chatgpt";

const { App } = require("@slack/bolt");
const WAITING_REACTION_EMOJI = "eyes";

dotenv.config();
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

enum Role {
  user,
  assistant
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


// Save all the conversations so we can send this to openai again
// Map<slack_thread_id, ChatMessage[]>
let threadMap: Map<string, ChatMessage[]> = new Map();

// --------------------

// Listens to incoming direct messages
app.message(async ({ message, say, client, logger }) => {
  try {
    // say() sends a message to the channel where the event was triggered
    const prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");

    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, message.channel, message.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    // Get the conversation for the thread
    const threadId = message.thread_ts || message.event_ts;
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
      text: response,
      thread_ts: message.ts,
    });

    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, message.channel, message.ts)
  } catch (err) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: message.ts,
    });
    console.log(err);
  }
});

// Listens to mention
app.event("app_mention", async ({ event, context, client, say }) => {
  console.log("Mention: " + event.text);
  const prompt = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");
  try {

    // Add a reaction so we know the ChatGPT is replying
    await reactWaitingEmoji(client, event.channel, event.ts);
    logWithTimestamp(`Sent message: ${prompt}`);

    // Get the conversation for the thread
    const threadId = event.thread_ts || event.event_ts;
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
      text: response,
      thread_ts:event.ts,
    });



    // Remove the waiting reaction emoji after response
    await removeWaitingEmoji(client, event.channel, event.ts)
  } catch (err) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: event.ts,
    });
    console.log(err);
  }
});

const startApp = async () => {
  try {
    await app.start();
  } catch (error) {
      console.error(error);
      console.error("Caught server disconnect error. Restarting app...");
      return startApp();
  }
}


(async () => {
  await startApp();

  console.log("⚡️ Slack chat app is running at port 4000!");
})();
