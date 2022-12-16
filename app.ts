import dotenv from 'dotenv-safe'
import delay from 'delay'
import { ChatGPTAPIBrowser, ConversationResponseEvent } from 'chatgpt'

dotenv.config()

const { App } = require('@slack/bolt');

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN // add this
});

const chatAPI = new ChatGPTAPIBrowser({
    email: process.env.OPENAI_EMAIL,
    password: process.env.OPENAI_PASSWORD
  });

// Listens to incoming messages that contain "hello"
app.message(async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  const prompt = message.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, '')


  let msg = "<@" + message.user + "> You asked:\n";
  msg += ">" + message.text;

  console.log("DM: " + msg)
  const response = await chatAPI.sendMessage(prompt)
  console.log("Response to @" + message.user +":\n" + response)

  await say(response);
});

// Save conversation id
let conversationId: string
let parentMessageId: string
const onConversationResponse = (res: ConversationResponseEvent) => {
  if (res.conversation_id) {
    conversationId = res.conversation_id
  }

  if (res.message?.id) {
	parentMessageId = res.message.id
  }
}

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
	  // reply
  	let msg = "<@" + event.user + "> You asked:\n";
  	msg += ">" + prompt + "\n";

  	const response = await chatAPI.sendMessage(prompt,{
  	        conversationId,
  	        parentMessageId,
  	        onConversationResponse
  	})

	msg += response

  	await say(msg);
  }

});

(async () => {
  await chatAPI.init()
  // Start your app
  //  await chatAPI.ensureAuth()
  await app.start();

  console.log('⚡️ Bolt app is running!');
})();
