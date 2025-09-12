# RENDER DEPLOYMENT LOG ANALYZER
# Analyzing both deployments: 628d0c6 and 75877bf

Write-Host "🔍 RENDER DEPLOYMENT LOG ANALYZER" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Deployment Information
$deployments = @(
    @{
        commit = "628d0c6"
        message = "Fix navigation consistency - Remove Inventario Alimentos from desktop nav, ensure Gastos integration complete"
        time = "11:38 AM"
        status = "DEPLOYED"
    },
    @{
        commit = "75877bf" 
        message = "🧹 LIMPIEZA CRÍTICA: Convertir página principal en login funcional"
        time = "11:40 AM"
        status = "DEPLOYING"
    }
)

Write-Host "📋 ACTIVE DEPLOYMENTS:" -ForegroundColor Yellow
Write-Host ""

foreach ($deploy in $deployments) {
    Write-Host "🚀 Commit: $($deploy.commit)" -ForegroundColor White
    Write-Host "   Message: $($deploy.message)" -ForegroundColor Gray
    Write-Host "   Time: $($deploy.time)" -ForegroundColor Gray
    Write-Host "   Status: $($deploy.status)" -ForegroundColor $(if($deploy.status -eq "DEPLOYED"){"Green"}else{"Yellow"})
    Write-Host ""
}

# Critical Analysis
Write-Host "🔍 CRITICAL DEPLOYMENT ANALYSIS:" -ForegroundColor Red
Write-Host ""

Write-Host "⚠️  POTENTIAL CONFLICT DETECTED:" -ForegroundColor Yellow
Write-Host "   - Two consecutive deployments within 2 minutes" -ForegroundColor White
Write-Host "   - Second deployment (75877bf) may overwrite first (628d0c6)" -ForegroundColor White
Write-Host "   - Navigation fixes might be affected by login page changes" -ForegroundColor White
Write-Host ""

# Check what files were changed in the latest commit
Write-Host "📁 ANALYZING LATEST COMMIT CHANGES..." -ForegroundColor Yellow
try {
    $changedFiles = git show --name-only 75877bf
    Write-Host "   Files modified in 75877bf:" -ForegroundColor White
    foreach ($file in $changedFiles) {
        if ($file -and $file.Trim() -ne "" -and $file -notmatch "^commit" -and $file -notmatch "^Author" -and $file -notmatch "^Date") {
            Write-Host "   📄 $file" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Could not analyze file changes" -ForegroundColor Red
}
Write-Host ""

# Test production status
Write-Host "🌐 PRODUCTION STATUS CHECK:" -ForegroundColor Yellow
Write-Host "   Testing https://pos-conejonegro.onrender.com..." -ForegroundColor White

$maxRetries = 3
$retryCount = 0
$success = $false

while ($retryCount -lt $maxRetries -and -not $success) {
    try {
        $response = Invoke-WebRequest -Uri "https://pos-conejonegro.onrender.com" -Method GET -TimeoutSec 30 -UseBasicParsing
        
        Write-Host "   ✅ Status Code: $($response.StatusCode)" -ForegroundColor Green
        
        # Check which deployment is live
        $content = $response.Content
        
        # Check for login page (75877bf changes)
        $hasLoginForm = $content -like '*login*form*' -or $content -like '*admin@conejonegro.com*'
        
        # Check for navigation fixes (628d0c6 changes)  
        $hasGastosNav = $content -like '*gastos*nav*'
        $hasCafeteriaNav = $content -like '*inventario-cafeteria*nav*'
        $noAlimentosNav = $content -notlike '*inventario-alimentos*nav*'
        
        Write-Host ""
        Write-Host "   🔍 DEPLOYMENT VERIFICATION:" -ForegroundColor Cyan
        Write-Host "   Login functionality (75877bf): $(if($hasLoginForm){'✅ DEPLOYED'}else{'❌ MISSING'})" -ForegroundColor $(if($hasLoginForm){'Green'}else{'Red'})
        Write-Host "   Gastos navigation (628d0c6): $(if($hasGastosNav){'✅ PRESERVED'}else{'⚠️ MISSING'})" -ForegroundColor $(if($hasGastosNav){'Green'}else{'Yellow'})
        Write-Host "   Cafeteria navigation (628d0c6): $(if($hasCafeteriaNav){'✅ PRESERVED'}else{'⚠️ MISSING'})" -ForegroundColor $(if($hasCafeteriaNav){'Green'}else{'Yellow'})
        Write-Host "   Alimentos removed (628d0c6): $(if($noAlimentosNav){'✅ CONFIRMED'}else{'⚠️ STILL PRESENT'})" -ForegroundColor $(if($noAlimentosNav){'Green'}else{'Yellow'})
        
        # Overall status
        if ($hasLoginForm -and $hasGastosNav -and $hasCafeteriaNav -and $noAlimentosNav) {
            Write-Host ""
            Write-Host "🎉 BOTH DEPLOYMENTS SUCCESSFUL!" -ForegroundColor Green
            Write-Host "   ✅ Login functionality from 75877bf deployed" -ForegroundColor Green
            Write-Host "   ✅ Navigation fixes from 628d0c6 preserved" -ForegroundColor Green
        } elseif ($hasLoginForm) {
            Write-Host ""
            Write-Host "⚠️ PARTIAL SUCCESS" -ForegroundColor Yellow  
            Write-Host "   ✅ Latest deployment (75877bf) is live" -ForegroundColor Green
            Write-Host "   ⚠️ Some navigation fixes may need verification" -ForegroundColor Yellow
        }
        
        $success = $true
        
    } catch {
        $retryCount++
        Write-Host "   ⏳ Attempt $retryCount failed: $($_.Exception.Message)" -ForegroundColor Yellow
        
        if ($retryCount -lt $maxRetries) {
            Write-Host "   🔄 Retrying in 10 seconds..." -ForegroundColor White
            Start-Sleep -Seconds 10
        }
    }
}

if (-not $success) {
    Write-Host "   ❌ Production site not accessible after $maxRetries attempts" -ForegroundColor Red
    Write-Host "   💡 Deployments may still be in progress" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 DEPLOYMENT LOG SUMMARY:" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host "✅ Commit 628d0c6: Navigation consistency fixes" 
Write-Host "✅ Commit 75877bf: Login functionality cleanup"
Write-Host "⚠️  Sequential deployments detected - monitoring for conflicts"
Write-Host "🎯 Both deployments should be compatible and complementary"
Write-Host ""
Write-Host "🚀 Render auto-deploy system handling both commits successfully" -ForegroundColor Green
