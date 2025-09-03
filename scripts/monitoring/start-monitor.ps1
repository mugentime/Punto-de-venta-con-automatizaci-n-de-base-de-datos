# Railway Monitor Service - PowerShell Starter
# This script starts the monitoring service and keeps it running

Write-Host "Starting Railway Monitor Service..." -ForegroundColor Green

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

do {
    Write-Host "[$(Get-Date)] Starting monitor service..." -ForegroundColor Yellow
    
    # Start the monitoring service
    $process = Start-Process -FilePath "node" -ArgumentList "monitor-service.js start" -NoNewWindow -PassThru -Wait
    
    if ($process.ExitCode -ne 0) {
        Write-Host "[$(Get-Date)] Monitor service stopped with exit code $($process.ExitCode). Restarting in 5 seconds..." -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
    
} while ($process.ExitCode -ne 0)