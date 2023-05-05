ChatGPT for Slack
---

Start an API service for interacting with ChatGPT on Slack.
This app uses the library at https://github.com/transitive-bullshit/chatgpt-api. Check that repo and the code in `app.ts` for more detail.

_Note: The code is ugly because I only want to make it works and too lazy to maintain_

## Setup
### Register for an OpenAI API Key
Sign up at https://platform.openai.com/overview and create a new API key in https://platform.openai.com/account/api-keys
### Setup Slack App
Check this for the guide how to create a Slack App https://slack.dev/bolt-js/tutorial/getting-started

And you need these keys for the next step
```
SLACK_SIGNING_SECRET=""
SLACK_BOT_TOKEN=""
SLACK_APP_TOKEN=""
```

In OAuth & Permission, add these scopes to Bot Token Scopes

```
app_mentions:read
channels:join
chat:write
chat:write.customize
chat:write.public
im:history
im:read
im:write
```

_Probably don't need all of them, but I'm too lazy to check, sorry_

### Setup your app
- Require nodejs >= 18 (required by above lirary)
- Create new `.env` and update the information
```
cp .env.sample .env
# Open file `.env` and filling all the keys
```
- Install
```
yarn install
```

- Start the service
```
yarn start
```

## Usage
- You can send a direct message to the Slack Bot and it will reply in a thread. Reply to the thread will follow the conversation

![image](https://user-images.githubusercontent.com/4161828/236397582-53ddcf79-12c1-4fd9-8899-9ff158d612da.png)

- Or invite it to a channel and mention it `@YourSlackBot <your question>`, you can mention it in the thread to continue the conversation

![image](https://user-images.githubusercontent.com/4161828/236398152-d11fcbbc-f2c7-4cc9-8c55-6e38f039f160.png)

