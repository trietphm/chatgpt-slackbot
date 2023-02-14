import dotenv from 'dotenv-safe'
import delay from 'delay'
import { ChatGPTAPI } from 'chatgpt'

dotenv.config()

const { App } = require('@slack/bolt');

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN // add this
});

const chatAPI = new ChatGPTAPI({ apiKey: process.env.OPENAI_API_KEY });

// Save conversation id
let conversationId: string
let parentMessageId: string

// --------------------

// Listens to incoming messages that contain "hello"
app.message(async ({ message, say }) => {
  try {
    // say() sends a message to the channel where the event was triggered
    const prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, '')
    let msg = "<@" + message.user + "> You asked:\n";
    msg += ">" + message.text;

    console.log("DM: " + msg)
    res = await chatAPI.sendMessage(prompt)
    response = res.text

    console.log("Response to @" + message.user +":\n" + response)

    await say(response);
  } catch (err) {
    await say("ERROR: Something went wrong, please try again after a while.")
    console.log(err)
  }
});


// Listens to mention
app.event('app_mention', async ({ event, context, client, say }) => {
  console.log("Mention: " + event.text)
  const prompt = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, '')

  if (prompt.includes("RESET_THREAD")) {
	  // RESET THREAD
	chatAPI.resetThread()

	conversationId = ""
	parentMessageId = ""
	
  	let msg = "<@" + event.user + "> asked to Reset the thread. Started a new conversation.";

  	await say(msg);

  } else {
	  try {
		// reply
		let msg = "<@" + event.user + "> You asked:\n";
		msg += ">" + prompt + "\n";
		let response: string

		res = await chatAPI.sendMessage(prompt, {
			conversationId,
			parentMessageId
		})
		if (res.conversationId) {
		  conversationId = res.conversationId
		}

		if (res.messageId) {
		      parentMessageId = res.messageId
		}

		msg += res.text

		await say(msg);
	  } catch (err) {
		  await say("ERROR: Something went wrong, please try again after a while.")
		  console.log(err)
	  }
  }

});

(async () => {
  await app.start();

  console.log('⚡️ Bolt app is running at port 4000!');
})();
