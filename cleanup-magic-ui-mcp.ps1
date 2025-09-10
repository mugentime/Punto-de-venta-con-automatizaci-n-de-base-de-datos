# Magic UI MCP Ecosystem Cleanup Script
$procList = Get-Content processes.json | ConvertFrom-Json
foreach ($k in $procList.PSObject.Properties.Name) {
    $pid = [int]$procList.$k
    if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { 
        Write-Host "Stopping $k (PID: $pid)"
        Stop-Process -Id $pid -Force 
    }
}
Write-Host "All Magic UI MCP processes stopped"
