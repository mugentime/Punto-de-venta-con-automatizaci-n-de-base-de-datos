# Railway Deployment Management Script
# POS Conejo Negro - Railway Deployment Checker

Write-Host "🚀 RAILWAY DEPLOYMENT MANAGEMENT" -ForegroundColor Green
Write-Host "=" * 50

# Project Information
$ProjectId = "d395ae99-1dc9-4aae-96b6-0c805960665f"
$EnvironmentId = "acb9242e-ade0-499d-abc7-6dbe494c528a"
$ProjectUrl = "https://railway.com/project/$ProjectId"

Write-Host ""
Write-Host "📋 PROJECT INFORMATION:" -ForegroundColor Yellow
Write-Host "   Project ID: $ProjectId"
Write-Host "   Environment ID: $EnvironmentId"
Write-Host "   Project URL: $ProjectUrl"

Write-Host ""
Write-Host "🔧 RAILWAY CLI SETUP STEPS:" -ForegroundColor Cyan
Write-Host "1. Login to Railway CLI:"
Write-Host "   railway login"
Write-Host ""
Write-Host "2. Link to your project:"
Write-Host "   railway link"
Write-Host "   (Select your POS-CONEJONEGRO project from the list)"
Write-Host ""
Write-Host "3. Check deployment status:"
Write-Host "   railway status"
Write-Host ""
Write-Host "4. View logs:"
Write-Host "   railway logs"
Write-Host ""
Write-Host "5. Check environment variables:"
Write-Host "   railway variables"
Write-Host ""
Write-Host "6. Get your deployment URL:"
Write-Host "   railway domain"

Write-Host ""
Write-Host "🌐 WEB INTERFACE ACTIONS:" -ForegroundColor Magenta
Write-Host "1. Open project dashboard: $ProjectUrl"
Write-Host "2. Check deployment logs in the web interface"
Write-Host "3. Set environment variables if needed:"
Write-Host "   - JWT_SECRET: (strong random 32+ character string)"
Write-Host "   - NODE_ENV: production"

Write-Host ""
Write-Host "⚡ QUICK COMMANDS:" -ForegroundColor Green
Write-Host "Login and link to project:"
Write-Host "   railway login && railway link"

Write-Host ""
Write-Host "Check deployment status:"
Write-Host "   railway status && railway logs"

Write-Host ""
Write-Host "🎯 EXPECTED DEPLOYMENT OUTCOME:" -ForegroundColor Yellow
Write-Host "   ✅ Node.js detected automatically"
Write-Host "   ✅ Dependencies installed (npm install)"
Write-Host "   ✅ Application started with 'npm start'"
Write-Host "   ✅ POS system accessible via Railway URL"

# Try to ping Railway to check connectivity
Write-Host ""
Write-Host "🔍 CONNECTIVITY CHECK:" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://railway.app" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Railway.app is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️ Could not reach Railway.app - check internet connection" -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 READY TO DEPLOY!" -ForegroundColor Green
Write-Host "Follow the CLI setup steps above or use the Railway web interface."
