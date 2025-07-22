# DocuChat

DocuChat is a document chat application that allows you to have conversations with your documents, powered by a serverless vector database for scalable, efficient retrieval. Upload your files and ask questions in natural language to get answers based on their content.

## Features

-   Upload and process text documents (.txt, .pdf, etc.)
-   Prevent duplicate file uploads using file hash comparison (SHA-256)
-   Client-side file hash calculation before upload for fast duplicate detection
-   Generate embeddings for document chunks
-   Flexible database options: Use a local SQLite database for quick development or a serverless Turso database for scalable, production-ready vector storage with `better-sqlite3` and `sqlite-vss`.
-   Query documents using natural language
-   Get contextual responses based on your documents' content with citations.
-   Real-time chat responses with Server-Sent Events (SSE).
-   Deep search with HyDE (Hypothetical Document Embeddings) for improved retrieval.
-   Maximal Marginal Relevance (MMR) for diverse search results.
-   Contextual chat history integration for better conversations.
-   Markdown rendering for chat responses and source citations.

## Technologies

-   Node.js
-   Express
-   `better-sqlite3` with `sqlite-vss` (for local and Turso-compatible serverless vector storage)
-   OpenAI / Ollama compatible APIs (for chat and embeddings)
-   `pdf-parse` for PDF document processing.
-   Modular OpenAI client.
-   Server-Sent Events (SSE).

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

# For remote Turso database (experimental with better-sqlite3):
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
RAG_MODEL="text-embedding-3-small"
RAG_API_KEY="your-openai-api-key"

# For Ollama (recommended for local development):
# RAG_BASE_URL="http://127.0.0.1:11434/v1"
# RAG_MODEL="mxbai-embed-large:latest"
# RAG_API_KEY="ollama" # Any value works here
# EMBEDDING_DIMENSIONS=1024 # Required for local models to set correct chunking defaults and vector dimensions in DB

# CRITICAL: If your embedding API server (OpenAI or Ollama) is offline, you MUST set this value
# or the server will not start. Common values:
# - OpenAI text-embedding-3-small: 1536
# - OpenAI text-embedding-3-large: 3072
# - Ollama mxbai-embed-large: 1024
# - Ollama nomic-embed-text: 768
# EMBEDDING_DIMENSIONS=1536

# Document Processing Configuration
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
# These values are dynamically determined based on the embedding model's dimensions
# if not explicitly set. Overriding them may be useful for fine-tuning performance.

# RAG Configuration
SIMILARITY_THRESHOLD=0.5 # Minimum score for a chunk to be included in context. (Default: 0.5)
DEEP_SEARCH_INITIAL_THRESHOLD=0.30
CONTEXT_MAX_LENGTH=4096 # Max characters for context sent to the LLM. (Default: 4096)


# Document Upload Configuration
MAX_FILE_SIZE=10485760 # 10MB
UPLOAD_DIRECTORY="./uploads"
```

## CLI Tool(debug): View Database Entries

A Python script `view_embedding.py` is provided to inspect entries in the SQLite database, including document chunks and their associated embeddings. This is particularly useful for debugging and understanding the stored data.

To use it:
1.  Ensure you have Python and `numpy` installed (`pip install numpy`).
2.  Run the script, specifying the database path and whether to view chunks or embeddings.

Example:
```bash
python view_embedding.py --database ./data.db --rowid 1
python view_embedding.py --database ./data.db --rowid 1 --embedding

```

## License

This project is licensed under the AGPL-3.0 License. See the `LICENSE` file for details.
