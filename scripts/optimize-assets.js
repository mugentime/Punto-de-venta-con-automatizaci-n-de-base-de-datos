#!/usr/bin/env node
/**
 * @fileoverview Asset Optimization Script
 * @description Optimizes static assets for production deployment
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const { AssetOptimizer } = require('../utils/assetOptimizer');

async function main() {
  console.log('🚀 Starting asset optimization for Railway deployment...');
  
  const startTime = Date.now();
  const optimizer = new AssetOptimizer();
  
  try {
    // Initialize and run optimization
    await optimizer.initialize();
    
    // Generate and display report
    const report = optimizer.getOptimizationReport();
    
    console.log('\n📊 Optimization Report:');
    console.log('=' .repeat(50));
    console.log(`Total Assets: ${report.totalAssets}`);
    console.log(`Optimized Assets: ${report.optimizedAssets}`);
    console.log(`Original Size: ${optimizer.formatBytes(report.totalOriginalSize)}`);
    console.log(`Optimized Size: ${optimizer.formatBytes(report.totalOptimizedSize)}`);
    console.log(`Total Savings: ${optimizer.formatBytes(report.totalSavings)}`);
    console.log(`Compression Ratio: ${report.compressionRatio}`);
    console.log(`Bundles Created: ${report.bundles.length}`);
    
    // Show detailed asset breakdown
    if (process.env.VERBOSE) {
      console.log('\n📁 Asset Details:');
      console.log('-'.repeat(80));
      console.log('Path'.padEnd(40) + 'Original'.padEnd(12) + 'Optimized'.padEnd(12) + 'Savings');
      console.log('-'.repeat(80));
      
      for (const asset of report.assets) {
        if (asset.savings !== '0 B') {
          console.log(
            asset.path.padEnd(40) + 
            asset.originalSize.padEnd(12) + 
            asset.optimizedSize.padEnd(12) + 
            asset.savings
          );
        }
      }
    }
    
    const endTime = Date.now();
    console.log(`\n✅ Asset optimization completed in ${endTime - startTime}ms`);
    
    // Clean up if requested
    if (process.env.CLEANUP) {
      await optimizer.cleanup();
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Asset optimization failed:', error);
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--verbose')) {
  process.env.VERBOSE = 'true';
}
if (args.includes('--cleanup')) {
  process.env.CLEANUP = 'true';
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Optimization script failed:', error);
    process.exit(1);
  });
}

module.exports = main;