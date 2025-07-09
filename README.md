# DocuChat

DocuChat is a document chat application that allows you to have conversations with your documents, powered by a serverless vector database for scalable, efficient retrieval. Upload your files and ask questions in natural language to get answers based on their content.

## Features

-   Upload and process text documents (.txt, .pdf, etc.)
-   Generate embeddings for document chunks
-   Flexible database options: Use a local SQLite database for quick development or a serverless Turso database for scalable, production-ready vector storage.
-   Query documents using natural language
-   Get contextual responses based on your documents' content

## Technologies

-   Node.js
-   Express
-   Turso / LibSQL (for serverless vector storage)
-   OpenAI / Ollama compatible APIs (for chat and embeddings)

## Prerequisites

-   Node.js
-   npm
-   Git
-   Optionally, [Ollama](https://ollama.ai/) for local embeddings.

## Installation

1.  Clone this repository:
    ```bash
    git clone https://github.com/your-username/docuchat.git
    cd docuchat
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `.env` file in the root directory and populate it with the necessary environment variables as described in the **Configuration** section.

## Configuration

The application is configured through environment variables.

### Environment Variables

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
# EMBEDDING_DIMENSIONS=1024

# Document Processing Configuration
# CHUNK_SIZE=1000
# CHUNK_OVERLAP=200
#
# These values are dynamically determined based on the embedding model's dimensions
# if not explicitly set. Overriding them may be useful for fine-tuning performance.

# RAG Configuration
# SIMILARITY_THRESHOLD=0.5
# CONTEXT_MAX_LENGTH=4096
#
# SIMILARITY_THRESHOLD: Minimum score for a chunk to be included in context. (Default: 0.5)
# CONTEXT_MAX_LENGTH: Max characters for context sent to the LLM. (Default: 4096)

# Document Upload Configuration
MAX_FILE_SIZE=10485760 # 10MB
UPLOAD_DIRECTORY="./uploads"
``