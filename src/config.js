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
export let CHUNK_SIZE = process.env.CHUNK_SIZE
  ? parseInt(process.env.CHUNK_SIZE)
  : null;
export let CHUNK_OVERLAP = process.env.CHUNK_OVERLAP
  ? parseInt(process.env.CHUNK_OVERLAP)
  : null;

export function setChunkingDefaults(dimensions) {
  if (CHUNK_SIZE === null) {
    if (dimensions >= 1024) {
      CHUNK_SIZE = 1000;
    } else if (dimensions >= 768) {
      CHUNK_SIZE = 768;
    } else if (dimensions >= 512) {
      CHUNK_SIZE = 512;
    } else {
      CHUNK_SIZE = 384;
    }
    console.log(
      `CHUNK_SIZE not set, dynamically setting to ${CHUNK_SIZE} based on embedding dimensions (${dimensions}).`
    );
  }

  if (CHUNK_OVERLAP === null) {
    CHUNK_OVERLAP = Math.round(CHUNK_SIZE * 0.2);
    console.log(
      `CHUNK_OVERLAP not set, dynamically setting to ${CHUNK_OVERLAP}.`
    );
  }
}

// RAG configuration
export const SIMILARITY_THRESHOLD = process.env.SIMILARITY_THRESHOLD
  ? parseFloat(process.env.SIMILARITY_THRESHOLD)
  : 0.5;
export const CONTEXT_MAX_LENGTH = process.env.CONTEXT_MAX_LENGTH
  ? parseInt(process.env.CONTEXT_MAX_LENGTH)
  : 4096;

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