# Knowledge Base System

A comprehensive knowledge base system that uses OpenAI embeddings and pgvector for semantic search, integrated with your Slack ChatGPT bot.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Markdown      │    │   OpenAI        │    │   pgvector      │
│   Files         │───▶│   Embeddings    │───▶│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Knowledge     │    │   Slack Bot     │
                       │   API Server    │    │   Integration   │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Setup Database

First, you need a PostgreSQL database with pgvector extension:

```sql
-- Install pgvector extension
CREATE EXTENSION vector;

-- Create database (if not exists)
CREATE DATABASE knowledge_base;
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=knowledge_base
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# Knowledge Base Configuration
KB_FOLDER_PATH=./knowledge
KB_CHUNK_SIZE=1000
KB_CHUNK_OVERLAP=200
KB_SEARCH_LIMIT=5
KB_SIMILARITY_THRESHOLD=0.7

# API Configuration
API_PORT=3000
```

### 3. Install Dependencies

```bash
yarn install
```

### 4. Process Knowledge Files

```bash
# Process all markdown files in the knowledge folder
yarn process-knowledge
```

### 5. Start the API Server

```bash
# Start the knowledge base API server
yarn start:api
```

### 6. Start the Slack Bot

```bash
# Start the Slack bot with knowledge base integration
yarn start
```

## 📁 File Structure

```
├── knowledge/                 # Knowledge base folder
│   ├── README.md             # Documentation
│   ├── company-policy.md     # Company policies
│   └── technical-docs.md     # Technical documentation
├── services/
│   ├── database.ts           # pgvector database operations
│   ├── embeddings.ts         # OpenAI embeddings service
│   ├── knowledge-base.ts     # Knowledge base processing
│   └── conversation.ts       # Updated with KB integration
├── api/
│   └── knowledge-api.ts      # REST API server
├── scripts/
│   └── process-knowledge.ts  # Standalone processing script
└── api-server.ts             # API server startup
```

## 🔧 API Endpoints

### Health Check
```bash
GET http://localhost:3000/health
```

### Process Knowledge Folder
```bash
POST http://localhost:3000/api/knowledge/process
```

### Get Statistics
```bash
GET http://localhost:3000/api/knowledge/stats
```

### Search Knowledge Base
```bash
POST http://localhost:3000/api/knowledge/search
Content-Type: application/json

{
  "query": "What is the company policy on remote work?"
}
```

### Process Specific File
```bash
POST http://localhost:3000/api/knowledge/process-file
Content-Type: application/json

{
  "filePath": "./knowledge/company-policy.md"
}
```

## 🤖 How It Works

### 1. Document Processing
- **Chunking**: Documents are split into smaller chunks (default: 1000 chars)
- **Overlap**: Chunks overlap to maintain context (default: 200 chars)
- **Embeddings**: Each chunk is converted to OpenAI embeddings
- **Storage**: Chunks and embeddings stored in pgvector database

### 2. Question Answering
- **Query Embedding**: User question is converted to embedding
- **Similarity Search**: pgvector finds most similar chunks
- **Context Retrieval**: Relevant chunks are retrieved with similarity scores
- **AI Response**: ChatGPT answers using retrieved context

### 3. Source Citation
- **Filename Tracking**: Each chunk retains its source filename
- **Similarity Scores**: Shows confidence level of retrieved information
- **Transparent Sources**: Bot cites sources in responses

## 📊 Configuration

### Chunking Settings
```typescript
KB_CHUNK_SIZE=1000        // Characters per chunk
KB_CHUNK_OVERLAP=200      // Overlap between chunks
```

### Search Settings
```typescript
KB_SEARCH_LIMIT=5         // Number of results to return
KB_SIMILARITY_THRESHOLD=0.7  // Minimum similarity score (0-1)
```

### Database Settings
```typescript
DB_HOST=localhost         // PostgreSQL host
DB_PORT=5432             // PostgreSQL port
DB_NAME=knowledge_base   // Database name
```

## 🔍 Usage Examples

### Adding New Knowledge
1. Add markdown files to `./knowledge/` folder
2. Run `yarn process-knowledge` or use API
3. Bot automatically uses new knowledge

### Asking Questions
```
User: "What is our remote work policy?"
Bot: "Based on our company policy document, remote work is allowed up to 3 days per week..."
```

### Source Citation
```
Bot: "According to company-policy.md (similarity: 95.2%), employees can work remotely..."
```

## 🛠️ Development

### Adding New File Types
Extend `isMarkdownFile()` in `KnowledgeBaseService`:

```typescript
private isMarkdownFile(filename: string): boolean {
  const extensions = ['.md', '.markdown', '.mdown', '.txt'];
  const ext = path.extname(filename).toLowerCase();
  return extensions.includes(ext);
}
```

### Custom Embedding Models
Update `CONFIG.OPENAI.EMBEDDING_MODEL` in `config.ts`:

```typescript
EMBEDDING_MODEL: 'text-embedding-3-large',  // or other models
```

### Database Schema
The system creates this table automatically:

```sql
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## 🚨 Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running
- Verify connection credentials in `.env`
- Ensure pgvector extension is installed

### Embedding API Errors
- Verify OpenAI API key is valid
- Check API rate limits
- Ensure embedding model is available

### Processing Errors
- Check file permissions on knowledge folder
- Verify markdown files are valid UTF-8
- Check console logs for specific errors

## 📈 Performance Tips

1. **Chunk Size**: Smaller chunks (500-1000 chars) for precise answers
2. **Overlap**: 10-20% overlap maintains context
3. **Search Limit**: 3-5 results usually sufficient
4. **Similarity Threshold**: 0.7-0.8 for high-quality matches

## 🔒 Security Considerations

- Database credentials in environment variables
- API endpoints for internal use only
- Embedding API calls logged for monitoring
- File content validated before processing 