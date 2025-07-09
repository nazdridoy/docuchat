import express from 'express';
import { processMessage } from '../chat/index.js';

const router = express.Router();

/**
 * @route POST /api/chat
 * @description Process a chat message and return a response
 */
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Process the message
    const response = await processMessage(message, history || []);
    
    res.json(response);
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 