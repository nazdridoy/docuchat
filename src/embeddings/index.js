import OpenAI from 'openai';
import { RAG_BASE_URL, RAG_MODEL, RAG_API_KEY, EMBEDDING_MAX_RETRIES, EMBEDDING_RETRY_DELAY } from '../config.js';

const openai = new OpenAI({
  apiKey: RAG_API_KEY,
  baseURL: RAG_BASE_URL,
});

async function createEmbedding(model, input) {
  const response = await openai.embeddings.create({
    model: model,
    input: input,
    encoding_format: 'float',
  });
  return response;
}

/**
 * Check if the embedding API is available
 * @returns {Promise<boolean>} - True if the API is available, false otherwise
 */
export async function checkEmbeddingApiAvailability() {
  const model = RAG_MODEL;
  const maxRetries = EMBEDDING_MAX_RETRIES;
  const retryDelay = EMBEDDING_RETRY_DELAY;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      console.log(`Checking embedding API availability with model: ${model} from ${RAG_BASE_URL}`);
      const data = await createEmbedding(model, 'test');
      
      const embedding = data.data[0].embedding;
      if (!embedding || embedding.length === 0) {
        console.error('API returned empty embedding data');
        return false;
      }

      console.log(`Successfully connected to embedding API. Model dimensions: ${embedding.length}`);
      return true;
    } catch (error) {
      // Check if it's a rate limit error (429)
      if (error.status === 429 || error.code === 429) {
        retries++;
        if (retries <= maxRetries) {
          console.log(`Rate limit exceeded. Waiting ${retryDelay/1000} seconds before retry ${retries}/${maxRetries}...`);
          await sleep(retryDelay);
          continue;
        }
      }
      
      // Only log a simplified error message
      if (error.cause?.code === 'ECONNREFUSED' || 
          error.message?.includes('Connection error') || 
          error.cause?.code === 'ENOTFOUND' || 
          error.cause?.code === 'ETIMEDOUT') {
        console.error(`Error connecting to embedding API at ${RAG_BASE_URL}`);
      } else {
        console.error(`Error checking embedding API: ${error.message}`);
      }
      return false;
    }
  }
  return false;
}

/**
 * Generate embeddings for text content using a direct fetch call.
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<number[]>} - The embedding vector
 */
export async function generateEmbedding(text) {
  const model = RAG_MODEL;
  const maxRetries = EMBEDDING_MAX_RETRIES;
  const retryDelay = EMBEDDING_RETRY_DELAY;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      console.log(`Generating embedding with model: ${model} from ${RAG_BASE_URL}`);
      const data = await createEmbedding(model, text);
      
      const embedding = data.data[0].embedding;

      if (!embedding || embedding.length === 0) {
        throw new Error('API returned empty embedding data');
      }

      const sum = embedding.reduce((acc, val) => acc + Math.abs(val), 0);
      if (sum === 0) {
        throw new Error('API returned an embedding with all zero values.');
      }

      console.log(`Successfully generated embedding with dimensions: ${embedding.length}`);
      return embedding;
    } catch (error) {
      // Check if it's a rate limit error (429)
      if (error.status === 429 || error.code === 429) {
        retries++;
        if (retries <= maxRetries) {
          console.log(`Rate limit exceeded. Waiting ${retryDelay/1000} seconds before retry ${retries}/${maxRetries}...`);
          await sleep(retryDelay);
          continue;
        }
      }
      
      // Only log the error message without the full stack trace
      if (error.cause?.code === 'ECONNREFUSED' || 
          error.message?.includes('Connection error') || 
          error.cause?.code === 'ENOTFOUND' || 
          error.cause?.code === 'ETIMEDOUT') {
        console.error(`Error connecting to embedding API at ${RAG_BASE_URL}`);
      } else {
        console.error(`Error generating embedding with model ${model}: ${error.message}`);
      }
      
      // Check for connection-related errors
      if (
        error.message?.includes('Connection error') ||
        error.cause?.code === 'ECONNREFUSED' ||
        error.cause?.code === 'ENOTFOUND' ||
        error.cause?.code === 'ETIMEDOUT'
      ) {
        throw new Error(`Failed to connect to embedding API server at ${RAG_BASE_URL}. Set EMBEDDING_DIMENSIONS in your .env file to start the server when the API is unavailable.`);
      }
      
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate embeddings for multiple texts in batches.
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @param {number} batchSize - Number of texts to process in each batch
 * @returns {Promise<Array<number[]>>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts, batchSize = 20) {
  const model = RAG_MODEL;
  const embeddings = [];
  const maxRetries = EMBEDDING_MAX_RETRIES;
  const retryDelay = EMBEDDING_RETRY_DELAY;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let retries = 0;
    let success = false;
    
    while (!success && retries <= maxRetries) {
      try {
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(texts.length / batchSize)} with ${batch.length} items.`);
        
        const data = await createEmbedding(model, batch);

        const batchEmbeddings = data.data.map(item => {
          if (!item.embedding || item.embedding.reduce((a, b) => a + Math.abs(b), 0) === 0) {
            throw new Error('Invalid embedding returned in batch');
          }
          return item.embedding;
        });
        
        embeddings.push(...batchEmbeddings);
        success = true;
        
      } catch (error) {
        // Check if it's a rate limit error (429)
        if (error.status === 429 || error.code === 429) {
          retries++;
          if (retries <= maxRetries) {
            console.log(`Rate limit exceeded. Waiting ${retryDelay/1000} seconds before retry ${retries}/${maxRetries}...`);
            await sleep(retryDelay);
            continue;
          }
        }
        
        console.error(`Error processing batch with model ${model}:`, error);
        throw new Error(`Failed to generate embeddings batch: ${error.message}`);
      }
    }
  }
  
  return embeddings;
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  checkEmbeddingApiAvailability,
}; 