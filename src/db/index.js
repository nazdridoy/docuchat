import { createClient } from '@libsql/client';
import { DATABASE_URL, DATABASE_TOKEN, USE_LOCAL_DB } from '../config.js';

// Create libsql client
const client = USE_LOCAL_DB
  ? createClient({
      url: DATABASE_URL,
    })
  : createClient({
      url: DATABASE_URL,
      authToken: DATABASE_TOKEN,
    });

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create documents table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chunks table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // Create embeddings table with vector storage
    await client.execute(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized successfully');
    console.log(`Using ${USE_LOCAL_DB ? 'local SQLite database' : 'remote Turso database'} at: ${DATABASE_URL}`);
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  }
}

// Document operations
export async function insertDocument(document) {
  try {
    const { id, name, type, size } = document;
    await client.execute({
      sql: `INSERT INTO documents (id, name, type, size) VALUES (?, ?, ?, ?)`,
      args: [id, name, type, size]
    });
    return { id };
  } catch (error) {
    console.error('Failed to insert document:', error);
    throw error;
  }
}

export async function getDocuments() {
  try {
    const result = await client.execute(`SELECT * FROM documents ORDER BY created_at DESC`);
    return result.rows;
  } catch (error) {
    console.error('Failed to get documents:', error);
    throw error;
  }
}

export async function deleteDocument(id) {
  try {
    await client.execute({
      sql: `DELETE FROM documents WHERE id = ?`,
      args: [id]
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw error;
  }
}

// Chunks operations
export async function insertChunks(chunks) {
  let tx;
  try {
    // Use a transaction for better performance
    tx = await client.transaction('write');
    for (const chunk of chunks) {
      await tx.execute({
        sql: `INSERT INTO chunks (id, document_id, content) VALUES (?, ?, ?)`,
        args: [chunk.id, chunk.documentId, chunk.content],
      });
    }
    await tx.commit();
    return { success: true, count: chunks.length };
  } catch (error) {
    console.error('Failed to insert chunks:', error);
    if (tx) {
      await tx.rollback();
    }
    throw error;
  }
}

// Embedding operations
export async function insertEmbedding(embedding) {
  try {
    // Convert embedding array to binary blob
    const embeddingBlob = Buffer.from(Float32Array.from(embedding.embedding).buffer);
    const embeddingDimensions = embedding.embedding.length;
    
    console.log(`Storing embedding with id: ${embedding.id}, dimensions: ${embeddingDimensions}`);
    
    await client.execute({
      sql: `INSERT INTO embeddings (id, chunk_id, embedding) VALUES (?, ?, ?)`,
      args: [embedding.id, embedding.chunkId, embeddingBlob]
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to insert embedding:', error);
    throw error;
  }
}

// Search for similar embeddings
export async function searchSimilarEmbeddings(embeddingVector, limit = 5) {
  try {
    console.log(`Searching for similar embeddings with vector dimensions: ${embeddingVector.length}`);
    
    // Get all embeddings
    const result = await client.execute(`
      SELECT 
        e.id as embedding_id, 
        e.chunk_id,
        c.content,
        c.document_id,
        e.embedding
      FROM embeddings e
      JOIN chunks c ON e.chunk_id = c.id
    `);
    
    console.log(`Retrieved ${result.rows.length} embeddings from the database`);
    
    if (result.rows.length === 0) {
      return [];
    }
    
    // Calculate similarities manually
    const similarities = [];
    
    for (const row of result.rows) {
      try {
        const embeddingBlob = row.embedding;
        if (!embeddingBlob) {
          console.warn(`Missing embedding for chunk_id: ${row.chunk_id}`);
          continue;
        }
        
        const buffer = Buffer.from(embeddingBlob);
        const embeddingArray = Array.from(new Float32Array(buffer.buffer));
        
        // Ensure vectors have the same dimensions
        if (embeddingArray.length !== embeddingVector.length) {
          console.warn(
            `Dimension mismatch: Query vector has ${embeddingVector.length} dimensions, ` +
            `stored vector has ${embeddingArray.length} dimensions for chunk_id: ${row.chunk_id}`
          );
          continue;
        }
        
        // Calculate cosine similarity
        const similarity = cosineSimilarity(embeddingVector, embeddingArray);
        
        similarities.push({
          embedding_id: row.embedding_id,
          chunk_id: row.chunk_id,
          content: row.content,
          document_id: row.document_id,
          similarity
        });
      } catch (error) {
        console.error(`Error processing embedding for chunk_id ${row.chunk_id}:`, error);
      }
    }
    
    // Sort by similarity (highest first) and take the top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, limit);
    
    console.log(`Found ${topResults.length} similar chunks. Top similarity score: ${topResults[0]?.similarity.toFixed(4)}`);
    
    return topResults;
  } catch (error) {
    console.error('Failed to search similar embeddings:', error);
    throw error;
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  // Ensure we have arrays with valid numbers
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    throw new Error(`Invalid vector dimensions: A=${vecA?.length}, B=${vecB?.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    if (isNaN(vecA[i]) || isNaN(vecB[i])) {
      throw new Error(`Invalid vector values at position ${i}: A=${vecA[i]}, B=${vecB[i]}`);
    }
    
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  
  if (isNaN(similarity)) {
    throw new Error(`Similarity calculation resulted in NaN`);
  }
  
  return similarity;
}

export default {
  client,
  initializeDatabase,
  insertDocument,
  getDocuments,
  deleteDocument,
  insertChunks,
  insertEmbedding,
  searchSimilarEmbeddings
}; 