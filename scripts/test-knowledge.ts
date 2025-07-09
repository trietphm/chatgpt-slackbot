#!/usr/bin/env ts-node

import { KnowledgeBaseService } from '../services/knowledge-base';
import { Logger } from '../utils/logger';

async function testKnowledgeBase() {
  const kb = new KnowledgeBaseService();
  
  try {
    Logger.info('🧪 Testing knowledge base...');
    await kb.initialize();
    
    // Test search
    const testQuery = "knowledge base";
    Logger.info(`🔍 Testing search with query: "${testQuery}"`);
    
    const results = await kb.searchKnowledge(testQuery);
    Logger.info(`📊 Search results: ${results.length}`);
    
    results.forEach((result, index) => {
      Logger.info(`  ${index + 1}. ${result.filename} (${(result.similarity * 100).toFixed(1)}%)`);
      Logger.info(`     Content: ${result.content.substring(0, 100)}...`);
    });
    
    // Get stats
    const stats = await kb.getStats();
    Logger.info(`📚 Database stats: ${stats.totalChunks} chunks, ${stats.filenames.length} files`);
    
  } catch (error) {
    Logger.error('❌ Test failed:', error);
  } finally {
    await kb.close();
  }
}

if (require.main === module) {
  testKnowledgeBase();
} 