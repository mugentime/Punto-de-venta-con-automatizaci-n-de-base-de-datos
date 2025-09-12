# ===============================================
# SCRIPT DE INICIO SEGURO DEL SERVIDOR
# POS CONEJO NEGRO - START SERVER SAFE
# ===============================================

param(
    [switch]$Background = $false,
    [switch]$SkipDepsCheck = $false,
    [switch]$Force = $false
)

Write-Host "🚀 INICIANDO SERVIDOR POS CONEJO NEGRO..." -ForegroundColor Cyan
Write-Host "📅 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Verificar si el servidor ya está ejecutándose
if (!$Force) {
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($Response.StatusCode -eq 200) {
            Write-Host "⚠️ El servidor ya está ejecutándose en el puerto 3000" -ForegroundColor Yellow
            Write-Host "✅ Estado del servidor: ACTIVO" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        Write-Host "✅ Puerto 3000 disponible, procediendo..." -ForegroundColor Green
    }
}

# Verificar dependencias automáticamente
if (!$SkipDepsCheck) {
    Write-Host "🔍 VERIFICANDO DEPENDENCIAS..." -ForegroundColor Yellow
    
    # Ejecutar script de verificación de dependencias
    if (Test-Path "fix-dependencies.ps1") {
        & .\fix-dependencies.ps1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ ERROR: Falló la verificación de dependencias" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️ Script fix-dependencies.ps1 no encontrado, ejecutando npm install..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "✅ DEPENDENCIAS VERIFICADAS" -ForegroundColor Green
} else {
    Write-Host "⏩ SALTANDO VERIFICACIÓN DE DEPENDENCIAS (--SkipDepsCheck)" -ForegroundColor Yellow
}

# Verificar archivos críticos
$CriticalFiles = @("server.js", "package.json")
foreach ($File in $CriticalFiles) {
    if (!(Test-Path $File)) {
        Write-Host "❌ ERROR: Archivo crítico no encontrado: $File" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ ARCHIVOS CRÍTICOS VERIFICADOS" -ForegroundColor Green

# Iniciar servidor
Write-Host "🚀 INICIANDO SERVIDOR..." -ForegroundColor Cyan

if ($Background) {
    Write-Host "🔧 Iniciando servidor en segundo plano..." -ForegroundColor Yellow
    $ServerProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -NoNewWindow
    
    # Esperar un momento para verificar que se inició correctamente
    Start-Sleep -Seconds 3
    
    # Verificar que el proceso sigue ejecutándose
    if (Get-Process -Id $ServerProcess.Id -ErrorAction SilentlyContinue) {
        Write-Host "✅ SERVIDOR INICIADO EN SEGUNDO PLANO" -ForegroundColor Green
        Write-Host "🌐 PID del proceso: $($ServerProcess.Id)" -ForegroundColor Cyan
        Write-Host "🌐 URL del servidor: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "💼 URL de gastos: http://localhost:3000/gastos.html" -ForegroundColor Cyan
        
        # Verificar conectividad
        Start-Sleep -Seconds 2
        try {
            $HealthCheck = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
            if ($HealthCheck.StatusCode -eq 200) {
                Write-Host "✅ SERVIDOR RESPONDIENDO CORRECTAMENTE" -ForegroundColor Green
                Write-Host "🎯 LISTO PARA USAR" -ForegroundColor Cyan
            }
        }
        catch {
            Write-Host "⚠️ El servidor se está iniciando, puede tardar unos segundos más..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ ERROR: El servidor falló al iniciar" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "🔧 Iniciando servidor en primer plano..." -ForegroundColor Yellow
    Write-Host "⚠️ Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
    node server.js
}

Write-Host "🏁 SCRIPT DE INICIO COMPLETADO" -ForegroundColor Cyan
