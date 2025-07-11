import express from 'express';
import { processMessage } from '../chat/index.js';

const router = express.Router();

/**
 * @route GET /api/chat
 * @description Process a chat message and stream the response using SSE.
 */
router.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onProgress = (data) => {
    res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
  };
  
  const onToken = (token) => {
    res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
  };

  try {
    const { message, history, deepSearch } = req.query;
    
    if (!message) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
      return res.end();
    }
    
    const parsedHistory = history ? JSON.parse(history) : [];
    const useDeepSearch = deepSearch === 'true';

    // Process the message and get the final response with streaming
    const finalResponse = await processMessage(message, parsedHistory, useDeepSearch, onProgress, onToken);
    
    // Send the final complete message with source chunks
    res.write(`event: final\ndata: ${JSON.stringify(finalResponse)}\n\n`);

  } catch (error) {
    console.error('[API] Error processing chat message:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router; 