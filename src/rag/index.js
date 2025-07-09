import { generateEmbedding } from '../embeddings/index.js';
import { searchSimilarEmbeddings } from '../db/index.js';
import { CONTEXT_MAX_LENGTH, OPENAI_MODEL } from '../config.js';
import openai from '../openai.js';

/**
 * Generates a hypothetical document for a given query using the LLM.
 * @param {string} query - The user's query.
 * @param {Array} history - The chat history.
 * @returns {Promise<string>} The generated hypothetical document.
 */
async function generateHypotheticalDocument(query, history = []) {
  const messages = [
    ...history,
    {
      role: 'user',
      content: query,
    },
    {
      role: 'system',
      content: 'Please generate a comprehensive and detailed answer to the user query. This answer will be used to find relevant documents, so it should be as complete as possible. Do not include any preambles or disclaimers, just the answer.',
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating hypothetical document:', error);
    // Fallback to query if generation fails
    return query;
  }
}

/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} vecA - The first vector.
 * @param {number[]} vecB - The second vector.
 * @returns {number} The cosine similarity between the two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Re-ranks a list of chunks using Maximal Marginal Relevance (MMR).
 * @param {number[]} queryEmbedding - The embedding of the query.
 * @param {Array<object>} chunks - A list of chunks, each with an `embedding` property.
 * @param {number} lambda - The hyperparameter that balances relevance and diversity (0 to 1).
 * @param {number} k - The number of chunks to return.
 * @returns {Array<object>} A re-ranked list of chunks.
 */
function maximalMarginalRelevance(queryEmbedding, chunks, lambda = 0.5, k = 10) {
    if (chunks.length === 0) {
        return [];
    }

    const rankedChunks = chunks.map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    const selectedChunks = [];
    const remainingChunks = [...rankedChunks];

    // Add the most similar chunk to start
    remainingChunks.sort((a, b) => b.similarity - a.similarity);
    const firstChunk = remainingChunks.shift();
    selectedChunks.push(firstChunk);

    while (selectedChunks.length < k && remainingChunks.length > 0) {
        let bestScore = -Infinity;
        let bestChunkIndex = -1;

        for (let i = 0; i < remainingChunks.length; i++) {
            const chunk = remainingChunks[i];
            const relevance = chunk.similarity;
            
            const maxDiversity = Math.max(
                ...selectedChunks.map(selected =>
                    cosineSimilarity(chunk.embedding, selected.embedding)
                )
            );
            
            const score = lambda * relevance - (1 - lambda) * maxDiversity;

            if (score > bestScore) {
                bestScore = score;
                bestChunkIndex = i;
            }
        }

        if (bestChunkIndex !== -1) {
            selectedChunks.push(remainingChunks.splice(bestChunkIndex, 1)[0]);
        } else {
            // No more chunks to select
            break;
        }
    }

    return selectedChunks;
}


/**
 * Retrieve relevant document chunks based on a query
 * @param {string} query - The user's query
 * @param {Array} history - The chat history.
 * @returns {Promise<Array>} - Array of relevant document chunks
 */
export async function retrieveRelevantChunks(query, history = []) {
  try {
    console.log(`Retrieving chunks relevant to query: "${query}"`);

    // Generate embedding for the original query for MMR relevance
    const queryEmbedding = await generateEmbedding(query);

    // Generate a hypothetical document for retrieval
    const hypotheticalDocument = await generateHypotheticalDocument(query, history);

    // Generate embedding for the hypothetical document for search
    const searchEmbedding = await generateEmbedding(hypotheticalDocument);

    // Search for a larger number of similar chunks in the database using the search embedding
    const similarChunks = await searchSimilarEmbeddings(searchEmbedding, 50);

    // Re-rank chunks using MMR with the original query embedding
    const rerankedChunks = maximalMarginalRelevance(queryEmbedding, similarChunks);

    // Log the results for debugging
    if (rerankedChunks.length === 0) {
      console.log('No relevant chunks found for the query');
    } else {
      console.log(`Retrieved and re-ranked ${rerankedChunks.length} chunks with MMR:`);
      rerankedChunks.forEach((chunk, i) => {
        console.log(`- Chunk ${i + 1}: Similarity ${(chunk.similarity * 100).toFixed(2)}%`);
      });
    }

    return rerankedChunks;
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