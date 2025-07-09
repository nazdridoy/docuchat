import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { generateEmbeddingsBatch } from '../embeddings/index.js';
import {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
} from '../config.js';
import {
  insertDocument,
  insertChunks,
  insertEmbedding,
  deleteDocument
} from '../db/index.js';

/**
 * Splits a text into chunks of a specified size with a specified overlap.
 * This is a simplified replacement for LangChain's RecursiveCharacterTextSplitter.
 * @param {string} text - The text to split.
 * @param {number} chunkSize - The maximum size of each chunk.
 * @param {number} chunkOverlap - The number of characters to overlap between chunks.
 * @returns {string[]} - An array of text chunks.
 */
function splitTextIntoChunks(text, chunkSize, chunkOverlap) {
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be smaller than chunkSize");
  }

  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let endIndex = i + chunkSize;
    if (endIndex > text.length) {
      endIndex = text.length;
    }
    chunks.push(text.substring(i, endIndex));
    i += chunkSize - chunkOverlap;
  }
  return chunks;
}

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
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      textContent = pdfData.text;
      console.log(`Extracted ${textContent.length} characters from PDF`);
    } else if (mimetype === 'text/plain' || mimetype.includes('text/')) {
      textContent = await fs.promises.readFile(filePath, 'utf8');
      console.log(`Extracted ${textContent.length} characters from text file`);
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
    
    // Split text into chunks
    console.log('Splitting text into chunks...');
    const chunks = splitTextIntoChunks(textContent, CHUNK_SIZE, CHUNK_OVERLAP);
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