import dotenv from "dotenv-safe";
import delay from "delay";
import { ChatGPTAPI } from "chatgpt";

dotenv.config();

const { App } = require("@slack/bolt");
const WAITING_REACTION_EMOJI = "eyes";

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN, // add this
});

const chatAPI = new ChatGPTAPI({ apiKey: process.env.OPENAI_API_KEY });

// Save conversation id
let parentMessageId: string;
let threadMap: Map<string, string> = new Map();

// --------------------

// Listens to incoming direct messages
app.message(async ({ message, say, client, logger }) => {
  try {
    // say() sends a message to the channel where the event was triggered
    const prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");

    // Add a reaction so we know the ChatGPT is replying
    await client.reactions.add({
      channel: message.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: message.ts,
    });

    console.log("DM: " + prompt);

    const parentMessageId = threadMap.get(message.thread_ts);
    res = await chatAPI.sendMessage(prompt, {
	    parentMessageId,
    });

    response = res.text;

    if (res.id) {
      threadMap.set(message.thread_ts, res.id);
    }

    await say({
      text: response,
      thread_ts: message.ts,
    });

    // Remove the waiting reaction emoji after response
    await client.reactions.remove({
      channel: message.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: message.ts,
    });
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
    await client.reactions.add({
      channel: event.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: event.ts,
    });

    const parentMessageId = threadMap.get(event.thread_ts);
    res = await chatAPI.sendMessage(prompt, {
	    parentMessageId,
    });

    if (res.id) {
      threadMap.set(event.thread_ts, res.id);
    }


    await say({
      text: res.text,
      thread_ts: event.ts,
    });
    // Remove the waiting reaction emoji after response
    await client.reactions.remove({
      channel: event.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: event.ts,
    });
  } catch (err) {
    await say({
      text: "ERROR: Something went wrong, please try again after a while.",
      thread_ts: event.ts,
    });
    console.log(err);
  }
});

(async () => {
  await app.start();

  console.log("⚡️ Slack chat app is running at port 4000!");
})();
