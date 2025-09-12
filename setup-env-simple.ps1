# TaskMaster Environment Setup Script
Write-Host "Setting up TaskMaster environment..." -ForegroundColor Green

# Set Render API Key
$env:RENDER_API_KEY = "rnd_dMWpJw8DdKqkT1iubRelI1EApbj0"

# Set project variables
$env:REPO_OWNER = "mugentime"
$env:REPO_NAME = "POS-CONEJONEGRO" 
$env:RENDER_SERVICE_ID = "srv-d2sf0q7diees738qcq3g"
$env:RENDER_SERVICE_NAME = "pos-conejo-negro"
$env:PRODUCTION_URL = "https://pos-conejo-negro.onrender.com"

Write-Host "Environment configured for TaskMaster operation" -ForegroundColor Green
Write-Host "Production URL: $env:PRODUCTION_URL" -ForegroundColor Cyan
Write-Host "Service ID: $env:RENDER_SERVICE_ID" -ForegroundColor Cyan

# Test API connectivity
Write-Host "Testing Render API connectivity..." -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer $env:RENDER_API_KEY"; "Accept" = "application/json" }
    $service = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$env:RENDER_SERVICE_ID" -Headers $headers
    Write-Host "Render API: Connected - Service Status: $($service.suspended)" -ForegroundColor Green
} catch {
    Write-Host "Render API: Connection failed" -ForegroundColor Red
}

Write-Host "TaskMaster environment ready!" -ForegroundColor Green
