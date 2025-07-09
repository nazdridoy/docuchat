import { generateEmbedding } from '../embeddings/index.js';
import { searchSimilarEmbeddings } from '../db/index.js';
import { CONTEXT_MAX_LENGTH } from '../config.js';

/**
 * Retrieve relevant document chunks based on a query
 * @param {string} query - The user's query
 * @returns {Promise<Array>} - Array of relevant document chunks
 */
export async function retrieveRelevantChunks(query) {
  try {
    console.log(`Retrieving chunks relevant to query: "${query}"`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search for similar chunks in the database
    const similarChunks = await searchSimilarEmbeddings(queryEmbedding);
    
    // Log the results for debugging
    if (similarChunks.length === 0) {
      console.log("No relevant chunks found for the query");
    } else {
      console.log(`Retrieved ${similarChunks.length} chunks with similarities:`);
      similarChunks.forEach((chunk, i) => {
        console.log(`- Chunk ${i+1}: Similarity ${(chunk.similarity * 100).toFixed(2)}%`);
      });
    }
    
    return similarChunks;
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    throw error;
  }
}

/**
 * Format retrieved chunks for use in chat context
 * @param {Array} chunks - Array of retrieved chunks
 * @returns {string} - Formatted context string
 */
export function formatChunksForContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '';
  }
  
  // Sort chunks by similarity score (highest first)
  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  
  let context = '';
  let includedChunks = 0;
  
  for (const chunk of sortedChunks) {
    const similarityPercentage = (chunk.similarity * 100).toFixed(1);
    const chunkHeader = `[Document Chunk ${includedChunks + 1} - Relevance: ${similarityPercentage}%]\n`;
    const chunkContent = `${chunk.content}\n\n`;
    
    if (context.length + chunkHeader.length + chunkContent.length <= CONTEXT_MAX_LENGTH) {
      context += chunkHeader + chunkContent;
      includedChunks++;
    } else {
      // Stop if adding the next chunk would exceed the max length
      break;
    }
  }

  console.log(`Formatted context with ${includedChunks} chunks, length: ${context.length} chars.`);

  return context;
}

export default {
  retrieveRelevantChunks,
  formatChunksForContext
}; 