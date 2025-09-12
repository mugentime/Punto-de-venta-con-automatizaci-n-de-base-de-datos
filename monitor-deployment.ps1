# Railway Deployment Monitor - POS Conejo Negro
# Real-time deployment status checker

Write-Host "📊 RAILWAY DEPLOYMENT MONITOR" -ForegroundColor Green
Write-Host "=" * 40

$ProjectId = "d395ae99-1dc9-4aae-96b6-0c805960665f"
$DashboardUrl = "https://railway.com/project/$ProjectId"

Write-Host ""
Write-Host "🎯 PROJECT: POS Conejo Negro" -ForegroundColor Yellow
Write-Host "Dashboard: $DashboardUrl"

Write-Host ""
Write-Host "🔍 DEPLOYMENT STATUS CHECK:" -ForegroundColor Cyan

# Check if Railway CLI is available and authenticated
Write-Host "1. Testing Railway CLI..." -ForegroundColor White
try {
    $statusOutput = railway status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Railway CLI connected" -ForegroundColor Green
        Write-Host "   Status: $statusOutput" -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "2. Getting recent logs..." -ForegroundColor White
        railway logs | Select-Object -Last 20
        
    } else {
        Write-Host "   ⚠️ Railway CLI not connected" -ForegroundColor Yellow
        Write-Host "   Output: $statusOutput" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Railway CLI error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🌐 WEB DASHBOARD MONITORING:" -ForegroundColor Magenta
Write-Host "Open this URL to monitor deployment in real-time:"
Write-Host "$DashboardUrl"

Write-Host ""
Write-Host "📋 WHAT TO CHECK IN DASHBOARD:" -ForegroundColor Cyan
Write-Host "1. Service Status:"
Write-Host "   • Look for green 'Deployed' badge"
Write-Host "   • Or yellow 'Building' status"
Write-Host "   • Red indicates failure"

Write-Host ""
Write-Host "2. Deployment Logs:"
Write-Host "   • Click 'Deployments' tab"
Write-Host "   • Click latest deployment"
Write-Host "   • Watch for build progress"

Write-Host ""
Write-Host "3. Expected Log Messages:" -ForegroundColor Green
Write-Host "   ✅ 'Cloning repository...'"
Write-Host "   ✅ 'Installing dependencies via npm...'"
Write-Host "   ✅ 'npm install completed successfully'"
Write-Host "   ✅ 'Starting application...'"
Write-Host "   ✅ 'Server running on port XXXX'"
Write-Host "   ✅ 'POS system initialized'"

Write-Host ""
Write-Host "4. Warning Signs:" -ForegroundColor Red
Write-Host "   ❌ 'Error: Missing environment variable'"
Write-Host "   ❌ 'npm install failed'"
Write-Host "   ❌ 'Application crashed'"
Write-Host "   ❌ 'Process exited with code 1'"
Write-Host "   ❌ 'Port binding failed'"

Write-Host ""
Write-Host "🔧 TROUBLESHOOTING STEPS:" -ForegroundColor Yellow
Write-Host "If deployment fails:"
Write-Host "1. Check environment variables are set"
Write-Host "2. Review build logs for specific errors"
Write-Host "3. Verify package.json start script"
Write-Host "4. Check for dependency conflicts"

Write-Host ""
Write-Host "⏱️ TYPICAL DEPLOYMENT TIME: 2-5 minutes" -ForegroundColor Cyan
Write-Host "Current time: $(Get-Date -Format 'HH:mm:ss')"

Write-Host ""
Write-Host "🔄 Run this script again to refresh status:"
Write-Host "   ./monitor-deployment.ps1" -ForegroundColor Yellow
