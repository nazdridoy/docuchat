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
  deleteDocument,
} from '../db/index.js';

/**
 * Splits a text into chunks of a specified size with a specified overlap,
 * attempting to preserve semantic boundaries by recursively splitting along separators.
 * @param {string} text - The text to split.
 * @param {number} chunkSize - The maximum size of each chunk.
 * @param {number} chunkOverlap - The number of characters to overlap between chunks.
 * @returns {string[]} - An array of text chunks.
 */
function splitTextIntoChunks(text, chunkSize, chunkOverlap) {
  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be smaller than chunkSize');
  }

  const separators = ['\n\n', '\n', '. ', ' ', ''];
  
  function _split(text, currentSeparators) {
    if (text.length <= chunkSize) {
      return [text];
    }
    
    if (currentSeparators.length === 0) {
      // Base case: if no more separators, split by character chunks
      const chunks = [];
      for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
        chunks.push(text.substring(i, i + chunkSize));
      }
      return chunks;
    }
    
    const separator = currentSeparators[0];
    const nextSeparators = currentSeparators.slice(1);
    
    if (separator === '') {
        return _split(text, nextSeparators);
    }

    const splits = text.split(separator);
    const results = [];
    
    for (const split of splits) {
      if (split.length > chunkSize) {
        results.push(..._split(split, nextSeparators));
      } else {
        results.push(split);
      }
    }
    return results;
  }
  
  const initialSplits = _split(text, separators);

  // Merge small splits into larger chunks
  const mergedChunks = [];
  let currentChunk = '';
  for(let i=0; i < initialSplits.length; i++) {
    const split = initialSplits[i];
    const separator = (currentChunk.length > 0 && i > 0) ? (separators.find(s => initialSplits[i-1].endsWith(s))) || ' ' : '';

    if (currentChunk.length + split.length + separator.length > chunkSize) {
      mergedChunks.push(currentChunk);
      currentChunk = '';
    }
    
    // Add separator if it's not the start of a chunk
    if (currentChunk.length > 0) {
      currentChunk += separator;
    }
    currentChunk += split;
  }

  if (currentChunk) {
    mergedChunks.push(currentChunk);
  }

  // Handle overlap and final chunk sizing
  const finalChunks = [];
  for (const chunk of mergedChunks) {
    if (chunk.length > chunkSize) {
      for (let i = 0; i < chunk.length; i += chunkSize - chunkOverlap) {
        finalChunks.push(chunk.substring(i, i + chunkSize));
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks.filter(chunk => chunk.trim() !== '');
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