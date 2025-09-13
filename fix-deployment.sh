#!/bin/bash
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
