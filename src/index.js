import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT, EMBEDDING_DIMENSIONS } from './config.js';
import apiRouter from './api/index.js';
import db from './db/index.js';
import { checkEmbeddingApiAvailability } from './embeddings/index.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '..', 'client')));

// API routes
app.use('/api', apiRouter);

// Serve the index.html for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Check embedding requirements before starting the server
async function checkEmbeddingRequirements() {
  // If EMBEDDING_DIMENSIONS is set, we can proceed
  if (EMBEDDING_DIMENSIONS) {
    console.log(`Using configured embedding dimension: ${EMBEDDING_DIMENSIONS}`);
    return true;
  }
  
  // If not, check if the embedding API is available
  console.log('EMBEDDING_DIMENSIONS not set, checking embedding API availability...');
  const isApiAvailable = await checkEmbeddingApiAvailability();
  
  if (!isApiAvailable) {
    console.error('\n-------------------------------------------');
    console.error('ERROR: Server could not start due to missing embedding dimensions.');
    console.error('SOLUTION:');
    console.error('1. Add EMBEDDING_DIMENSIONS=<value> to your .env file');
    console.error('   (Common values: 768, 1024, 1536 depending on your model)');
    console.error('2. OR ensure your embedding API server is running and accessible');
    console.error('-------------------------------------------\n');
    console.error('Server startup aborted.');
    return false;
  }
  
  return true;
}

// Initialize the database before starting the server
async function startServer() {
  try {
    // Check embedding requirements first
    const embeddingRequirementsMet = await checkEmbeddingRequirements();
    if (!embeddingRequirementsMet) {
      process.exit(1);
    }
    
    // Initialize database
    await db.initializeDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    // Check if the error is related to embedding dimensions
    if (error.message.includes('embedding dimension')) {
      // Don't log the error itself, just show the user-friendly message
      console.error('\n-------------------------------------------');
      console.error('ERROR: Server could not start due to missing embedding dimensions.');
      console.error('SOLUTION:');
      console.error('1. Add EMBEDDING_DIMENSIONS=<value> to your .env file');
      console.error('   (Common values: 768, 1024, 1536 depending on your model)');
      console.error('2. OR ensure your embedding API server is running and accessible');
      console.error('-------------------------------------------\n');
      console.error('Server startup aborted.');
    } else {
      console.error('Failed to start server:', error);
    }
    
    // Exit with a non-zero code to indicate failure
    process.exit(1);
  }
}

startServer(); 