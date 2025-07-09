import Database from 'better-sqlite3';
import { load } from 'sqlite-vss';
import {
  DATABASE_URL,
  EMBEDDING_DIMENSIONS,
  USE_LOCAL_DB,
  setChunkingDefaults,
} from '../config.js';
import { generateEmbedding } from '../embeddings/index.js';

if (!USE_LOCAL_DB) {
  console.warn(
    'Warning: `better-sqlite3` is in use, but USE_LOCAL_DB is false. This setup only supports local databases.'
  );
}

// Get the database file path from the DATABASE_URL
const dbPath = DATABASE_URL.startsWith('file:')
  ? DATABASE_URL.substring(5)
  : DATABASE_URL;

// Initialize the database connection
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Load the VSS extension
load(db);

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create documents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chunks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    let dimensions;
    if (EMBEDDING_DIMENSIONS) {
      dimensions = parseInt(EMBEDDING_DIMENSIONS);
      console.log(`Using configured embedding dimension: ${dimensions}`);
    } else {
      try {
        console.log('Detecting embedding dimension from model...');
        const testEmbedding = await generateEmbedding('test');
        dimensions = testEmbedding.length;
        console.log(`Detected embedding dimension: ${dimensions}`);
      } catch (e) {
        console.error(
          'Failed to detect embedding dimension from model. Please set EMBEDDING_DIMENSIONS environment variable.',
          e
        );
        throw new Error('Could not determine embedding dimension.');
      }
    }

    // Set chunking parameters based on dimensions if not explicitly configured
    setChunkingDefaults(dimensions);

    // Create vss_embeddings virtual table for vector search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vss_embeddings USING vss0(
        embedding(${dimensions})
      )
    `);

    console.log('Database tables initialized successfully with better-sqlite3');
    console.log(`Using local SQLite database at: ${dbPath}`);
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  }
}

// Document operations
export function insertDocument(document) {
  try {
    const { id, name, type, size } = document;
    const stmt = db.prepare(
      `INSERT INTO documents (id, name, type, size) VALUES (?, ?, ?, ?)`
    );
    stmt.run(id, name, type, size);
    return { id };
  } catch (error) {
    console.error('Failed to insert document:', error);
    throw error;
  }
}

export function getDocuments() {
  try {
    const stmt = db.prepare(`SELECT * FROM documents ORDER BY created_at DESC`);
    return stmt.all();
  } catch (error) {
    console.error('Failed to get documents:', error);
    throw error;
  }
}

export function deleteDocument(id) {
  try {
    db.transaction(() => {
      const getChunkRowIdsStmt = db.prepare(
        `SELECT rowid FROM chunks WHERE document_id = ?`
      );
      const rowIds = getChunkRowIdsStmt.all(id).map((row) => row.rowid);

      if (rowIds.length > 0) {
        const deleteEmbeddingsStmt = db.prepare(
          `DELETE FROM vss_embeddings WHERE rowid IN (${rowIds
            .map(() => '?')
            .join(',')})`
        );
        deleteEmbeddingsStmt.run(...rowIds);
      }

      const stmt = db.prepare(`DELETE FROM documents WHERE id = ?`);
      stmt.run(id);
    })();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw error;
  }
}

// Chunks operations
export function insertChunks(chunks) {
  try {
    const stmt = db.prepare(
      `INSERT INTO chunks (id, document_id, content) VALUES (?, ?, ?)`
    );
    db.transaction(() => {
      for (const chunk of chunks) {
        stmt.run(chunk.id, chunk.documentId, chunk.content);
      }
    })();
    return { success: true, count: chunks.length };
  } catch (error) {
    console.error('Failed to insert chunks:', error);
    throw error;
  }
}

// Embedding operations
export function insertEmbedding(embedding) {
  try {
    const embeddingBuffer = Buffer.from(
      Float32Array.from(embedding.embedding).buffer
    );

    const getChunkRowIdStmt = db.prepare(
      `SELECT rowid FROM chunks WHERE id = ?`
    );
    const chunk = getChunkRowIdStmt.get(embedding.chunkId);
    if (!chunk) {
      throw new Error(`Chunk with id ${embedding.chunkId} not found`);
    }
    const chunkRowId = chunk.rowid;

    const stmt = db.prepare(
      `INSERT INTO vss_embeddings (rowid, embedding) VALUES (?, ?)`
    );
    stmt.run(chunkRowId, embeddingBuffer);
    return { success: true };
  } catch (error) {
    console.error('Failed to insert embedding:', error);
    throw error;
  }
}

// Search for similar embeddings
export function searchSimilarEmbeddings(embeddingVector, limit = 5) {
  try {
    const embeddingBuffer = Buffer.from(
      Float32Array.from(embeddingVector).buffer
    );

    const searchStmt = db.prepare(`
      WITH matches AS (
        SELECT
          rowid,
          distance
        FROM vss_embeddings
        WHERE vss_search(embedding, ?)
        LIMIT ?
      )
      SELECT
        c.id as chunk_id,
        c.content,
        c.document_id,
        m.distance as similarity
      FROM matches m
      JOIN chunks c ON c.rowid = m.rowid
    `);

    const results = searchStmt.all(embeddingBuffer, limit);
    const topResults = results.map((row) => ({
      ...row,
      similarity: 1 - row.similarity,
    }));

    console.log(
      `Found ${topResults.length} similar chunks. Top similarity score: ${
        topResults[0]?.similarity.toFixed(4) || 'N/A'
      }`
    );

    return topResults;
  } catch (error) {
    console.error('Failed to search similar embeddings:', error);
    throw error;
  }
}

export default {
  db,
  initializeDatabase,
  insertDocument,
  getDocuments,
  deleteDocument,
  insertChunks,
  insertEmbedding,
  searchSimilarEmbeddings,
}; 