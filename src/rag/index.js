import { generateEmbedding } from '../embeddings/index.js';
import { searchSimilarEmbeddings } from '../db/index.js';

/**
 * Retrieve relevant document chunks based on a query
 * @param {string} query - The user's query
 * @param {number} maxResults - Maximum number of chunks to retrieve
 * @returns {Promise<Array>} - Array of relevant document chunks
 */
export async function retrieveRelevantChunks(query, maxResults = 5) {
  try {
    console.log(`Retrieving chunks relevant to query: "${query}"`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search for similar chunks in the database
    const similarChunks = await searchSimilarEmbeddings(queryEmbedding, maxResults);
    
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
  
  return sortedChunks.map((chunk, index) => {
    const similarityPercentage = (chunk.similarity * 100).toFixed(1);
    return `[Document Chunk ${index + 1} - Relevance: ${similarityPercentage}%]\n${chunk.content}\n`;
  }).join('\n');
}

export default {
  retrieveRelevantChunks,
  formatChunksForContext
}; 