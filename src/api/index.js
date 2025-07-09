import express from 'express';
import documentsRouter from './documents.js';
import chatRouter from './chat.js';

const router = express.Router();

// Mount routes
router.use('/documents', documentsRouter);
router.use('/chat', chatRouter);

export default router; 