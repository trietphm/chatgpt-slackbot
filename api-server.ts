import { KnowledgeAPI } from './api/knowledge-api';
import { Logger } from './utils/logger';

async function startAPIServer() {
  const api = new KnowledgeAPI();
  
  try {
    await api.start();
    Logger.info('Knowledge API server started successfully');
  } catch (error) {
    Logger.error('Failed to start Knowledge API server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    Logger.info('Shutting down Knowledge API server...');
    await api.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    Logger.info('Shutting down Knowledge API server...');
    await api.stop();
    process.exit(0);
  });
}

if (require.main === module) {
  startAPIServer();
} 