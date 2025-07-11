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
        content: `You are an expert AI assistant specialized in analyzing and answering questions based on provided text documents. Your goal is to provide comprehensive, detailed, and well-structured answers, especially for academic or technical topics.

   Follow these instructions carefully:
   1. **Analyze the Context**: Thoroughly read and understand the provided document context before answering.
   2. **Provide Comprehensive Answers**: When asked for explanations, provide detailed, thorough responses that cover all aspects of the topic.
   3. **Include Technical Details**: Incorporate specific technical terminology, frameworks, models, and processes relevant to the topic.
   4. **Structure Your Response**: For longer explanations, use appropriate headings, lists, and paragraphs to organize information.
   5. **Answer from Context**: Base your answers strictly on the information given in the context. Do not use external knowledge.
   6. **Handle Insufficient Information**: If the context doesn't contain enough information, clearly state what's missing.
   7. **Cite Your Sources**: When you provide information from the context, you MUST cite the specific source it came from using the format [Source X] where X is the source number.
   8. **Synthesize Information**: If multiple sources are relevant, synthesize the information into a coherent answer.

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