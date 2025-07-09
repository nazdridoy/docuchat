import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Try to load .env file
const envPath = join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Server configuration
export const PORT = process.env.PORT || 3000;

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL || `file:${join(rootDir, 'data.db')}`;
export const DATABASE_TOKEN = process.env.DATABASE_TOKEN || '';
export const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true' || !DATABASE_URL.startsWith('libsql://');

// OpenAI API configuration (for chat)
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// RAG API configuration (for embeddings)
export const RAG_BASE_URL = process.env.RAG_BASE_URL || 'https://api.openai.com/v1';
export const RAG_MODEL = process.env.RAG_MODEL || 'text-embedding-ada-002';
export const RAG_API_KEY = process.env.RAG_API_KEY || process.env.OPENAI_API_KEY;

// Embedding configuration
export const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS;

// Document upload configuration
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
export const UPLOAD_DIRECTORY = process.env.UPLOAD_DIRECTORY || join(rootDir, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIRECTORY)) {
  fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
}

// Ensure data directory exists for local DB
if (USE_LOCAL_DB) {
  const dataDir = dirname(DATABASE_URL.replace('file:', ''));
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} 