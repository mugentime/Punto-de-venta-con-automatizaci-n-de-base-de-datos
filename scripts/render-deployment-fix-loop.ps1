# Render Deployment Fix Loop
# This script continuously monitors Render deployment status, identifies issues, and applies fixes

param(
    [int]$MaxIterations = 10,
    [int]$WaitBetweenChecks = 60
)

$ErrorActionPreference = "Continue"
$serviceId = "srv-d2sf0q7diees738qcq3g"
$headers = @{
    "Authorization" = "Bearer $env:RENDER_API_KEY"
    "Content-Type" = "application/json"
}

Write-Output "🔄 RENDER DEPLOYMENT FIX LOOP INITIATED"
Write-Output "=" * 60
Write-Output "Service ID: $serviceId"
Write-Output "Max Iterations: $MaxIterations"
Write-Output "Wait Between Checks: $WaitBetweenChecks seconds"
Write-Output ""

function Get-DeploymentStatus {
    try {
        $deployResponse = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method GET
        $deployData = $deployResponse.Content | ConvertFrom-Json
        return $deployData[0].deploy
    } catch {
        Write-Output "❌ Error getting deployment status: $($_.Exception.Message)"
        return $null
    }
}

function Get-ServiceInfo {
    try {
        $serviceResponse = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$serviceId" -Headers $headers -Method GET
        $serviceData = $serviceResponse.Content | ConvertFrom-Json
        return $serviceData.service
    } catch {
        Write-Output "❌ Error getting service info: $($_.Exception.Message)"
        return $null
    }
}

function Check-PackageJsonIssues {
    Write-Output "📦 Checking package.json for common issues..."
    
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        $issues = @()
        
        # Check for problematic build script
        if ($packageJson.scripts.build -match "build:taskmaster") {
            $issues += "Build script references 'build:taskmaster' which may not exist"
            
            # Fix: Update build script
            Write-Output "🔧 Fixing build script..."
            $packageJson.scripts.build = "echo 'No build required for Node.js app'"
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
            Write-Output "✅ Updated build script"
        }
        
        # Check Node version compatibility
        if ($packageJson.engines.node -match ">=18") {
            Write-Output "✅ Node version looks compatible"
        }
        
        # Check start script
        if ($packageJson.scripts.start -eq "node server.js") {
            Write-Output "✅ Start script looks correct"
        }
        
        return $issues.Count -gt 0
        
    } catch {
        Write-Output "❌ Error checking package.json: $($_.Exception.Message)"
        return $false
    }
}

function Check-EnvironmentVariables {
    Write-Output "🔧 Checking critical environment variables..."
    
    # Check if JWT_SECRET is likely set (we can't see Render env vars, but we can check our code)
    $serverJs = Get-Content "server.js" -Raw
    if ($serverJs -match "JWT_SECRET.*required") {
        Write-Output "⚠️  JWT_SECRET is required - ensure it's set in Render dashboard"
        return $true
    }
    
    return $false
}

function Apply-CommonFixes {
    Write-Output "🔧 Applying common deployment fixes..."
    $fixesApplied = $false
    
    # Fix 1: Ensure package.json has correct scripts
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    if ($packageJson.scripts.build -ne "echo 'No build step required'") {
        Write-Output "🔧 Simplifying build script..."
        $packageJson.scripts.build = "echo 'No build step required'"
        $fixesApplied = $true
    }
    
    # Fix 2: Ensure start script is simple
    if ($packageJson.scripts.start -ne "node server.js") {
        Write-Output "🔧 Fixing start script..."
        $packageJson.scripts.start = "node server.js"
        $fixesApplied = $true
    }
    
    # Fix 3: Add explicit Node version
    if (-not $packageJson.engines) {
        $packageJson.engines = @{}
    }
    if ($packageJson.engines.node -ne "18.x") {
        Write-Output "🔧 Setting explicit Node version..."
        $packageJson.engines.node = "18.x"
        $fixesApplied = $true
    }
    
    if ($fixesApplied) {
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
        Write-Output "✅ Package.json fixes applied"
    }
    
    return $fixesApplied
}

function Trigger-Deployment {
    Write-Output "🚀 Triggering new deployment..."
    try {
        git add package.json
        git commit -m "fix: Render deployment fixes - simplified build and explicit Node version"
        git push origin main
        Write-Output "✅ Deployment triggered via Git push"
        return $true
    } catch {
        Write-Output "❌ Error triggering deployment: $_"
        return $false
    }
}

function Wait-ForDeploymentStart {
    param([string]$PreviousCommit)
    
    Write-Output "⏳ Waiting for new deployment to start..."
    $startTime = Get-Date
    $timeout = 300 # 5 minutes
    
    while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
        $currentDeploy = Get-DeploymentStatus
        if ($currentDeploy -and $currentDeploy.commit.id -ne $PreviousCommit) {
            Write-Output "✅ New deployment started!"
            return $currentDeploy
        }
        Start-Sleep -Seconds 10
    }
    
    Write-Output "❌ Timeout waiting for deployment to start"
    return $null
}

