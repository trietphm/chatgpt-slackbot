import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from '../config';
import { DatabaseService } from './database';
import { EmbeddingsService } from './embeddings';
import { KnowledgeChunk } from '../types';
import { Logger } from '../utils/logger';

export class KnowledgeBaseService {
  private db: DatabaseService;
  private embeddings: EmbeddingsService;

  constructor() {
    this.db = new DatabaseService();
    this.embeddings = new EmbeddingsService();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
    
    // Check if we have any data in the knowledge base
    try {
      const stats = await this.getStats();
      console.log(`📚 Knowledge base initialized. Total chunks: ${stats.totalChunks}, Files: ${stats.filenames.length}`);
      if (stats.filenames.length > 0) {
        console.log(`📁 Indexed files: ${stats.filenames.join(', ')}`);
      } else {
        console.log(`⚠️ No files indexed yet. Run 'yarn process-knowledge' to add content.`);
      }
    } catch (error) {
      console.error('Error getting knowledge base stats:', error);
    }
  }

  /**
   * Process markdown files in the knowledge folder
   */
  async processKnowledgeFolder(): Promise<{ processed: number; errors: number }> {
    try {
      const folderPath = CONFIG.KNOWLEDGE_BASE.FOLDER_PATH;
      const files = await this.getMarkdownFiles(folderPath);
      
      let processed = 0;
      let errors = 0;

      for (const file of files) {
        try {
          await this.processFile(file);
          processed++;
          Logger.info(`Processed file: ${file}`);
        } catch (error) {
          errors++;
          Logger.error(`Error processing file ${file}:`, error);
        }
      }

      return { processed, errors };
    } catch (error) {
      Logger.error('Error processing knowledge folder:', error);
      throw error;
    }
  }

  /**
   * Process a single markdown file
   */
  async processFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    // Delete existing chunks for this file
    await this.db.deleteChunksByFilename(filename);
    
    // Split content into chunks
    const chunks = this.splitIntoChunks(content, filename);
    
    // Create embeddings for all chunks
    const texts = chunks.map(chunk => chunk.content);
    const embeddingsResponse = await this.embeddings.createEmbeddings(texts);
    
    // Insert chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddingsResponse.data.find(d => d.index === i)?.embedding;
      
      await this.db.insertChunk({
        content: chunk.content,
        filename: chunk.filename,
        chunk_index: chunk.chunk_index,
        embedding: embedding,
      });
    }
  }

  /**
   * Search for relevant knowledge chunks
   */
  async searchKnowledge(query: string): Promise<{ content: string; filename: string; similarity: number }[]> {
    try {
      console.log(`🔍 Creating embedding for query: "${query}"`);
      
      // Create embedding for the query
      const queryEmbedding = await this.embeddings.createEmbedding(query);
      console.log(`📊 Query embedding created, length: ${queryEmbedding.length}`);
      
      // Search for similar chunks
      console.log(`🔎 Searching database for similar chunks...`);
      const results = await this.db.searchSimilarChunks(queryEmbedding);
      console.log(`📈 Raw search results: ${results.length} chunks found`);
      
      // Log all results before filtering
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.filename} - similarity: ${(result.similarity * 100).toFixed(1)}%`);
      });
      
      // Filter by similarity threshold
      const threshold = CONFIG.KNOWLEDGE_BASE.SIMILARITY_THRESHOLD;
      console.log(`🎯 Filtering by similarity threshold: ${threshold} (${(threshold * 100).toFixed(1)}%)`);
      
      const filteredResults = results.filter(result => 
        result.similarity >= threshold
      );
      
      console.log(`✅ Filtered results: ${filteredResults.length} chunks above threshold`);
      
      return filteredResults.map(result => ({
        content: result.content,
        filename: result.filename,
        similarity: result.similarity,
      }));
    } catch (error) {
      Logger.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  /**
   * Get all markdown files in the knowledge folder
   */
  private async getMarkdownFiles(folderPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const items = await fs.readdir(folderPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(folderPath, item.name);
        
        if (item.isDirectory()) {
          // Recursively process subdirectories
          const subFiles = await this.getMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (item.isFile() && this.isMarkdownFile(item.name)) {
          files.push(fullPath);
        }
      }
      
      return files;
    } catch (error) {
      Logger.error(`Error reading directory ${folderPath}:`, error);
      return [];
    }
  }

  /**
   * Check if file is a markdown file
   */
  private isMarkdownFile(filename: string): boolean {
    const markdownExtensions = ['.md', '.markdown', '.mdown'];
    const ext = path.extname(filename).toLowerCase();
    return markdownExtensions.includes(ext);
  }

  /**
   * Split content into chunks with overlap
   */
  private splitIntoChunks(content: string, filename: string): Omit<KnowledgeChunk, 'id' | 'created_at' | 'updated_at'>[] {
    const chunks: Omit<KnowledgeChunk, 'id' | 'created_at' | 'updated_at'>[] = [];
    const chunkSize = CONFIG.KNOWLEDGE_BASE.CHUNK_SIZE;
    const overlap = CONFIG.KNOWLEDGE_BASE.CHUNK_OVERLAP;
    
    let start = 0;
    let chunkIndex = 0;
    
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunkContent = content.substring(start, end);
      
      // Try to break at sentence boundaries
      if (end < content.length) {
        const lastPeriod = chunkContent.lastIndexOf('.');
        const lastNewline = chunkContent.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + chunkSize * 0.7) {
          chunkContent = chunkContent.substring(0, breakPoint + 1);
        }
      }
      
      chunks.push({
        content: chunkContent.trim(),
        filename,
        chunk_index: chunkIndex,
      });
      
      start = start + chunkSize - overlap;
      chunkIndex++;
    }
    
    return chunks;
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<{ totalChunks: number; filenames: string[] }> {
    const totalChunks = await this.db.getChunkCount();
    const filenames = await this.db.getAllFilenames();
    
    return { totalChunks, filenames };
  }

  async close(): Promise<void> {
    await this.db.close();
  }
} 