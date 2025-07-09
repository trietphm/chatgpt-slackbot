import express from 'express';
import { KnowledgeBaseService } from '../services/knowledge-base';
import { Logger } from '../utils/logger';
import { CONFIG } from '../config';

export class KnowledgeAPI {
  private app: express.Application;
  private kb: KnowledgeBaseService;

  constructor() {
    this.app = express();
    this.kb = new KnowledgeBaseService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Process knowledge folder
    this.app.post('/api/knowledge/process', async (req, res) => {
      try {
        Logger.info('API: Processing knowledge folder...');
        const result = await this.kb.processKnowledgeFolder();
        res.json({
          success: true,
          processed: result.processed,
          errors: result.errors,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('API: Error processing knowledge folder:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Get knowledge base statistics
    this.app.get('/api/knowledge/stats', async (req, res) => {
      try {
        const stats = await this.kb.getStats();
        res.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('API: Error getting stats:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Search knowledge base
    this.app.post('/api/knowledge/search', async (req, res) => {
      try {
        const { query } = req.body;
        
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required and must be a string',
            timestamp: new Date().toISOString()
          });
        }

        Logger.info(`API: Searching knowledge base for: "${query}"`);
        const results = await this.kb.searchKnowledge(query);
        
        res.json({
          success: true,
          query,
          results,
          count: results.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('API: Error searching knowledge base:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Process a specific file
    this.app.post('/api/knowledge/process-file', async (req, res) => {
      try {
        const { filePath } = req.body;
        
        if (!filePath || typeof filePath !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'filePath parameter is required and must be a string',
            timestamp: new Date().toISOString()
          });
        }

        Logger.info(`API: Processing file: ${filePath}`);
        await this.kb.processFile(filePath);
        
        res.json({
          success: true,
          filePath,
          message: 'File processed successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('API: Error processing file:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.kb.initialize();
      
      this.app.listen(CONFIG.API.PORT, () => {
        Logger.info(`Knowledge API server running on port ${CONFIG.API.PORT}`);
        Logger.info(`Health check: http://localhost:${CONFIG.API.PORT}/health`);
        Logger.info(`Process knowledge: POST http://localhost:${CONFIG.API.PORT}/api/knowledge/process`);
        Logger.info(`Get stats: GET http://localhost:${CONFIG.API.PORT}/api/knowledge/stats`);
        Logger.info(`Search: POST http://localhost:${CONFIG.API.PORT}/api/knowledge/search`);
      });
    } catch (error) {
      Logger.error('Error starting Knowledge API:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.kb.close();
  }
} 