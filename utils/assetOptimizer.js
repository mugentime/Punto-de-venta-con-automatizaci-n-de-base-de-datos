/**
 * @fileoverview Asset Optimization and Bundle Management
 * @description Handles asset optimization, code splitting, and bundle management for Railway deployment
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { PERFORMANCE } = require('../config/constants');

/**
 * Asset Optimizer Class
 * Handles minification, compression, and optimization of static assets
 */
class AssetOptimizer {
  constructor() {
    this.cache = new Map();
    this.bundleMap = new Map();
    this.compressionEnabled = PERFORMANCE.ENABLE_COMPRESSION;
  }

  /**
   * Initialize asset optimization
   */
  async initialize() {
    console.log('🚀 Initializing asset optimization...');
    
    try {
      await this.scanAssets();
      await this.generateBundleMap();
      await this.optimizeAssets();
      
      console.log('✅ Asset optimization initialized');
    } catch (error) {
      console.error('❌ Asset optimization failed:', error);
    }
  }

  /**
   * Scan all assets in public directory
   */
  async scanAssets() {
    const publicDir = path.join(__dirname, '../public');
    const assets = await this.walkDirectory(publicDir);
    
    console.log(`📁 Found ${assets.length} assets to optimize`);
    
    for (const asset of assets) {
      const relativePath = path.relative(publicDir, asset);
      const stats = await fs.stat(asset);
      const hash = await this.generateFileHash(asset);
      
      this.cache.set(relativePath, {
        path: asset,
        size: stats.size,
        hash: hash,
        mtime: stats.mtime,
        optimized: false
      });
    }
  }

