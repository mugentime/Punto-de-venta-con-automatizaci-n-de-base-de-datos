#!/usr/bin/env node

/**
 * POS Post-Change Validation Protocol
 * Automatically executes after any code change or commit
 * Prevents deployment failures by validating each step
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class POSValidationProtocol {
  constructor() {
    this.projectRoot = process.cwd();
    this.protocolConfig = this.loadProtocolConfig();
    this.memoryPath = path.join(this.projectRoot, '.hive-mind', 'validation-memory.json');
    this.logPath = path.join(this.projectRoot, '.hive-mind', 'validation-logs.json');
  }

  loadProtocolConfig() {
    try {
      const configPath = path.join(this.projectRoot, '.hive-mind', 'post-change-protocol.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load protocol config:', error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      validation_sequence: [
        { step: 1, name: "Git Status Check", commands: ["git status", "git log --oneline -5"] },
        { step: 2, name: "Railway Push Verification", commands: ["git push origin main", "railway logs --deployment"] },
        { step: 3, name: "Deployment Health Check", commands: ["railway logs --service POS-CONEJONEGRO | head -20", "railway status"] }
      ]
    };
  }

  async executeCommand(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const process = exec(command, { cwd: this.projectRoot, timeout });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => stdout += data);
      process.stderr?.on('data', (data) => stderr += data);
      
      process.on('close', (code) => {
        resolve({
          command,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0,
          timestamp: new Date().toISOString()
        });
      });
      
      process.on('error', (error) => {
        reject({
          command,
          error: error.message,
          success: false,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  async executeValidationSequence() {
    console.log('🚀 Starting POS Post-Change Validation Protocol...');
    
    const results = {
      protocol_run_id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      steps: [],
      overall_status: 'running',
      issues: [],
      performance_metrics: {}
    };

    // Execute pre-validation hooks
    await this.executeHooks('pre_validation');

    for (const step of this.protocolConfig.validation_sequence) {
      console.log(`\n📋 Step ${step.step}: ${step.name}`);
      
      const stepResult = {
        step_number: step.step,
        step_name: step.name,
        commands: [],
        status: 'pending',
        issues: [],
        start_time: new Date().toISOString()
      };

      for (const command of step.commands) {
        console.log(`   Executing: ${command}`);
        
        try {
          const cmdResult = await this.executeCommand(command);
          stepResult.commands.push(cmdResult);
          
          if (!cmdResult.success) {
            stepResult.issues.push(`Command failed: ${command} (exit code: ${cmdResult.code})`);
            if (cmdResult.stderr) {
              stepResult.issues.push(`Error: ${cmdResult.stderr}`);
            }
          }
          
          // Check for critical patterns
          this.checkCriticalPatterns(cmdResult, stepResult);
          
        } catch (error) {
          stepResult.issues.push(`Command error: ${command} - ${error.error || error.message}`);
          stepResult.commands.push(error);
        }
      }
      
      stepResult.end_time = new Date().toISOString();
      stepResult.status = stepResult.issues.length === 0 ? 'success' : 'failure';
      results.steps.push(stepResult);
      
      // Log step completion
      console.log(`   ✅ Step ${step.step} completed: ${stepResult.status}`);
      if (stepResult.issues.length > 0) {
        console.log(`   ⚠️  Issues found: ${stepResult.issues.length}`);
        stepResult.issues.forEach(issue => console.log(`      - ${issue}`));
      }
    }

    // Determine overall status
    results.overall_status = results.steps.every(step => step.status === 'success') ? 'success' : 'failure';
    results.end_time = new Date().toISOString();
    
    // Collect all issues
    results.issues = results.steps.flatMap(step => step.issues);
    
    // Save results to memory
    await this.saveToMemory(results);
    
    // Execute post-validation hooks
    await this.executeHooks('post_validation', results);
    
    // Final summary
    console.log(`\n🎯 Validation Protocol Complete: ${results.overall_status.toUpperCase()}`);
    console.log(`   Total Steps: ${results.steps.length}`);
    console.log(`   Successful: ${results.steps.filter(s => s.status === 'success').length}`);
    console.log(`   Issues Found: ${results.issues.length}`);
    
    if (results.issues.length > 0) {
      console.log('\n🚨 Issues Summary:');
      results.issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }
    
    return results;
  }

  checkCriticalPatterns(cmdResult, stepResult) {
    const criticalPatterns = this.protocolConfig.critical_watchpoints || {};
    
    const output = (cmdResult.stdout + ' ' + cmdResult.stderr).toLowerCase();
    
    // Check for auth middleware loops
    if (output.includes('middleware') && output.includes('loop')) {
      stepResult.issues.push('🚨 CRITICAL: Auth middleware infinite loop detected');
    }
    
    // Check for database connection failures
    if (output.includes('econnrefused') || output.includes('connection failed')) {
      stepResult.issues.push('🚨 CRITICAL: Database connection failure detected');
    }
    
    // Check for deployment timeouts
    if (output.includes('timeout') && output.includes('deploy')) {
      stepResult.issues.push('⚠️  HIGH: Deployment timeout detected');
    }
    
    // Check for server startup success
    if (output.includes('server listening') || output.includes('listening on port')) {
      stepResult.success_indicators = stepResult.success_indicators || [];
      stepResult.success_indicators.push('Server startup confirmed');
    }
  }

  async executeHooks(hookType, data = null) {
    const hooks = this.protocolConfig.integration_hooks?.[hookType] || [];
    
    for (const hook of hooks) {
      try {
        console.log(`🔗 Executing ${hookType} hook: ${hook}`);
        await this.executeCommand(hook);
      } catch (error) {
        console.warn(`⚠️  Hook failed (non-critical): ${hook}`);
      }
    }
  }

  async saveToMemory(results) {
    try {
      // Load existing memory
      let memory = {};
      if (fs.existsSync(this.memoryPath)) {
        memory = JSON.parse(fs.readFileSync(this.memoryPath, 'utf8'));
      }
      
      // Update memory with new results
      const memoryKey = `validation_${results.protocol_run_id}`;
      memory[memoryKey] = results;
      
      // Keep only last 50 validations
      const keys = Object.keys(memory).filter(k => k.startsWith('validation_'));
      if (keys.length > 50) {
        keys.sort().slice(0, -50).forEach(key => delete memory[key]);
      }
      
      // Save updated memory
      fs.writeFileSync(this.memoryPath, JSON.stringify(memory, null, 2));
      
      // Also save to logs
      const logEntry = {
        timestamp: results.timestamp,
        status: results.overall_status,
        issues_count: results.issues.length,
        steps_count: results.steps.length
      };
      
      let logs = [];
      if (fs.existsSync(this.logPath)) {
        logs = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
      }
      logs.push(logEntry);
      
      // Keep only last 200 log entries
      if (logs.length > 200) {
        logs = logs.slice(-200);
      }
      
      fs.writeFileSync(this.logPath, JSON.stringify(logs, null, 2));
      
      console.log(`💾 Results saved to hive-mind memory: ${memoryKey}`);
      
    } catch (error) {
      console.error('Failed to save validation results to memory:', error.message);
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const protocol = new POSValidationProtocol();
  
  protocol.executeValidationSequence()
    .then(results => {
      process.exit(results.overall_status === 'success' ? 0 : 1);
    })
    .catch(error => {
      console.error('Protocol execution failed:', error);
      process.exit(1);
    });
}

module.exports = POSValidationProtocol;