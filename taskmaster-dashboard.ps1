# TaskMaster Operational Dashboard
# Quick status overview and control interface

param(
    [string]$Action = "status"
)

. .\setup-env.ps1

function Show-TaskMasterStatus {
    Write-Host "`n🎯 TaskMaster Operational Dashboard" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Gray
    
    # Check TaskMaster Agent Process
    Write-Host "`n📊 Agent Status:" -ForegroundColor Yellow
    $taskmaster = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq 13060 }
    if ($taskmaster) {
        Write-Host "✅ TaskMaster Agent: RUNNING (PID: $($taskmaster.Id))" -ForegroundColor Green
        Write-Host "   Memory: $([math]::Round($taskmaster.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
    } else {
        Write-Host "❌ TaskMaster Agent: NOT RUNNING" -ForegroundColor Red
    }
    
    # Check Production Health
    Write-Host "`n🌐 Production Health:" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$env:PRODUCTION_URL/api/health" -TimeoutSec 10
        $health = $response.Content | ConvertFrom-Json
        Write-Host "✅ Production: HEALTHY ($($response.StatusCode))" -ForegroundColor Green
        Write-Host "   Uptime: $([math]::Round($health.uptime, 2)) seconds" -ForegroundColor Gray
        Write-Host "   Environment: $($health.environment.node_env)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Production: UNHEALTHY" -ForegroundColor Red
    }
    
    # Check Latest Deployment
    Write-Host "`n🚀 Latest Deployment:" -ForegroundColor Yellow
    try {
        $headers = @{ "Authorization" = "Bearer $env:RENDER_API_KEY" }
        $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$env:RENDER_SERVICE_ID/deploys" -Headers $headers
        $latest = $deploys.deploy[0]
        Write-Host "✅ Status: $($latest.status.ToUpper())" -ForegroundColor Green
        Write-Host "   Commit: $($latest.commit.id.Substring(0,7))" -ForegroundColor Gray
        Write-Host "   Finished: $($latest.finishedAt)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Unable to fetch deployment status" -ForegroundColor Red
    }
    
    # Show Recent Activity
    Write-Host "`n📋 Recent Monitoring Activity:" -ForegroundColor Yellow
    $today = Get-Date -Format "yyyy-MM-dd"
    $healthFile = "analysis/health-check-$today.json"
    if (Test-Path $healthFile) {
        $healthData = Get-Content $healthFile | ConvertFrom-Json
        $latestCheck = $healthData[-1]
        Write-Host "   Last Health Check: $($latestCheck.timestamp)" -ForegroundColor Gray
        Write-Host "   Check #$($latestCheck.cycle)" -ForegroundColor Gray
    }
    
    Write-Host "`n🎮 Commands:" -ForegroundColor Cyan
    Write-Host "   ./taskmaster-dashboard.ps1 -Action restart  # Restart agent" -ForegroundColor Gray
    Write-Host "   ./taskmaster-dashboard.ps1 -Action logs     # View logs" -ForegroundColor Gray
    Write-Host "   ./taskmaster-dashboard.ps1 -Action health   # Force health check" -ForegroundColor Gray
    Write-Host ""
}

function Restart-TaskMaster {
    Write-Host "🔄 Restarting TaskMaster Agent..." -ForegroundColor Yellow
    
    # Stop existing process
    $existing = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq 13060 }
    if ($existing) {
        Stop-Process -Id $existing.Id -Force
        Write-Host "✅ Stopped existing agent (PID: $($existing.Id))" -ForegroundColor Green
    }
    
    # Start new process
    Start-Sleep -Seconds 2
    $newProcess = Start-Process -FilePath "node" -ArgumentList "taskmaster-monitor.js" -WindowStyle Hidden -PassThru
    Write-Host "✅ Started new agent (PID: $($newProcess.Id))" -ForegroundColor Green
}

function Show-Logs {
    Write-Host "📋 Latest TaskMaster Activity:" -ForegroundColor Cyan
    $today = Get-Date -Format "yyyy-MM-dd"
    
    # Health Check Logs
    $healthFile = "analysis/health-check-$today.json"
    if (Test-Path $healthFile) {
        Write-Host "`n🔍 Health Checks:" -ForegroundColor Yellow
        $healthData = Get-Content $healthFile | ConvertFrom-Json
        $healthData[-3..-1] | ForEach-Object {
            Write-Host "   [$($_.timestamp)] Cycle $($_.cycle)" -ForegroundColor Gray
            foreach ($check in $_.checks.PSObject.Properties) {
                $status = if ($check.Value.status -eq "OK") { "✅" } else { "❌" }
                Write-Host "     $status $($check.Name): $($check.Value.status)" -ForegroundColor Gray
            }
        }
    }
    
    # Deployment Logs
    $deployFile = "analysis/deployment-check-$today.json"
    if (Test-Path $deployFile) {
        Write-Host "`n🚀 Deployments:" -ForegroundColor Yellow
        $deployData = Get-Content $deployFile | ConvertFrom-Json
        $deployData[-2..-1] | ForEach-Object {
            Write-Host "   [$($_.timestamp)] Branch: $($_.localGit.branch)" -ForegroundColor Gray
            Write-Host "     Latest: $($_.localGit.latestCommit)" -ForegroundColor Gray
        }
    }
}

function Force-HealthCheck {
    Write-Host "🔍 Performing manual health check..." -ForegroundColor Yellow
    
    # Check all endpoints
    $endpoints = @(
        @{Name="Local"; Url="http://localhost:3000"},
        @{Name="Production"; Url="$env:PRODUCTION_URL"}
    )
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint.Url -TimeoutSec 10
            Write-Host "✅ $($endpoint.Name): $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "❌ $($endpoint.Name): Failed" -ForegroundColor Red
        }
    }
}

# Execute based on action
switch ($Action.ToLower()) {
    "restart" { Restart-TaskMaster }
    "logs" { Show-Logs }
    "health" { Force-HealthCheck }
    default { Show-TaskMasterStatus }
}
