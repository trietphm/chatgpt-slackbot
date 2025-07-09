#!/usr/bin/env ts-node

import { KnowledgeBaseService } from '../services/knowledge-base';
import { Logger } from '../utils/logger';

async function main() {
  const kb = new KnowledgeBaseService();
  
  try {
    Logger.info('Initializing knowledge base...');
    await kb.initialize();
    
    Logger.info('Processing knowledge folder...');
    const result = await kb.processKnowledgeFolder();
    
    Logger.info(`Processing complete!`);
    Logger.info(`- Files processed: ${result.processed}`);
    Logger.info(`- Errors: ${result.errors}`);
    
    // Get statistics
    const stats = await kb.getStats();
    Logger.info(`- Total chunks in database: ${stats.totalChunks}`);
    Logger.info(`- Files indexed: ${stats.filenames.length}`);
    
    if (stats.filenames.length > 0) {
      Logger.info('Indexed files:');
      stats.filenames.forEach(filename => Logger.info(`  - ${filename}`));
    }
    
  } catch (error) {
    Logger.error('Error processing knowledge base:', error);
    process.exit(1);
  } finally {
    await kb.close();
  }
}

if (require.main === module) {
  main();
} 