import { generateEmbedding } from '../embeddings/index.js';
import { searchSimilarEmbeddings } from '../db/index.js';
import { 
    CONTEXT_MAX_LENGTH, 
    OPENAI_MODEL,
    DEEP_SEARCH_ENABLED,
    DEEP_SEARCH_INITIAL_THRESHOLD,
    DATABASE_URL
} from '../config.js';
import openai from '../openai.js';
import Database from 'better-sqlite3';

/**
 * Generates a hypothetical document for a given query using the LLM.
 * @param {string} query - The user's query.
 * @param {Array} history - The chat history.
 * @param {string|null} context - Optional context from a preliminary search.
 * @param {function} onProgress - Callback for progress updates.
 * @returns {Promise<string>} The generated hypothetical document.
 */
async function generateHypotheticalDocument(query, history = [], context = null, onProgress = () => {}) {
  const isContextAware = !!context;
  const hydeType = isContextAware ? 'Context-Aware' : 'Standard';
  
  const systemPrompt = context
    ? `Based on the following context, please generate a comprehensive and detailed answer to the user query. This answer will be used to find more relevant documents, so it should be grounded in the provided information while expanding on the query. Do not include any preambles or disclaimers, just the answer.

Context:
${context}`
    : 'Please generate a comprehensive and detailed answer to the user query. This answer will be used to find relevant documents, so it should be as complete as possible. Do not include any preambles or disclaimers, just the answer.';

  const messages = [
    ...history,
    {
      role: 'user',
      content: query,
    },
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  try {
    const progressMessage = `Generating ${hydeType} hypothetical answer...`;
    onProgress({ message: progressMessage });
    console.log(`[RAG-HyDE] ${progressMessage}`);
    
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });
    const doc = response.choices[0].message.content;
    console.log(`[RAG-HyDE] ${hydeType} hypothetical document generated successfully.`);
    return doc;
  } catch (error) {
    console.error(`[RAG-HyDE] Error generating ${hydeType} hypothetical document:`, error);
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
 * @param {boolean} useDeepSearch - Whether to use deep search mode.
 * @param {function} onProgress - Callback for progress updates.
 * @returns {Promise<Array>} - Array of relevant document chunks
 */
export async function retrieveRelevantChunks(query, history = [], useDeepSearch = DEEP_SEARCH_ENABLED, onProgress = () => {}) {
  try {
    onProgress({ message: 'Starting retrieval...' });
    console.log(`[RAG] Starting retrieval for query: "${query}"`);
    console.log(`[RAG] Search mode: ${useDeepSearch ? 'Deep Search' : 'Standard'}`);

    // Generate embedding for the original query for MMR relevance scoring later
    const queryEmbedding = await generateEmbedding(query);

    let searchEmbedding = queryEmbedding;
    let contextForHyDE = null;

    if (useDeepSearch) {
        onProgress({ message: 'Performing initial search...' });
        console.log(`[RAG-DeepSearch] Stage 1: Performing initial retrieval with threshold ${DEEP_SEARCH_INITIAL_THRESHOLD}...`);
        const initialChunks = await searchSimilarEmbeddings(
            queryEmbedding, 
            20, 
            DEEP_SEARCH_INITIAL_THRESHOLD
        );

        if (initialChunks.length > 0) {
            console.log(`[RAG-DeepSearch] Stage 1: Found ${initialChunks.length} initial chunks.`);
            onProgress({ message: 'Generating context-aware answer...' });
            console.log(`[RAG-DeepSearch] Stage 2: Generating context-aware HyDE...`);
            contextForHyDE = formatChunksForContext(initialChunks);
        } else {
            console.log('[RAG-DeepSearch] Stage 1: No initial chunks found above threshold. Proceeding with standard HyDE for search.');
        }
    } else {
        console.log('[RAG-StandardSearch] Using standard HyDE for search.');
    }

    // Generate a hypothetical document for retrieval (potentially with context)
    const hypotheticalDocument = await generateHypotheticalDocument(query, history, contextForHyDE, onProgress);
    
    // If the hypothetical document is different from the original query, generate a new search embedding
    if (hypotheticalDocument !== query) {
        console.log('[RAG] Using new hypothetical document embedding for search.');
        searchEmbedding = await generateEmbedding(hypotheticalDocument);
    } else {
        console.log('[RAG] Using original query embedding for search.');
    }

    // Search for a larger number of similar chunks in the database using the final search embedding
    const searchStage = useDeepSearch ? 'DeepSearch' : 'StandardSearch';
    onProgress({ message: 'Performing final search...' });
    const logStage = useDeepSearch ? 'Stage 3' : 'Standard Search';
    console.log(`[RAG-${logStage}] Performing final similarity search...`);
    const similarChunks = await searchSimilarEmbeddings(searchEmbedding, 50);
    console.log(`[RAG-${logStage}] Found ${similarChunks.length} potentially relevant chunks.`);

    // Re-rank chunks using MMR with the original query embedding for relevance
    onProgress({ message: 'Re-ranking results...' });
    console.log('[RAG] Performing MMR re-ranking...');
    const rerankedChunks = maximalMarginalRelevance(queryEmbedding, similarChunks);
    console.log(`[RAG] Re-ranked to ${rerankedChunks.length} chunks with MMR.`);

    // Log the results for debugging
    if (rerankedChunks.length === 0) {
      console.log('[RAG] No relevant chunks found after all stages.');
    } else {
      console.log(`[RAG] Final retrieved chunks:`);
      rerankedChunks.forEach((chunk, i) => {
        console.log(`  - Chunk ${i + 1}: Similarity ${(chunk.similarity * 100).toFixed(2)}%`);
      });
    }

    return rerankedChunks;
  } catch (error) {
    console.error('[RAG] Error retrieving relevant chunks:', error);
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
  
  // Create a map of document IDs to document names (to avoid querying inside the loop)
  const documentNames = new Map();
  
  // First pass to gather unique document IDs
  const uniqueDocIds = [...new Set(sortedChunks.map(chunk => chunk.document_id))];
  
  // Get document names from database if there are chunks
  if (uniqueDocIds.length > 0) {
    try {
      const dbPath = DATABASE_URL.startsWith('file:')
        ? DATABASE_URL.substring(5)
        : DATABASE_URL;
      
      const db = new Database(dbPath);
      
      const placeholders = uniqueDocIds.map(() => '?').join(',');
      const query = `SELECT id, name FROM documents WHERE id IN (${placeholders})`;
      const documents = db.prepare(query).all(uniqueDocIds);
      
      documents.forEach(doc => {
        documentNames.set(doc.id, doc.name);
      });
      
      db.close();
    } catch (error) {
      console.error('[RAG] Error fetching document names:', error);
      // Continue without document names if there's an error
    }
  }
  
  for (const chunk of sortedChunks) {
    const similarityPercentage = (chunk.similarity * 100).toFixed(1);
    const docName = documentNames.get(chunk.document_id) || 'Unknown Document';
    
    // Store document info in the chunk metadata for client-side display
    chunk.documentName = docName;
    
    // Use simple numbered citations
    const chunkHeader = `[Source ${includedChunks + 1}]\n`;
    const chunkContent = `${chunk.content}\n\n`;
    
    if (context.length + chunkHeader.length + chunkContent.length <= CONTEXT_MAX_LENGTH) {
      context += chunkHeader + chunkContent;
      includedChunks++;
    } else {
      // Stop if adding the next chunk would exceed the max length
      break;
    }
  }

  console.log(`[RAG] Formatted context with ${includedChunks} chunks, length: ${context.length} chars.`);
  return context;
}

export default {
  retrieveRelevantChunks,
  formatChunksForContext
}; 