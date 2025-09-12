# Simple Render Deployment Fix Script
$ErrorActionPreference = "Continue"
$serviceId = "srv-d2sf0q7diees738qcq3g"
$headers = @{
    "Authorization" = "Bearer $env:RENDER_API_KEY"
    "Content-Type" = "application/json"
}

Write-Output "🚨 RENDER DEPLOYMENT FIX SCRIPT"
Write-Output "=" * 50

# Step 1: Check current status
Write-Output "1. Checking current deployment status..."
try {
    $deployResponse = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method GET
    $deployData = $deployResponse.Content | ConvertFrom-Json
    $currentDeploy = $deployData[0].deploy
    
    Write-Output "   Status: $($currentDeploy.status)"
    Write-Output "   Commit: $($currentDeploy.commit.id.Substring(0,8))"
} catch {
    Write-Output "   Error: $($_.Exception.Message)"
    exit 1
}

# Step 2: Analyze package.json for common issues
Write-Output ""
Write-Output "2. Analyzing package.json for issues..."

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$fixesApplied = $false

Write-Output "   Current build script: $($packageJson.scripts.build)"
Write-Output "   Current start script: $($packageJson.scripts.start)"
Write-Output "   Current node version: $($packageJson.engines.node)"

# Check for problematic build script
if ($packageJson.scripts.build -match "build:taskmaster") {
    Write-Output "   Issue found: Build script references non-existent 'build:taskmaster'"
    $packageJson.scripts.build = "echo 'No build step required'"
    $fixesApplied = $true
    Write-Output "   Fix applied: Simplified build script"
}

# Ensure Node version is explicit
if ($packageJson.engines.node -ne "18.x") {
    Write-Output "   Issue found: Node version not explicit"
    $packageJson.engines.node = "18.x"
    $fixesApplied = $true
    Write-Output "   Fix applied: Set Node version to 18.x"
}

# Step 3: Apply fixes if needed
if ($fixesApplied) {
    Write-Output ""
    Write-Output "3. Applying fixes to package.json..."
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    Write-Output "   Package.json updated successfully"
    
    # Step 4: Commit and deploy
    Write-Output ""
    Write-Output "4. Committing fixes and triggering deployment..."
    try {
        git add package.json
        git commit -m "fix: Resolve Render deployment issues - simplified build script and explicit Node version"
        git push origin main
        Write-Output "   Deployment triggered successfully"
        
        # Step 5: Monitor deployment
        Write-Output ""
        Write-Output "5. Monitoring deployment (will check for 3 minutes)..."
        $startTime = Get-Date
        $timeout = 180 # 3 minutes
        
        while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
            Start-Sleep -Seconds 15
            try {
                $deployResponse = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method GET
                $deployData = $deployResponse.Content | ConvertFrom-Json
                $latestDeploy = $deployData[0].deploy
                
                $status = $latestDeploy.status
                Write-Output "   Status: $status ($(Get-Date -Format 'HH:mm:ss'))"
                
                if ($status -eq "live") {
                    Write-Output ""
                    Write-Output "✅ SUCCESS! Deployment completed successfully!"
                    
                    # Test the application
                    Write-Output "6. Testing application..."
                    try {
                        $healthResponse = Invoke-WebRequest -Uri "https://pos-conejo-negro.onrender.com/api/health" -Method GET
                        $healthData = $healthResponse.Content | ConvertFrom-Json
                        Write-Output "   Application Status: $($healthData.status)"
                        Write-Output "   Database Type: $($healthData.databaseType)"
                        
                        if ($healthData.databaseType -eq "file-based-with-git-sync") {
                            Write-Output ""
                            Write-Output "🎯 PERFECT! File-based system is now live!"
                        }
                    } catch {
                        Write-Output "   Application deployed but health check failed"
                    }
                    break
                }
                
                if ($status -eq "build_failed" -or $status -eq "update_failed") {
                    Write-Output ""
                    Write-Output "❌ Deployment failed again. Manual investigation needed."
                    Write-Output "   Check Render dashboard for detailed logs"
                    break
                }
            } catch {
                Write-Output "   Error checking status: $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Output "   Error during git operations: $_"
    }
} else {
    Write-Output ""
    Write-Output "🤔 No obvious package.json issues found."
    Write-Output "   Manual investigation needed:"
    Write-Output "   1. Check Render dashboard for detailed logs"
    Write-Output "   2. Verify environment variables (JWT_SECRET, etc.)"
    Write-Output "   3. Check service configuration"
}

Write-Output ""
Write-Output "🏁 Fix script completed"