  /**
   * Walk directory recursively
   * @param {string} dir - Directory to walk
   * @returns {Promise<string[]>} Array of file paths
   */
  async walkDirectory(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        } else if (this.isOptimizableAsset(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not read directory ${dir}:`, error.message);
    }
    
    return files;
  }

  /**
   * Check if file is optimizable
   * @param {string} filename - File name
   * @returns {boolean} Whether file can be optimized
   */
  isOptimizableAsset(filename) {
    const optimizableExtensions = ['.js', '.css', '.html', '.json', '.svg'];
    const ext = path.extname(filename).toLowerCase();
    
    // Skip already minified files
    if (filename.includes('.min.')) {
      return false;
    }
    
    return optimizableExtensions.includes(ext);
  }

  /**
   * Generate file hash for cache busting
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File hash
   */
  async generateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    } catch (error) {
      return Date.now().toString();
    }
  }

  /**
   * Generate bundle map for code splitting
   */
  async generateBundleMap() {
    console.log('📦 Generating bundle map...');
    
    // Core bundle - essential files
    this.bundleMap.set('core', [
      'js/mobile-enhancements.js',
      'js/mobile-menu-simple.js',
      'css/mobile-optimized.css'
    ]);
    
    // Features bundle - feature-specific files
    this.bundleMap.set('features', [
      'js/customer-search.js'
    ]);
    
    // Vendor bundle - external libraries (if any local copies)
    this.bundleMap.set('vendor', []);
    
    console.log(`📦 Generated ${this.bundleMap.size} bundles`);
  }

  /**
   * Optimize all assets
   */
  async optimizeAssets() {
    console.log('⚡ Optimizing assets...');
    
    let optimizedCount = 0;
    let totalSavings = 0;
    
    for (const [relativePath, asset] of this.cache.entries()) {
      try {
        const result = await this.optimizeAsset(asset);
        
        if (result.optimized) {
          optimizedCount++;
          totalSavings += result.savings;
          
          // Update cache
          asset.optimized = true;
          asset.optimizedSize = result.newSize;
          asset.savings = result.savings;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to optimize ${relativePath}:`, error.message);
      }
    }
    
    console.log(`✅ Optimized ${optimizedCount} assets, saved ${this.formatBytes(totalSavings)}`);
  }

  /**
   * Optimize individual asset
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeAsset(asset) {
    const ext = path.extname(asset.path).toLowerCase();
    const originalSize = asset.size;
    
    switch (ext) {
      case '.js':
        return await this.optimizeJavaScript(asset);
      case '.css':
        return await this.optimizeCSS(asset);
      case '.html':
        return await this.optimizeHTML(asset);
      case '.json':
        return await this.optimizeJSON(asset);
      case '.svg':
        return await this.optimizeSVG(asset);
      default:
        return { optimized: false };
    }
  }

  /**
   * Optimize JavaScript files
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeJavaScript(asset) {
    try {
      const content = await fs.readFile(asset.path, 'utf8');
      const originalSize = content.length;
      
      // Basic minification - remove comments and extra whitespace
      let optimized = content
        // Remove single-line comments (but keep URLs and regex)
        .replace(/\/\/(?![^']*'[^']*$|[^"]*"[^"]*$)[^\r\n]*/g, '')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove spaces around operators and brackets
        .replace(/\s*([{}();,:])\s*/g, '$1')
        .trim();
      
      // Only save if significantly smaller
      if (optimized.length < originalSize * 0.9) {
        const optimizedPath = asset.path.replace(/\.js$/, '.min.js');
        await fs.writeFile(optimizedPath, optimized);
        
        return {
          optimized: true,
          newSize: optimized.length,
          savings: originalSize - optimized.length,
          outputPath: optimizedPath
        };
      }
      
      return { optimized: false };
    } catch (error) {
      console.warn('JS optimization failed:', error.message);
      return { optimized: false };
    }
  }

  /**
   * Optimize CSS files
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeCSS(asset) {
    try {
      const content = await fs.readFile(asset.path, 'utf8');
      const originalSize = content.length;
      
      // Basic CSS minification
      let optimized = content
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove spaces around certain characters
        .replace(/\s*([{}:;,>+~])\s*/g, '$1')
        // Remove trailing semicolons before closing braces
        .replace(/;}/g, '}')
        // Remove quotes from URLs where possible
        .replace(/url\(["']([^"']+)["']\)/g, 'url($1)')
        .trim();
      
      if (optimized.length < originalSize * 0.9) {
        const optimizedPath = asset.path.replace(/\.css$/, '.min.css');
        await fs.writeFile(optimizedPath, optimized);
        
        return {
          optimized: true,
          newSize: optimized.length,
          savings: originalSize - optimized.length,
          outputPath: optimizedPath
        };
      }
      
      return { optimized: false };
    } catch (error) {
      console.warn('CSS optimization failed:', error.message);
      return { optimized: false };
    }
  }

  /**
   * Optimize HTML files
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeHTML(asset) {
    try {
      const content = await fs.readFile(asset.path, 'utf8');
      const originalSize = content.length;
      
      // Basic HTML minification
      let optimized = content
        // Remove comments (but keep conditional comments)
        .replace(/<!--(?!\s*(?:\[if [^\]]+]|<!|>))[\s\S]*?-->/g, '')
        // Remove extra whitespace between tags
        .replace(/>\s+</g, '><')
        // Remove extra whitespace in attributes
        .replace(/\s+/g, ' ')
        .trim();
      
      if (optimized.length < originalSize * 0.9) {
        const optimizedPath = asset.path.replace(/\.html$/, '.min.html');
        await fs.writeFile(optimizedPath, optimized);
        
        return {
          optimized: true,
          newSize: optimized.length,
          savings: originalSize - optimized.length,
          outputPath: optimizedPath
        };
      }
      
      return { optimized: false };
    } catch (error) {
      console.warn('HTML optimization failed:', error.message);
      return { optimized: false };
    }
  }

  /**
   * Optimize JSON files
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeJSON(asset) {
    try {
      const content = await fs.readFile(asset.path, 'utf8');
      const data = JSON.parse(content);
      const optimized = JSON.stringify(data, null, 0);
      
      if (optimized.length < content.length * 0.9) {
        const optimizedPath = asset.path.replace(/\.json$/, '.min.json');
        await fs.writeFile(optimizedPath, optimized);
        
        return {
          optimized: true,
          newSize: optimized.length,
          savings: content.length - optimized.length,
          outputPath: optimizedPath
        };
      }
      
      return { optimized: false };
    } catch (error) {
      console.warn('JSON optimization failed:', error.message);
      return { optimized: false };
    }
  }

  /**
   * Optimize SVG files
   * @param {Object} asset - Asset metadata
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeSVG(asset) {
    try {
      const content = await fs.readFile(asset.path, 'utf8');
      const originalSize = content.length;
      
      // Basic SVG optimization
      let optimized = content
        // Remove comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Remove unnecessary attributes
        .replace(/\s+(version|xmlns:xlink|xml:space)="[^"]*"/g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove spaces around tags
        .replace(/>\s+</g, '><')
        .trim();
      
      if (optimized.length < originalSize * 0.9) {
        const optimizedPath = asset.path.replace(/\.svg$/, '.min.svg');
        await fs.writeFile(optimizedPath, optimized);
        
        return {
          optimized: true,
          newSize: optimized.length,
          savings: originalSize - optimized.length,
          outputPath: optimizedPath
        };
      }
      
      return { optimized: false };
    } catch (error) {
      console.warn('SVG optimization failed:', error.message);
      return { optimized: false };
    }
  }

  /**
   * Generate resource hints for preloading
   * @returns {Object} Resource hints
   */
  generateResourceHints() {
    const hints = {
      preload: [],
      prefetch: [],
      preconnect: []
    };
    
    // Core bundle should be preloaded
    const coreBundle = this.bundleMap.get('core') || [];
    for (const asset of coreBundle) {
      const assetInfo = this.cache.get(asset);
      if (assetInfo) {
        const ext = path.extname(asset).slice(1);
        const asMap = { js: 'script', css: 'style' };
        
        hints.preload.push({
          href: `/${asset}`,
          as: asMap[ext] || 'fetch',
          crossorigin: 'anonymous'
        });
      }
    }
    
    // Features can be prefetched
    const featuresBundle = this.bundleMap.get('features') || [];
    for (const asset of featuresBundle) {
      hints.prefetch.push({
        href: `/${asset}`,
        crossorigin: 'anonymous'
      });
    }
    
    // External domains should be preconnected
    hints.preconnect.push(
      { href: 'https://fonts.googleapis.com', crossorigin: 'anonymous' },
      { href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
      { href: 'https://cdnjs.cloudflare.com', crossorigin: 'anonymous' }
    );
    
    return hints;
  }

  /**
   * Get optimization report
   * @returns {Object} Optimization report
   */
  getOptimizationReport() {
    const report = {
      totalAssets: this.cache.size,
      optimizedAssets: 0,
      totalOriginalSize: 0,
      totalOptimizedSize: 0,
      totalSavings: 0,
      bundles: Array.from(this.bundleMap.keys()),
      assets: []
    };
    
    for (const [path, asset] of this.cache.entries()) {
      report.totalOriginalSize += asset.size;
      
      if (asset.optimized) {
        report.optimizedAssets++;
        report.totalOptimizedSize += asset.optimizedSize;
        report.totalSavings += asset.savings;
      } else {
        report.totalOptimizedSize += asset.size;
      }
      
      report.assets.push({
        path: path,
        originalSize: this.formatBytes(asset.size),
        optimizedSize: asset.optimized ? this.formatBytes(asset.optimizedSize) : 'Not optimized',
        savings: asset.optimized ? this.formatBytes(asset.savings) : '0 B',
        hash: asset.hash
      });
    }
    
    report.compressionRatio = ((report.totalSavings / report.totalOriginalSize) * 100).toFixed(2) + '%';
    
    return report;
  }

  /**
   * Format bytes for display
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    console.log('🧹 Cleaning up temporary optimization files...');
    
    // This would clean up any temporary files created during optimization
    // Implementation depends on specific cleanup needs
    
    console.log('✅ Cleanup completed');
  }
}

module.exports = {
  AssetOptimizer
};