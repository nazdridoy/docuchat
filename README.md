# DocuChat

A document chat application that allows you to interact with your text documents using natural language queries. This application uses RAG (Retrieval Augmented Generation) to provide relevant answers based on your documents.

## Features

- Upload and process text documents (.txt, .pdf, etc.)
- Generate embeddings for document chunks
- Store embeddings in a LibSQL database (local SQLite or remote Turso)
- Query documents using natural language
- Get contextual responses based on your documents' content

## Environment Configuration

The application requires the following environment variables:

```
# Server Configuration
PORT=3000

# Database Configuration
# For local SQLite database:
DATABASE_URL="file:./data.db"
USE_LOCAL_DB="true"

# For remote Turso database:
# DATABASE_URL="libsql://your-database.turso.io"
# DATABASE_TOKEN="your-database-token"
# USE_LOCAL_DB="false"

# OpenAI API Configuration (for chat)
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-3.5-turbo"
OPENAI_API_KEY="your-openai-api-key"

# RAG API Configuration (for embeddings)
# For OpenAI:
RAG_BASE_URL="https://api.openai.com/v1" 
RAG_MODEL="text-embedding-ada-002"
RAG_API_KEY="your-openai-api-key"

# For Ollama (recommended for local development):
# RAG_BASE_URL="http://127.0.0.1:11434/v1"
# RAG_MODEL="mxbai-embed-large:latest"
# RAG_API_KEY="ollama" # Any value works here

# Document Upload Configuration
MAX_FILE_SIZE=10485760 # 10MB
UPLOAD_DIRECTORY="./uploads"
```

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the environment variables above
   - By default, a local SQLite database will be used if no DATABASE_URL is provided
4. Start the server:
   ```
   npm start
   ```

## Using Ollama for Embeddings (Local Development)

For local development, you can use [Ollama](https://ollama.ai/) to generate embeddings without needing an OpenAI API key:

1. Install Ollama by following the instructions on the [Ollama website](https://ollama.ai/)
2. Pull an embedding model:
   ```bash
   ollama pull mxbai-embed-large # Recommended (1024 dimensions)
   # or
   ollama pull nomic-embed-text  # Accurate (768 dimensions)
   # or
   ollama pull all-minilm    # Small, fast (384 dimensions)
   ```
3. Configure your `.env` file to use Ollama's OpenAI-compatible API. For `RAG_MODEL`, specify the model name and tag:
   ```
   RAG_BASE_URL="http://127.0.0.1:11434/v1"
   RAG_MODEL="mxbai-embed-large:latest"
   RAG_API_KEY="ollama" # Any non-empty value works
   ```

## Database Options

### Local SQLite Database (default)
For development or smaller applications, you can use a local SQLite database:
```
DATABASE_URL="file:./data.db"
USE_LOCAL_DB="true"
```

### Remote Turso Database
For production or larger applications, you can use a remote Turso database:
```
DATABASE_URL="libsql://your-database.turso.io"
DATABASE_TOKEN="your-database-token"
USE_LOCAL_DB="false"
```

## API Endpoints

### Documents

- `POST /api/documents` - Upload a document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:id` - Delete a document

### Chat

- `POST /api/chat` - Send a message and get a response based on your documents

## Technologies

- Node.js
- Express
- LibSQL (for vector storage)
- OpenAI / Ollama compatible APIs (for chat and embeddings) 