# Test Render MCP Connection and Monitor Deployment
# This script tests the Render MCP server connection and monitors deployment status

Write-Output "🔍 Testing Render MCP Connection..."
Write-Output ""

# Check if API key is set
if (-not $env:RENDER_API_KEY) {
    Write-Output "❌ RENDER_API_KEY not set!"
    Write-Output ""
    Write-Output "Please run:"
    Write-Output '$env:RENDER_API_KEY = "rnd_YOUR_API_KEY_HERE"'
    Write-Output ""
    Write-Output "Get your API key from: https://dashboard.render.com/account/api-keys"
    exit 1
}

Write-Output "✅ RENDER_API_KEY is set"
Write-Output ""

# Test basic connection to Render API
try {
    Write-Output "🌐 Testing Render API connection..."
    $headers = @{
        "Authorization" = "Bearer $env:RENDER_API_KEY"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers $headers -Method GET
    Write-Output "✅ Successfully connected to Render API"
    Write-Output "   Account: $($response.name)"
    Write-Output ""
} catch {
    Write-Output "❌ Failed to connect to Render API: $($_.Exception.Message)"
    Write-Output "   Please check your API key"
    exit 1
}

# List services to find POS Conejo Negro
try {
    Write-Output "🔍 Finding POS Conejo Negro service..."
    $services = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Headers $headers -Method GET
    
    $posService = $services | Where-Object { $_.name -match "pos.*conejo.*negro|conejo.*negro" -or $_.repo -match "POS-CONEJONEGRO" }
    
    if ($posService) {
        Write-Output "✅ Found POS service:"
        Write-Output "   Name: $($posService.name)"
        Write-Output "   ID: $($posService.id)"
        Write-Output "   Status: $($posService.serviceDetails.buildStatus)"
        Write-Output "   URL: $($posService.serviceDetails.url)"
        Write-Output ""
        
        # Get recent deployments
        Write-Output "📦 Recent deployments:"
        $deployments = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$($posService.id)/deploys" -Headers $headers -Method GET
        
        $recent = $deployments | Select-Object -First 3
        foreach ($deploy in $recent) {
            $status = switch ($deploy.status) {
                "live" { "🟢 LIVE" }
                "build_in_progress" { "🟡 BUILDING" }
                "update_in_progress" { "🟡 UPDATING" }
                "build_failed" { "🔴 FAILED" }
                "cancelled" { "⚫ CANCELLED" }
                default { "⚪ $($deploy.status)" }
            }
            
            Write-Output "   $status - $($deploy.commit.message) ($($deploy.commit.id.Substring(0,8)))"
            Write-Output "     Created: $($deploy.createdAt)"
            if ($deploy.finishedAt) {
                Write-Output "     Finished: $($deploy.finishedAt)"
            }
            Write-Output ""
        }
        
        # Check if latest deployment matches our commits
        $latestDeploy = $deployments | Select-Object -First 1
        Write-Output "🔄 Latest deployment analysis:"
        Write-Output "   Status: $($latestDeploy.status)"
        Write-Output "   Commit: $($latestDeploy.commit.id)"
        Write-Output "   Message: $($latestDeploy.commit.message)"
        
        # Get local git commit for comparison
        $localCommit = git rev-parse HEAD
        if ($latestDeploy.commit.id -eq $localCommit) {
            Write-Output "   ✅ Deployment matches local commit"
        } else {
            Write-Output "   ⚠️  Deployment commit differs from local"
            Write-Output "   Local: $localCommit"
            Write-Output "   Deployed: $($latestDeploy.commit.id)"
        }
        
    } else {
        Write-Output "❌ POS Conejo Negro service not found"
        Write-Output "Available services:"
        foreach ($service in $services) {
            Write-Output "   - $($service.name) ($($service.id))"
        }
    }
    
} catch {
    Write-Output "❌ Failed to get services: $($_.Exception.Message)"
    exit 1
}

Write-Output ""
Write-Output "🎯 Render MCP connection test completed!"
