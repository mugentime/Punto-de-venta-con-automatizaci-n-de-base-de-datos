# ===============================================
# WORKFLOW AUTOMATICO DE VERIFICACION POST-DEPLOY
# POS CONEJO NEGRO - POST DEPLOY VERIFICATION
# ===============================================

param(
    [string]$CommitHash = "",
    [switch]$SkipVerification = $false,
    [int]$MaxWaitTime = 300, # 5 minutes max wait
    [int]$CheckInterval = 30  # Check every 30 seconds
)

Write-Host "[WORKFLOW] INICIANDO VERIFICACION AUTOMATICA POST-DEPLOY" -ForegroundColor Cyan
Write-Host "[WORKFLOW] Commit: $CommitHash" -ForegroundColor Gray
Write-Host "[WORKFLOW] Tiempo: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

if ($SkipVerification) {
    Write-Host "[WORKFLOW] SALTANDO VERIFICACION (--SkipVerification)" -ForegroundColor Yellow
    exit 0
}

# Step 1: Esperar a que Render procese el deploy
Write-Host "`n[STEP 1] Esperando a que Render procese el deploy..." -ForegroundColor Yellow
Write-Host "[WAIT] Esperando 60 segundos para que Render inicie el deploy..." -ForegroundColor Gray
Start-Sleep -Seconds 60

$WaitTime = 0
$DeployDetected = $false

do {
    Write-Host "[WAIT] Verificando estado del deploy... (${WaitTime}s/${MaxWaitTime}s)" -ForegroundColor Gray
    
    try {
        # Verificar si hay un deploy activo usando el script existente
        if (Test-Path "validate-render-deploy.js") {
            $ValidationResult = & node validate-render-deploy.js
            
            if ($LASTEXITCODE -eq 0) {
                # Si la validacion paso, el deploy esta completo
                $DeployDetected = $true
                Write-Host "[WAIT] ✅ Deploy detectado y validado" -ForegroundColor Green
                break
            } else {
                Write-Host "[WAIT] ⏳ Deploy aun en progreso..." -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WAIT] ⚠️ Script de validacion no encontrado, usando metodo alternativo" -ForegroundColor Yellow
            
            # Metodo alternativo: verificar directamente la URL
            $Response = try {
                Invoke-WebRequest -Uri "https://pos-conejo-negro.onrender.com/api/health" -UseBasicParsing -TimeoutSec 10
            } catch {
                $null
            }
            
            if ($Response -and $Response.StatusCode -eq 200) {
                $DeployDetected = $true
                Write-Host "[WAIT] ✅ Servidor respondiendo correctamente" -ForegroundColor Green
                break
            }
        }
    }
    catch {
        Write-Host "[WAIT] ⚠️ Error verificando deploy: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds $CheckInterval
    $WaitTime += $CheckInterval
    
} while ($WaitTime -lt $MaxWaitTime)

if (-not $DeployDetected) {
    Write-Host "[ERROR] ❌ NO SE PUDO VERIFICAR EL DEPLOY EN ${MaxWaitTime} SEGUNDOS" -ForegroundColor Red
    Write-Host "[ERROR] El deploy podria estar tomando mas tiempo del esperado" -ForegroundColor Red
    Write-Host "[ERROR] Verificar manualmente: https://pos-conejo-negro.onrender.com" -ForegroundColor Red
    exit 1
}

# Step 2: Ejecutar verificacion completa de funcionalidad
Write-Host "`n[STEP 2] Ejecutando verificacion completa de funcionalidad..." -ForegroundColor Yellow

if (Test-Path "verify-production-expense-integration.js") {
    Write-Host "[VERIFY] Ejecutando verificacion de integracion de gastos..." -ForegroundColor Cyan
    $VerificationResult = & node verify-production-expense-integration.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[VERIFY] ✅ VERIFICACION DE FUNCIONALIDAD EXITOSA" -ForegroundColor Green
    } else {
        Write-Host "[VERIFY] ❌ VERIFICACION DE FUNCIONALIDAD FALLO" -ForegroundColor Red
        Write-Host "[VERIFY] Revisar logs arriba para detalles" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[VERIFY] ⚠️ Script de verificacion no encontrado, usando verificacion basica" -ForegroundColor Yellow
    
    # Verificacion basica manual
    try {
        $HealthCheck = Invoke-WebRequest -Uri "https://pos-conejo-negro.onrender.com/api/health" -UseBasicParsing
        $GastosCheck = Invoke-WebRequest -Uri "https://pos-conejo-negro.onrender.com/gastos.html" -UseBasicParsing
        
        if ($HealthCheck.StatusCode -eq 200 -and $GastosCheck.StatusCode -eq 200) {
            Write-Host "[VERIFY] ✅ VERIFICACION BASICA EXITOSA" -ForegroundColor Green
        } else {
            throw "Respuestas inesperadas: Health=$($HealthCheck.StatusCode), Gastos=$($GastosCheck.StatusCode)"
        }
    }
    catch {
        Write-Host "[VERIFY] ❌ VERIFICACION BASICA FALLO: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Generar reporte final
Write-Host "`n[STEP 3] Generando reporte final..." -ForegroundColor Yellow

$ReportData = @{
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    commit = $CommitHash
    workflow_duration = $WaitTime + 60  # tiempo total incluyendo espera inicial
    deploy_detected = $DeployDetected
    verification_passed = $true
    production_url = "https://pos-conejo-negro.onrender.com"
    gastos_url = "https://pos-conejo-negro.onrender.com/gastos.html"
}

$ReportJson = $ReportData | ConvertTo-Json -Depth 3
$ReportFileName = "post-deploy-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$ReportJson | Out-File -FilePath $ReportFileName -Encoding UTF8

Write-Host "[REPORT] ✅ Reporte guardado: $ReportFileName" -ForegroundColor Green

# Step 4: Resultado final
Write-Host "`n[SUCCESS] ======== WORKFLOW COMPLETADO EXITOSAMENTE ========" -ForegroundColor Green
Write-Host "[SUCCESS] ✅ Deploy verificado y funcional en produccion" -ForegroundColor Green
Write-Host "[SUCCESS] ✅ Integracion de gastos funcionando correctamente" -ForegroundColor Green
Write-Host "[SUCCESS] ✅ Todas las verificaciones pasaron" -ForegroundColor Green
Write-Host "`n[URL] Produccion: https://pos-conejo-negro.onrender.com" -ForegroundColor Cyan
Write-Host "[URL] Gastos: https://pos-conejo-negro.onrender.com/gastos.html" -ForegroundColor Cyan
Write-Host "`n[COMPLETE] Workflow completado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

exit 0
