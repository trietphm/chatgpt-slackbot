import { Pool, PoolClient } from 'pg';
import { CONFIG } from '../config';
import { KnowledgeChunk, SearchResult } from '../types';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: CONFIG.DATABASE.HOST,
      port: CONFIG.DATABASE.PORT,
      database: CONFIG.DATABASE.DATABASE,
      user: CONFIG.DATABASE.USER,
      password: CONFIG.DATABASE.PASSWORD,
      ssl: CONFIG.DATABASE.SSL ? { rejectUnauthorized: false } : false,
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Enable pgvector extension
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Create knowledge_chunks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          chunk_index INTEGER NOT NULL,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create index for similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx 
        ON knowledge_chunks 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);

      // Create unique constraint on filename and chunk_index
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_filename_chunk_idx 
        ON knowledge_chunks (filename, chunk_index);
      `);

      client.release();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async insertChunk(chunk: Omit<KnowledgeChunk, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const client = await this.pool.connect();
    try {
      // Convert JavaScript array to PostgreSQL array format for pgvector
      const embeddingArray = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
      
      const result = await client.query(`
        INSERT INTO knowledge_chunks (content, filename, chunk_index, embedding)
        VALUES ($1, $2, $3, $4::vector)
        ON CONFLICT (filename, chunk_index) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
        RETURNING id;
      `, [chunk.content, chunk.filename, chunk.chunk_index, embeddingArray]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async searchSimilarChunks(embedding: number[], limit: number = CONFIG.KNOWLEDGE_BASE.SEARCH_LIMIT): Promise<SearchResult[]> {
    const client = await this.pool.connect();
    try {
      // Convert JavaScript array to PostgreSQL array format for pgvector
      const embeddingArray = `[${embedding.join(',')}]`;
      
      const result = await client.query(`
        SELECT 
          content,
          filename,
          chunk_index,
          1 - (embedding <=> $1::vector) as similarity
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2;
      `, [embeddingArray, limit]);
      
      return result.rows.map(row => ({
        content: row.content,
        filename: row.filename,
        chunk_index: row.chunk_index,
        similarity: parseFloat(row.similarity)
      }));
    } finally {
      client.release();
    }
  }

  async deleteChunksByFilename(filename: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM knowledge_chunks 
        WHERE filename = $1
        RETURNING id;
      `, [filename]);
      
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  async getAllFilenames(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT filename 
        FROM knowledge_chunks 
        ORDER BY filename;
      `);
      
      return result.rows.map(row => row.filename);
    } finally {
      client.release();
    }
  }

  async getChunkCount(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM knowledge_chunks;
      `);
      
      return parseInt(result.rows[0].count) || 0;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 
