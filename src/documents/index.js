import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { generateEmbeddingsBatch } from '../embeddings/index.js';
import {
  insertDocument,
  insertChunks,
  insertEmbedding,
  deleteDocument
} from '../db/index.js';

// Text splitter configuration
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

/**
 * Process an uploaded document
 * @param {Object} file - The uploaded file object
 * @returns {Promise<Object>} - The processed document info
 */
export async function processDocument(file) {
  const documentId = crypto.randomUUID();

  try {
    // Extract file info
    const { originalname, mimetype, size, path: filePath } = file;
    
    console.log(`Processing document: ${originalname}, type: ${mimetype}, size: ${size}`);
    
    // Create document record
    const document = {
      id: documentId,
      name: originalname,
      type: mimetype,
      size,
    };
    
    // Insert document into database
    await insertDocument(document);
    
    // Extract text content based on file type
    let textContent = '';
    
    if (mimetype === 'application/pdf') {
      console.log(`Loading PDF from: ${filePath}`);
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      textContent = docs.map((doc) => doc.pageContent).join('\n\n');
      console.log(`Extracted ${textContent.length} characters from PDF`);
    } else if (mimetype === 'text/plain' || mimetype.includes('text/')) {
      textContent = await fs.promises.readFile(filePath, 'utf8');
      console.log(`Extracted ${textContent.length} characters from text file`);
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
    
    // Split text into chunks
    console.log('Splitting text into chunks...');
    const chunks = await splitter.splitText(textContent);
    console.log(`Generated ${chunks.length} chunks from document`);
    
    // Create chunk records
    const chunkRecords = chunks.map((content) => ({
      id: crypto.randomUUID(),
      documentId,
      content,
    }));
    
    // Insert chunks into database
    console.log(`Inserting ${chunkRecords.length} chunks into database...`);
    await insertChunks(chunkRecords);
    
    // Generate embeddings for all chunks
    console.log('Generating embeddings for chunks...');
    const chunkContents = chunkRecords.map((chunk) => chunk.content);
    const embeddings = await generateEmbeddingsBatch(chunkContents);
    console.log(`Generated ${embeddings.length} embeddings`);
    
    // Create embedding records
    console.log('Storing embeddings in database...');
    for (let i = 0; i < chunkRecords.length; i++) {
      const embeddingRecord = {
        id: crypto.randomUUID(),
        chunkId: chunkRecords[i].id,
        embedding: embeddings[i],
      };
      
      // Insert embedding into database
      await insertEmbedding(embeddingRecord);
    }
    
    console.log(`Successfully processed document: ${originalname}`);
    return {
      id: documentId,
      name: originalname,
      type: mimetype,
      size,
      chunks: chunkRecords.length,
    };
  } catch (error) {
    console.error('Error processing document:', error);
    // Cleanup - delete the document and its associated data if processing failed
    try {
      console.log(`Cleaning up failed document processing: ${documentId}`);
      await deleteDocument(documentId);
    } catch (cleanupError) {
      console.error('Failed to clean up document:', cleanupError);
    }
    throw error;
  }
}

export default {
  processDocument,
}; 