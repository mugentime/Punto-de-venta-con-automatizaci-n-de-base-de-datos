# Setup script for Warp Spanish Voice Response Webhook
# This adds Spanish voice responses to Warp terminal when commands complete

Write-Host "🎯 Setting up Warp Spanish Voice Response Webhook..." -ForegroundColor Cyan
Write-Host ""

$webhookUrl = "http://localhost:3456/warp/"
$scriptDir = $PWD.Path
$webhookScript = Join-Path $scriptDir "warp-webhook-simple.ps1"

# Check if webhook script exists
if (-not (Test-Path $webhookScript)) {
    Write-Host "❌ Webhook script not found: $webhookScript" -ForegroundColor Red
    Write-Host "Make sure warp-webhook-simple.ps1 is in the current directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found webhook script: $webhookScript" -ForegroundColor Green

# Check if we need URL ACL permission
Write-Host "🔍 Checking HTTP listener permissions..." -ForegroundColor Yellow
try {
    $testListener = New-Object System.Net.HttpListener
    $testListener.Prefixes.Add($webhookUrl)
    $testListener.Start()
    $testListener.Stop()
    Write-Host "✅ HTTP listener permissions OK" -ForegroundColor Green
} catch {
    Write-Host "⚠️ HTTP listener needs permission. Run this as Administrator:" -ForegroundColor Yellow
    Write-Host "   netsh http add urlacl url=$webhookUrl user=$env:USERNAME" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "❓ Continue anyway? (Y/N)" -ForegroundColor Yellow -NoNewline
    $continue = Read-Host
    if ($continue -notmatch '^(y|yes)$') {
        Write-Host "Cancelled." -ForegroundColor Red
        exit 1
    }
}

# Stop any existing webhook job
Write-Host "🛑 Stopping any existing webhook jobs..." -ForegroundColor Yellow
Get-Job | Where-Object { $_.Name -like "*WarpWebhook*" } | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Where-Object { $_.Name -like "*WarpWebhook*" } | Remove-Job -ErrorAction SilentlyContinue

# Start the webhook server
Write-Host "🚀 Starting Warp webhook server with Spanish TTS..." -ForegroundColor Green
$job = Start-Job -ScriptBlock {
    param($scriptPath)
    Set-Location (Split-Path $scriptPath -Parent)
    & $scriptPath -Speak
} -ArgumentList $webhookScript -Name "WarpWebhookVoice"

Start-Sleep -Seconds 2

# Check if job is running
if ($job.State -eq "Running") {
    Write-Host "✅ Webhook server started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
    Write-Host "   • Webhook URL: $webhookUrl" -ForegroundColor White
    Write-Host "   • Spanish TTS: Enabled" -ForegroundColor White
    Write-Host "   • Job Name: WarpWebhookVoice" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Open Warp Terminal" -ForegroundColor White
    Write-Host "   2. Go to Settings > Advanced" -ForegroundColor White  
    Write-Host "   3. Find 'Webhooks' or 'Command Completion' section" -ForegroundColor White
    Write-Host "   4. Add webhook URL: $webhookUrl" -ForegroundColor Cyan
    Write-Host "   5. Enable for 'Command Completion' events" -ForegroundColor White
    Write-Host ""
    Write-Host "🧪 Test the webhook:" -ForegroundColor Yellow
    Write-Host "   Invoke-RestMethod -Uri '$webhookUrl' -Method POST -Body '{\"command\":\"test\",\"exit_code\":0,\"output\":\"Hello\"}' -ContentType 'application/json'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📊 Monitor logs:" -ForegroundColor Yellow
    Write-Host "   Get-Job -Name 'WarpWebhookVoice' | Receive-Job" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🛑 Stop the webhook:" -ForegroundColor Yellow
    Write-Host "   Get-Job -Name 'WarpWebhookVoice' | Stop-Job; Get-Job -Name 'WarpWebhookVoice' | Remove-Job" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to start webhook server" -ForegroundColor Red
    $job | Receive-Job
    $job | Remove-Job
    exit 1
}

Write-Host ""
Write-Host "🎉 Setup complete! Your Warp terminal will now speak in Spanish when commands finish!" -ForegroundColor Green
