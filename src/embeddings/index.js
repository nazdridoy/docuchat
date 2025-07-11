import OpenAI from 'openai';
import { RAG_BASE_URL, RAG_MODEL, RAG_API_KEY } from '../config.js';

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
 * Generate embeddings for text content using a direct fetch call.
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<number[]>} - The embedding vector
 */
export async function generateEmbedding(text) {
  const model = RAG_MODEL;
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
    console.error(`Error generating embedding with model ${model}:`, error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batches.
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @param {number} batchSize - Number of texts to process in each batch
 * @returns {Promise<Array<number[]>>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts, batchSize = 20) {
  const model = RAG_MODEL;
  const embeddings = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
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
      
    } catch (error) {
      console.error(`Error processing batch with model ${model}:`, error);
      throw new Error(`Failed to generate embeddings batch: ${error.message}`);
    }
  }
  
  return embeddings;
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
}; 