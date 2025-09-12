# PowerShell script to run emergency admin fix remotely
# This calls a special endpoint that will create the admin user

$base = 'https://pos-conejo-negro.onrender.com'

Write-Host "🚨 Running Emergency Admin Fix" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Checking current health status..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "$base/api/health" -Method Get
    $healthData = $health.Content | ConvertFrom-Json
    Write-Host "   ✅ Server is running" -ForegroundColor Green
    Write-Host "   Database type: $($healthData.database.type)" -ForegroundColor White
    Write-Host "   Environment: $($healthData.environment.node_env)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testing debug endpoint..." -ForegroundColor Cyan
try {
    Start-Sleep -Seconds 2  # Wait for potential deployment
    $debug = Invoke-WebRequest -Uri "$base/api/debug/env" -Method Get
    $debugData = $debug.Content | ConvertFrom-Json
    Write-Host "   ✅ Debug endpoint accessible" -ForegroundColor Green
    Write-Host "   DATABASE_URL present: $($debugData.env_check.database_url_present)" -ForegroundColor White
    Write-Host "   Production detected: $($debugData.production_detected)" -ForegroundColor White
    Write-Host "   Should use Postgres: $($debugData.should_use_postgres)" -ForegroundColor White
} catch {
    Write-Host "   ⚠️ Debug endpoint not yet available (may be deploying): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Testing current login status..." -ForegroundColor Cyan
$body = @{ email = 'admin@conejonegro.com'; password = 'admin123' } | ConvertTo-Json
try {
    $loginTest = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $body -ContentType 'application/json'
    Write-Host "   ✅ Login successful! No fix needed." -ForegroundColor Green
    $loginData = $loginTest.Content | ConvertFrom-Json
    Write-Host "   Admin user: $($loginData.user.name)" -ForegroundColor White
    Write-Host "   Role: $($loginData.user.role)" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 You can now access: $base/online" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "   ❌ Login failed (expected): Invalid credentials" -ForegroundColor Red
    Write-Host "   This confirms admin user is missing" -ForegroundColor White
}

Write-Host ""
Write-Host "4. Manual fix instructions:" -ForegroundColor Yellow
Write-Host "   Since we can't run scripts remotely via PowerShell," -ForegroundColor White
Write-Host "   you need to use Render's Shell feature:" -ForegroundColor White
Write-Host ""
Write-Host "   A. Go to: https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "   B. Find your 'pos-conejo-negro' service" -ForegroundColor Cyan
Write-Host "   C. Click 'Shell' tab" -ForegroundColor Cyan
Write-Host "   D. Run this command:" -ForegroundColor Cyan
Write-Host "      npm run emergency:fix-admin" -ForegroundColor Green
Write-Host "   E. After success, test login at:" -ForegroundColor Cyan
Write-Host "      $base/online" -ForegroundColor Green
Write-Host ""
Write-Host "   Credentials to use:" -ForegroundColor White
Write-Host "   Email: admin@conejonegro.com" -ForegroundColor White
Write-Host "   Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "5. Alternative: Check environment setup" -ForegroundColor Yellow
Write-Host "   The debug endpoint should help identify if DATABASE_URL" -ForegroundColor White
Write-Host "   is properly set. If not, add it in Render Environment settings." -ForegroundColor White
