import dotenv from "dotenv-safe";
import delay from "delay";
import { ChatGPTAPI } from "chatgpt";

dotenv.config();

const { App } = require("@slack/bolt");
const WAITING_REACTION_EMOJI = "eyes";
const REPLIED_REACTION_EMOJI = "white_check_mark";

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN, // add this
});

const chatAPI = new ChatGPTAPI({ apiKey: process.env.OPENAI_API_KEY });

// Save conversation id
let conversationId: string;
let parentMessageId: string;

// --------------------

// Listens to incoming messages
app.message(async ({ message, say, client, logger }) => {
  try {
    // say() sends a message to the channel where the event was triggered
    const prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");
    let msg = "<@" + message.user + "> You asked:\n";
    msg += ">" + message.text;

    // Add a reaction so we know the ChatGPT is replying
    await client.reactions.add({
      channel: message.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: message.ts,
    });

    console.log("DM: " + msg);

    res = await chatAPI.sendMessage(prompt);
    response = res.text;

    console.log("Response to @" + message.user + ":\n" + response);

    await say(response);

    // Remove the waiting reaction emoji after response
    await client.reactions.remove({
      channel: message.channel,
      name: WAITING_REACTION_EMOJI,
      timestamp: message.ts,
    });
    // Mark the question as done
    await client.reactions.add({
      channel: message.channel,
      name: REPLIED_REACTION_EMOJI,
      timestamp: message.ts,
    });
  } catch (err) {
    await say("ERROR: Something went wrong, please try again after a while.");
    console.log(err);
  }
});

// Listens to mention
app.event("app_mention", async ({ event, context, client, say }) => {
  console.log("Mention: " + event.text);
  const prompt = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");

  if (prompt.includes("RESET_THREAD")) {
    // RESET THREAD
    chatAPI.resetThread();

    conversationId = "";
    parentMessageId = "";

    let msg =
      "<@" +
      event.user +
      "> asked to Reset the thread. Started a new conversation.";

    await say(msg);
  } else {
    try {
      // reply
      let msg = "<@" + event.user + "> You asked:\n";
      msg += ">" + prompt + "\n";
      let response: string;

      // Add a reaction so we know the ChatGPT is replying
      await client.reactions.add({
        channel: event.channel,
        name: WAITING_REACTION_EMOJI,
        timestamp: event.ts,
      });

      res = await chatAPI.sendMessage(prompt, {
        conversationId,
        parentMessageId,
      });
      if (res.conversationId) {
        conversationId = res.conversationId;
      }

      if (res.messageId) {
        parentMessageId = res.messageId;
      }

      msg += res.text;

      await say(msg);
      // Remove the waiting reaction emoji after response
      await client.reactions.remove({
        channel: event.channel,
        name: WAITING_REACTION_EMOJI,
        timestamp: event.ts,
      });

      // Mark the question as done
      await client.reactions.add({
        channel: event.channel,
        name: REPLIED_REACTION_EMOJI,
        timestamp: event.ts,
      });
    } catch (err) {
      await say("ERROR: Something went wrong, please try again after a while.");
      console.log(err);
    }
  }
});

(async () => {
  await app.start();

  console.log("⚡️ Slack chat app is running at port 4000!");
})();
