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

# Document Upload Configuration
MAX_FILE_SIZE=10485760 # 10MB
UPLOAD_DIRECTORY="./uploads"
```

### Database Options

#### Local SQLite Database

By default, DocuChat uses a local SQLite database for easy setup and development. This is ideal for testing or small-scale use.

```
DATABASE_URL="file:./data.db"
USE_LOCAL_DB="true"
```

#### Serverless Vector Database with Turso

For production or scalable applications, DocuChat supports Turso, a serverless database built on LibSQL. This allows you to handle large-scale vector storage without managing server infrastructure.

```
DATABASE_URL="libsql://your-database.turso.io"
DATABASE_TOKEN="your-database-token"
USE_LOCAL_DB="false"
```

### Using Ollama for Embeddings

For local development, you can use [Ollama](https://ollama.ai/) to generate embeddings without needing an OpenAI API key:

1.  Install Ollama by following the instructions on the [Ollama website](https://ollama.ai/)
2.  Pull an embedding model:
    ```bash
    ollama pull mxbai-embed-large # Recommended (1024 dimensions)
    # or
    ollama pull nomic-embed-text  # Accurate (768 dimensions)
    # or
    ollama pull all-minilm    # Small, fast (384 dimensions)
    ```
3.  Configure your `.env` file to use Ollama's OpenAI-compatible API. For `RAG_MODEL`, specify the model name and tag:
    ```
    RAG_BASE_URL="http://127.0.0.1:11434/v1"
    RAG_MODEL="mxbai-embed-large:latest"
    RAG_API_KEY="ollama" # Any non-empty value works
    ```

## Usage

Once the application is installed and configured, you can start the server:

```bash
npm start
```

### API Endpoints

#### Documents

-   `POST /api/documents` - Upload a document
-   `GET /api/documents` - List all documents
-   `DELETE /api/documents/:id` - Delete a document

#### Chat

-   `POST /api/chat` - Send a message and get a response based on your documents

## Privacy First

Your privacy is a top priority. For full control over your data, you can run DocuChat in a completely self-hosted environment. By using the default local SQLite database and generating embeddings with a local Ollama model, you can ensure that your documents and conversation history never leave your machine. This setup allows you to use the application's full power without relying on third-party services for data processing.

## Contributing

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.