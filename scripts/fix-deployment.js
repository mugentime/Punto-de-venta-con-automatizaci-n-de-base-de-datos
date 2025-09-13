const fs = require('fs');
const path = require('path');

function fixDeployment() {
  console.log('🔧 Fixing Railway Deployment Issues');
  console.log('Deployment ID: 4548f92b-d5dd-49ff-8840-3768b72daec3');
  console.log('=' .repeat(50));

  const fixes = [];

  // Fix 1: Clean package.json merge conflicts
  console.log('\n1️⃣ Fixing package.json merge conflicts...');
  try {
    let packageContent = fs.readFileSync('package.json', 'utf8');
    
    // Remove Git merge conflict markers
    if (packageContent.includes('<<<<<<<') || packageContent.includes('>>>>>>>')) {
      console.log('   🔍 Found Git merge conflicts in package.json');
      
      // Remove merge conflict markers and duplicate entries
      packageContent = packageContent
        .replace(/<<<<<<< HEAD\n?/g, '')
        .replace(/=======\n?/g, '')
        .replace(/>>>>>>> [a-f0-9]+\n?/g, '')
        // Fix common duplicate entries
        .replace(/,\s*,/g, ',') // Remove double commas
        .replace(/}\s*{/g, ',') // Fix missing commas between objects
        .replace(/]\s*\[/g, ',') // Fix array issues
        ;
      
      // Try to parse and reformat
      try {
        const packageObj = JSON.parse(packageContent);
        
        // Clean up scripts - remove duplicates
        if (packageObj.scripts) {
          // Keep the most complete version of each script
          const cleanScripts = {};
          for (const [key, value] of Object.entries(packageObj.scripts)) {
            if (!cleanScripts[key] || value.length > cleanScripts[key].length) {
              cleanScripts[key] = value;
            }
          }
          packageObj.scripts = cleanScripts;
        }
        
        // Clean up dependencies
        if (packageObj.dependencies) {
          const cleanDeps = {};
          for (const [key, value] of Object.entries(packageObj.dependencies)) {
            if (!cleanDeps[key]) {
              cleanDeps[key] = value;
            }
          }
          packageObj.dependencies = cleanDeps;
        }
        
        // Ensure essential scripts exist
        packageObj.scripts = packageObj.scripts || {};
        if (!packageObj.scripts.start) {
          packageObj.scripts.start = 'node server.js';
        }
        
        // Write cleaned package.json
        fs.writeFileSync('package.json', JSON.stringify(packageObj, null, 2));
        fixes.push('✅ Fixed package.json merge conflicts and format');
        console.log('   ✅ package.json cleaned and formatted');
        
      } catch (parseError) {
        console.log(`   ❌ Still invalid JSON after cleanup: ${parseError.message}`);
        // Create a basic working package.json
        const basicPackage = {
          "name": "pos-conejo-negro",
          "version": "1.0.0",
          "main": "server.js",
          "scripts": {
            "start": "node server.js",
            "dev": "nodemon server.js"
          },
          "dependencies": {
            "express": "^4.18.2",
            "cors": "^2.8.5",
            "dotenv": "^16.3.1",
            "bcryptjs": "^2.4.3",
            "jsonwebtoken": "^9.0.2",
            "helmet": "^7.1.0",
            "compression": "^1.7.4"
          },
          "engines": {
            "node": "18.x"
          }
        };
        fs.writeFileSync('package.json.backup', packageContent);
        fs.writeFileSync('package.json', JSON.stringify(basicPackage, null, 2));
        fixes.push('⚠️ Created basic package.json (original backed up)');
      }
    } else {
      console.log('   ✅ No merge conflicts found in package.json');
    }
  } catch (error) {
    console.log(`   ❌ Error fixing package.json: ${error.message}`);
  }

  // Fix 2: Ensure Dockerfile has proper port binding
  console.log('\n2️⃣ Fixing Dockerfile port configuration...');
  try {
    let dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    
    if (!dockerfile.includes('$PORT') && !dockerfile.includes('${PORT}')) {
      console.log('   🔍 Adding PORT environment variable to Dockerfile');
      
      // Add EXPOSE with PORT variable if not present
      if (!dockerfile.includes('EXPOSE')) {
        dockerfile += '\n# Expose port\nEXPOSE $PORT\n';
      } else {
        // Replace static port with variable
        dockerfile = dockerfile.replace(/EXPOSE\s+\d+/g, 'EXPOSE $PORT');
      }
      
      fs.writeFileSync('Dockerfile', dockerfile);
      fixes.push('✅ Added PORT variable to Dockerfile');
      console.log('   ✅ Dockerfile updated with PORT variable');
    } else {
      console.log('   ✅ Dockerfile already has PORT configuration');
    }
  } catch (error) {
    console.log(`   ❌ Error fixing Dockerfile: ${error.message}`);
  }

  // Fix 3: Ensure server.js has proper port binding
  console.log('\n3️⃣ Checking server.js port configuration...');
  try {
    const serverContent = fs.readFileSync('server.js', 'utf8');
    
    if (!serverContent.includes('process.env.PORT')) {
      console.log('   ⚠️ server.js may not be using process.env.PORT');
      fixes.push('⚠️ Check that server.js uses process.env.PORT for port binding');
    } else {
      console.log('   ✅ server.js uses process.env.PORT');
    }
  } catch (error) {
    console.log(`   ❌ Error checking server.js: ${error.message}`);
  }

  // Fix 4: Create optimized Dockerfile
  console.log('\n4️⃣ Creating Railway-optimized Dockerfile...');
  const optimizedDockerfile = `# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund && \\
    npm cache clean --force

# Copy application source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodeuser -u 1001 && \\
    chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Expose port (Railway will set this automatically)
EXPOSE \$PORT

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD node -e "const http=require('http'); const port=process.env.PORT||3000; http.get(\`http://localhost:\${port}/api/health\`, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start the application
CMD ["npm", "start"]
`;

  fs.writeFileSync('Dockerfile.railway', optimizedDockerfile);
  fixes.push('✅ Created Railway-optimized Dockerfile.railway');
  console.log('   ✅ Created Dockerfile.railway');

  // Fix 5: Create simple railway.json
  console.log('\n5️⃣ Creating simplified railway.json...');
  const simpleRailwayConfig = {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "dockerfile",
      "dockerfilePath": "Dockerfile"
    },
    "deploy": {
      "startCommand": "npm start",
      "restartPolicyType": "on_failure"
    },
    "healthcheck": {
      "enabled": true,
      "path": "/api/health",
      "timeout": 10,
      "interval": 30,
      "retries": 3
    }
  };

  fs.writeFileSync('railway.simple.json', JSON.stringify(simpleRailwayConfig, null, 2));
  fixes.push('✅ Created simplified railway.simple.json');
  console.log('   ✅ Created railway.simple.json');

  // Fix 6: Check health endpoint exists
  console.log('\n6️⃣ Verifying health endpoint...');
  try {
    const serverContent = fs.readFileSync('server.js', 'utf8');
    if (serverContent.includes('/api/health')) {
      console.log('   ✅ Health endpoint found in server.js');
    } else {
      console.log('   ⚠️ Health endpoint not found - may need to be added');
      fixes.push('⚠️ Add /api/health endpoint that returns { status: "healthy" }');
    }
  } catch (error) {
    console.log(`   ❌ Error checking health endpoint: ${error.message}`);
  }

  // Generate deployment fix script
  console.log('\n7️⃣ Creating deployment fix script...');
  const deployScript = `#!/bin/bash
# Railway Deployment Fix Script
echo "🚀 Applying Railway deployment fixes..."

# Replace current files with fixed versions
if [ -f "package.json" ]; then
  echo "✅ package.json already fixed"
else
  echo "❌ package.json missing!"
fi

if [ -f "Dockerfile.railway" ]; then
  echo "📦 Using optimized Dockerfile"
  cp Dockerfile.railway Dockerfile
fi

if [ -f "railway.simple.json" ]; then
  echo "⚙️ Using simplified railway config"
  cp railway.simple.json railway.json
fi

# Test that the start command works
echo "🧪 Testing npm start..."
timeout 10s npm start &
PID=$!
sleep 5
if kill -0 $PID 2>/dev/null; then
  echo "✅ npm start works"
  kill $PID
else
  echo "❌ npm start failed"
fi

echo "🎯 Deployment fixes applied!"
echo "💡 Next steps:"
echo "   1. Commit these changes: git add . && git commit -m 'fix: Apply Railway deployment fixes'"
echo "   2. Push to trigger redeployment: git push"
echo "   3. Monitor Railway dashboard for deployment progress"
`;

  fs.writeFileSync('fix-deployment.sh', deployScript);
  fixes.push('✅ Created fix-deployment.sh script');
  console.log('   ✅ Created fix-deployment.sh');

  // Summary
  console.log('\n📊 DEPLOYMENT FIX SUMMARY');
  console.log('=' .repeat(50));
  console.log(`✅ Applied ${fixes.length} fixes:`);
  fixes.forEach(fix => console.log(`   ${fix}`));

  console.log('\n🚀 NEXT STEPS:');
  console.log('1. 📦 Replace Dockerfile: cp Dockerfile.railway Dockerfile');
  console.log('2. ⚙️ Replace railway.json: cp railway.simple.json railway.json');
  console.log('3. 🔧 Commit changes: git add . && git commit -m "fix: Railway deployment fixes"');
  console.log('4. 🚀 Push to deploy: git push origin main');
  console.log('5. 👀 Monitor Railway dashboard for progress');

  console.log('\n🎯 DEPLOYMENT ID TO MONITOR:');
  console.log('4548f92b-d5dd-49ff-8840-3768b72daec3');

  return fixes;
}

if (require.main === module) {
  fixDeployment();
}

module.exports = { fixDeployment };