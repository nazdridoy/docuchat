import OpenAI from 'openai';
import { OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_API_KEY } from '../config.js';
import { retrieveRelevantChunks, formatChunksForContext } from '../rag/index.js';

// Create OpenAI client for chat
const openai = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

/**
 * Process a chat message using the RAG approach
 * @param {string} message - The user's message
 * @param {Array} history - Previous chat history (optional)
 * @returns {Promise<Object>} - The chat response
 */
export async function processMessage(message, history = []) {
  try {
    // Retrieve relevant document chunks
    const relevantChunks = await retrieveRelevantChunks(message);
    
    // Format chunks for context
    const context = formatChunksForContext(relevantChunks);
    
    // Prepare the messages for the chat API
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that answers questions based on the provided document context. 
If the context doesn't contain the information needed to answer the question, say "I don't have enough information to answer that question." 
Do not make up information that is not supported by the context. 
If you quote from the context, make it clear where the information comes from.

Here is the relevant document context:
${context}`
      },
      ...history,
      { role: 'user', content: message }
    ];
    
    // Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });
    
    const responseMessage = completion.choices[0].message;
    
    // Return the response along with the chunks used for context
    return {
      message: responseMessage,
      sourceChunks: relevantChunks.map(chunk => ({
        content: chunk.content,
        similarity: chunk.similarity
      })),
      usage: completion.usage
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
}

export default {
  processMessage
}; 