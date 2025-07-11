import openai from '../openai.js';
import { OPENAI_MODEL } from '../config.js';
import { retrieveRelevantChunks, formatChunksForContext } from '../rag/index.js';

/**
 * Process a chat message using the RAG approach
 * @param {string} message - The user's message
 * @param {Array} history - Previous chat history (optional)
 * @param {boolean} deepSearch - Whether to use deep search mode
 * @param {function} onProgress - Callback function for progress updates.
 * @param {function} onToken - Callback function for streaming tokens
 * @returns {Promise<Object>} - The chat response
 */
export async function processMessage(message, history = [], deepSearch = false, onProgress = () => {}, onToken = null) {
  try {
    console.log(`[Chat] Processing message: "${message}"`);
    // Retrieve relevant document chunks
    const relevantChunks = await retrieveRelevantChunks(message, history, deepSearch, onProgress);
    
    // Format chunks for context
    const context = formatChunksForContext(relevantChunks);
    
    // Prepare the messages for the chat API
    const messages = [
      {
        role: 'system',
        content: `You are an expert AI assistant specialized in analyzing and answering questions based on provided text documents. Your goal is to provide accurate, helpful, and well-structured answers.

Follow these instructions carefully:
1.  **Analyze the Context**: Thoroughly read and understand the provided document context before answering the user's question.
2.  **Answer from Context**: Base your answers strictly on the information given in the context. Do not use any external knowledge or make up information.
3.  **Handle Insufficient Information**: If the context does not contain the information needed to answer the question, state clearly: "I don't have enough information to answer that question based on the provided documents."
4.  **Cite Your Sources**: When you provide information from the context, you MUST cite the specific source it came from using the format [Source X] where X is the source number.
5.  **Synthesize Information**: If multiple sources are relevant, synthesize the information into a coherent answer.
6.  **Be Concise and Clear**: Provide a clear and concise answer. Avoid unnecessary jargon or overly long responses.

Here is the relevant document context:
${context}`
      },
      ...history,
      { role: 'user', content: message }
    ];
    
    // Call the OpenAI API
    console.log('[Chat] Sending final prompt to LLM...');
    
    let responseMessage = null;
    let usageInfo = null;
    
    if (onToken) {
      // Use streaming mode
      onProgress({ message: 'Generating response...' });
      
      const stream = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        stream: true,
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onToken(content);
        }
      }
      
      // Create response message object in the same format as non-streaming
      responseMessage = { role: 'assistant', content: fullContent };
      
      // We don't get usage info from streaming responses
      usageInfo = { 
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
    } else {
      // Use non-streaming mode (original implementation)
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
      });
      
      responseMessage = completion.choices[0].message;
      usageInfo = completion.usage;
    }
    
    console.log('[Chat] Received response from LLM.');
    
    // Return the response along with the chunks used for context
    return {
      message: responseMessage,
      sourceChunks: relevantChunks.map(chunk => ({
        content: chunk.content,
        similarity: chunk.similarity,
        documentName: chunk.documentName
      })),
      usage: usageInfo
    };
  } catch (error) {
    console.error('[Chat] Error processing chat message:', error);
    throw error;
  }
}

export default {
  processMessage
}; 