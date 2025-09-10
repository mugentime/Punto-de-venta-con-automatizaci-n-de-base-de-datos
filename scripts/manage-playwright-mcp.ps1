param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

$PID_FILE = ".\.mcp.playwright.pid"
$LOG_OUT = ".\logs\playwright-mcp.out.log"
$LOG_ERR = ".\logs\playwright-mcp.err.log"

function Start-PlaywrightMCP {
    if (Test-Path $PID_FILE) {
        $existingPid = Get-Content $PID_FILE -ErrorAction SilentlyContinue
        if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
            Write-Host "[OK] Playwright MCP server is already running (PID: $existingPid)" -ForegroundColor Green
            return
        }
    }
    
    Write-Host "[START] Starting Playwright MCP server..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path .\logs | Out-Null
    
    $p = Start-Process -FilePath "powershell.exe" -ArgumentList "-Command", "npm run mcp:playwright" -WindowStyle Minimized -RedirectStandardOutput $LOG_OUT -RedirectStandardError $LOG_ERR -PassThru
    $p.Id | Set-Content $PID_FILE
    
    # Wait a moment and check if it's running
    Start-Sleep -Seconds 3
    if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) {
        Write-Host "[OK] Playwright MCP server started successfully (PID: $($p.Id))" -ForegroundColor Green
        Write-Host "   Listening on: http://localhost:3001/mcp" -ForegroundColor Cyan
        Write-Host "   Logs: $LOG_OUT, $LOG_ERR" -ForegroundColor Gray
    } else {
        Write-Host "[FAIL] Failed to start Playwright MCP server" -ForegroundColor Red
        if (Test-Path $LOG_ERR) {
            Write-Host "Last few lines from error log:" -ForegroundColor Red
            Get-Content $LOG_ERR -Tail 5
        }
    }
}

function Stop-PlaywrightMCP {
    if (-not (Test-Path $PID_FILE)) {
        Write-Host "[INFO] No PID file found. Server may not be running." -ForegroundColor Yellow
        return
    }
    
    $serverPid = Get-Content $PID_FILE -ErrorAction SilentlyContinue
    if (-not $serverPid) {
        Write-Host "[INFO] Empty PID file. Cleaning up." -ForegroundColor Yellow
        Remove-Item $PID_FILE -Force
        return
    }
    
    $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "[STOP] Stopping Playwright MCP server (PID: $serverPid)..." -ForegroundColor Yellow
        Stop-Process -Id $serverPid -Force
        Start-Sleep -Seconds 2
        
        if (-not (Get-Process -Id $serverPid -ErrorAction SilentlyContinue)) {
            Write-Host "[OK] Playwright MCP server stopped successfully" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Server may still be running" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Process not found. Server was not running." -ForegroundColor Yellow
    }
    
    Remove-Item $PID_FILE -Force -ErrorAction SilentlyContinue
}

function Get-PlaywrightMCPStatus {
    if (-not (Test-Path $PID_FILE)) {
        Write-Host "[FAIL] Playwright MCP server is not running (no PID file)" -ForegroundColor Red
        return
    }
    
    $serverPid = Get-Content $PID_FILE -ErrorAction SilentlyContinue
    if (-not $serverPid) {
        Write-Host "[FAIL] Playwright MCP server is not running (empty PID file)" -ForegroundColor Red
        return
    }
    
    $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "[OK] Playwright MCP server is running (PID: $serverPid)" -ForegroundColor Green
        Write-Host "   Process: $($process.ProcessName)" -ForegroundColor Gray
        Write-Host "   Start Time: $($process.StartTime)" -ForegroundColor Gray
        
        # Test if the port is listening
        $connection = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
        if ($connection) {
            Write-Host "   Port 3001: [OK] Listening" -ForegroundColor Green
        } else {
            Write-Host "   Port 3001: [FAIL] Not listening" -ForegroundColor Red
        }
        
        # Test MCP endpoint
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/mcp" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            Write-Host "   MCP Endpoint: [OK] Responding" -ForegroundColor Green
        } catch {
            if ($_.Exception.Message -like "*400*") {
                Write-Host "   MCP Endpoint: [OK] Responding (400 expected for GET)" -ForegroundColor Green
            } else {
                Write-Host "   MCP Endpoint: [FAIL] Not responding ($($_.Exception.Message))" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "[FAIL] Playwright MCP server is not running (process not found)" -ForegroundColor Red
        Remove-Item $PID_FILE -Force -ErrorAction SilentlyContinue
    }
}

# Main script logic
switch ($Action) {
    "start" {
        Start-PlaywrightMCP
    }
    "stop" {
        Stop-PlaywrightMCP
    }
    "restart" {
        Stop-PlaywrightMCP
        Start-Sleep -Seconds 2
        Start-PlaywrightMCP
    }
    "status" {
        Get-PlaywrightMCPStatus
    }
}