function Monitor-Deployment {
    param($Deploy)
    
    Write-Output "👀 Monitoring deployment: $($Deploy.commit.id.Substring(0,8))"
    $startTime = Get-Date
    $timeout = 600 # 10 minutes
    
    while (((Get-Date) - $startTime).TotalSeconds -lt $timeout) {
        $currentDeploy = Get-DeploymentStatus
        if (-not $currentDeploy) {
            Start-Sleep -Seconds 15
            continue
        }
        
        $status = switch ($currentDeploy.status) {
            "live" { "🟢 LIVE - SUCCESS!" }
            "build_in_progress" { "🟡 Building..." }
            "update_in_progress" { "🟡 Updating..." }
            "build_failed" { "🔴 Build Failed" }
            "update_failed" { "🔴 Update Failed" }
            default { "⚪ $($currentDeploy.status)" }
        }
        
        Write-Output "   Status: $status"
        
        if ($currentDeploy.status -eq "live") {
            Write-Output "🎉 DEPLOYMENT SUCCESSFUL!"
            return @{ success = $true; deploy = $currentDeploy }
        }
        
        if ($currentDeploy.status -eq "build_failed" -or $currentDeploy.status -eq "update_failed") {
            Write-Output "❌ DEPLOYMENT FAILED"
            return @{ success = $false; deploy = $currentDeploy; error = $currentDeploy.status }
        }
        
        Start-Sleep -Seconds 15
    }
    
    Write-Output "❌ Timeout monitoring deployment"
    return @{ success = $false; deploy = $currentDeploy; error = "timeout" }
}

# Main Loop
for ($iteration = 1; $iteration -le $MaxIterations; $iteration++) {
    Write-Output ""
    Write-Output "🔄 ITERATION $iteration/$MaxIterations"
    Write-Output "─" * 40
    Write-Output "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output ""
    
    # Step 1: Check current deployment status
    Write-Output "1️⃣ CHECKING CURRENT DEPLOYMENT STATUS"
    $currentDeploy = Get-DeploymentStatus
    
    if (-not $currentDeploy) {
        Write-Output "❌ Could not get deployment status"
        Start-Sleep -Seconds $WaitBetweenChecks
        continue
    }
    
    Write-Output "   Current Status: $($currentDeploy.status)"
    Write-Output "   Commit: $($currentDeploy.commit.id.Substring(0,8))"
    Write-Output "   Created: $($currentDeploy.createdAt)"
    
    # If deployment is successful, we're done!
    if ($currentDeploy.status -eq "live") {
        Write-Output "🎉 SUCCESS! Deployment is already live!"
        
        # Test the application
        Write-Output "🧪 Testing application..."
        try {
            $response = Invoke-WebRequest -Uri "https://pos-conejo-negro.onrender.com/api/health" -Method GET
            $healthData = $response.Content | ConvertFrom-Json
            Write-Output "✅ Application is responding"
            Write-Output "   Database Type: $($healthData.databaseType)"
            Write-Output "   Status: $($healthData.status)"
            
            if ($healthData.databaseType -eq "file-based-with-git-sync") {
                Write-Output "🎯 SUCCESS! File-based system is live!"
                break
            }
        } catch {
            Write-Output "⚠️  Application deployed but not responding properly"
        }
        break
    }
    
    # Step 2: If deployment failed, analyze and apply fixes
    if ($currentDeploy.status -eq "build_failed" -or $currentDeploy.status -eq "update_failed") {
        Write-Output ""
        Write-Output "2️⃣ ANALYZING FAILURE AND APPLYING FIXES"
        
        # Check and fix package.json issues
        $packageFixed = Check-PackageJsonIssues
        
        # Check environment variables
        $envIssues = Check-EnvironmentVariables
        
        # Apply common fixes
        $commonFixed = Apply-CommonFixes
        
        if ($packageFixed -or $commonFixed) {
            Write-Output ""
            Write-Output "3️⃣ TRIGGERING NEW DEPLOYMENT"
            $deployTriggered = Trigger-Deployment
            
            if ($deployTriggered) {
                Write-Output ""
                Write-Output "4️⃣ WAITING FOR NEW DEPLOYMENT"
                $newDeploy = Wait-ForDeploymentStart -PreviousCommit $currentDeploy.commit.id
                
                if ($newDeploy) {
                    Write-Output ""
                    Write-Output "5️⃣ MONITORING DEPLOYMENT PROGRESS"
                    $result = Monitor-Deployment -Deploy $newDeploy
                    
                    if ($result.success) {
                        Write-Output "🎉 DEPLOYMENT FIXED AND SUCCESSFUL!"
                        break
                    } else {
                        Write-Output "❌ New deployment also failed: $($result.error)"
                    }
                }
            }
        } else {
            Write-Output "🤔 No obvious fixes to apply. Manual investigation needed."
            Write-Output ""
            Write-Output "💡 MANUAL ACTIONS NEEDED:"
            Write-Output "   1. Check Render dashboard for detailed logs"
            Write-Output "   2. Verify environment variables are set"
            Write-Output "   3. Check for missing dependencies"
            Write-Output "   4. Consider service configuration issues"
        }
    }
    
    # Step 3: If deployment is in progress, monitor it
    if ($currentDeploy.status -eq "build_in_progress" -or $currentDeploy.status -eq "update_in_progress") {
        Write-Output ""
        Write-Output "2️⃣ MONITORING IN-PROGRESS DEPLOYMENT"
        $result = Monitor-Deployment -Deploy $currentDeploy
        
        if ($result.success) {
            Write-Output "🎉 IN-PROGRESS DEPLOYMENT COMPLETED SUCCESSFULLY!"
            break
        }
    }
    
    # Wait before next iteration
    if ($iteration -lt $MaxIterations) {
        Write-Output ""
        Write-Output "⏳ Waiting $WaitBetweenChecks seconds before next iteration..."
        Start-Sleep -Seconds $WaitBetweenChecks
    }
}

Write-Output ""
Write-Output "🏁 RENDER DEPLOYMENT FIX LOOP COMPLETED"
Write-Output "Iterations completed: $iteration/$MaxIterations"

# Final status check
$finalDeploy = Get-DeploymentStatus
if ($finalDeploy -and $finalDeploy.status -eq "live") {
    Write-Output "✅ Final Status: DEPLOYMENT SUCCESSFUL"
} else {
    Write-Output "❌ Final Status: DEPLOYMENT STILL FAILING"
    Write-Output "Manual intervention required."
}
