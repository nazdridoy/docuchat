import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOAD_DIRECTORY, MAX_FILE_SIZE } from '../config.js';
import { processDocument } from '../documents/index.js';
import { getDocuments, deleteDocument, findDocumentByHash } from '../db/index.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIRECTORY)) {
      fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
    }
    cb(null, UPLOAD_DIRECTORY);
  },
  filename: (req, file, cb) => {
    // Use original name with timestamp to avoid conflicts
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${path.basename(file.originalname, ext)}-${uniqueSuffix}${ext}`);
  }
});

// Filter accepted file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['text/plain', 'application/pdf', 'text/markdown', 'text/csv'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Supported types: ${allowedTypes.join(', ')}`), false);
  }
};

// Set up multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE // Default: 10MB
  }
});

/**
 * @route GET /api/documents/check/:hash
 * @description Check if a document with given hash already exists
 */
router.get('/check/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const existingDoc = await findDocumentByHash(hash);
    
    if (existingDoc) {
      return res.json({ 
        exists: true, 
        document: existingDoc 
      });
    }
    
    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking document hash:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/documents
 * @description Upload and process a document
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileHash = req.body.hash;
    if (!fileHash) {
      return res.status(400).json({ error: 'File hash is required' });
    }
    
    // Check if document with this hash already exists
    const existingDoc = await findDocumentByHash(fileHash);
    if (existingDoc) {
      // Remove the uploaded file since it's a duplicate
      fs.unlinkSync(req.file.path);
      
      return res.status(409).json({ 
        error: 'Duplicate document', 
        document: existingDoc 
      });
    }
    
    // Process the uploaded document
    const result = await processDocument(req.file, fileHash);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/documents
 * @description Get all documents
 */
router.get('/', async (req, res) => {
  try {
    const documents = await getDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/documents/:id
 * @description Delete a document
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDocument(id);
    res.json({ success: true, message: `Document ${id} deleted successfully` });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 