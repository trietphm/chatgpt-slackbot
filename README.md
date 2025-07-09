# Slack ChatGPT Integration - Refactored

A clean, modular Slack bot that integrates with ChatGPT and Notion for enhanced team communication.

## Architecture

The code has been refactored into a clean, modular architecture with the following structure:

```
├── app.ts                    # Original monolithic file
├── app-refactored.ts         # New refactored main application
├── config.ts                 # Centralized configuration
├── types.ts                  # TypeScript type definitions
├── services/
│   ├── openai.ts            # OpenAI API service
│   ├── notion.ts            # Notion API service
│   ├── slack.ts             # Slack API service
│   └── conversation.ts      # Conversation management
└── utils/
    ├── logger.ts            # Logging utilities
    └── analytics.ts         # Analytics utilities
```

## Key Improvements

### 1. **Separation of Concerns**
- Each service handles its own domain (OpenAI, Notion, Slack)
- Clear boundaries between different functionalities
- Easier to test and maintain individual components

### 2. **Type Safety**
- Centralized type definitions in `types.ts`
- Proper TypeScript interfaces for all data structures
- Better IDE support and error catching

### 3. **Configuration Management**
- All environment variables and constants in `config.ts`
- Type-safe configuration with proper defaults
- Easy to modify settings without touching business logic

### 4. **Error Handling**
- Consistent error handling across all services
- Proper logging with timestamps
- Graceful degradation when services fail

### 5. **Code Reusability**
- Static utility methods where appropriate
- Service classes that can be easily extended
- Clean dependency injection pattern

## Services

### OpenAIService
- Handles all ChatGPT API interactions
- Manages message creation and completion requests
- Provides static methods for creating different message types

### NotionService
- Manages Notion page fetching and markdown conversion
- Extracts page IDs from Slack messages
- Handles Notion API errors gracefully

### SlackService
- Manages Slack API interactions
- Handles user management and thread operations
- Provides utilities for message processing

### ConversationService
- Orchestrates all other services
- Manages conversation state and thread mapping
- Handles different command types (summary, thread, notion)

## Usage

### Running the Refactored Version

```bash
# Install dependencies
npm install

# Set up environment variables in .env
SLACK_BOT_TOKEN=your_bot_token
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_APP_TOKEN=your_app_token
OPENAI_API_KEY=your_openai_key
NOTION_TOKEN=your_notion_token

# Run the refactored version
npx ts-node app-refactored.ts
```

### Available Commands

1. **Direct Messages**: Send any message to the bot
2. **@mentions**: Mention the bot in any channel
3. **`summary`**: Get a summary of the current thread
4. **`thread <prompt>`**: Process the thread with a specific prompt
5. **Notion Links**: Paste a Notion page link to load its content

## Benefits of the Refactored Code

1. **Maintainability**: Each service has a single responsibility
2. **Testability**: Services can be unit tested independently
3. **Scalability**: Easy to add new features or modify existing ones
4. **Readability**: Clear, well-documented code structure
5. **Type Safety**: Full TypeScript support with proper interfaces
6. **Error Handling**: Robust error handling throughout the application

## Migration from Original

The original `app.ts` file has been preserved. To migrate to the refactored version:

1. Update your startup script to use `app-refactored.ts`
2. Ensure all environment variables are properly set
3. Test all functionality to ensure compatibility

The refactored version maintains all original functionality while providing a much cleaner and more maintainable codebase.
