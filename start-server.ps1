# ===============================================
# SCRIPT DE INICIO SEGURO DEL SERVIDOR
# POS CONEJO NEGRO - START SERVER SAFE
# ===============================================

param(
    [switch]$Background = $false,
    [switch]$SkipDeps = $false,
    [switch]$Force = $false
)

Write-Host "[START] INICIANDO SERVIDOR POS CONEJO NEGRO..." -ForegroundColor Cyan
Write-Host "[TIME] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Verificar si el servidor ya esta ejecutandose
if (!$Force) {
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($Response.StatusCode -eq 200) {
            Write-Host "[RUNNING] El servidor ya esta ejecutandose en el puerto 3000" -ForegroundColor Yellow
            Write-Host "[OK] Estado del servidor: ACTIVO" -ForegroundColor Green
            Write-Host "[URL] Gastos: http://localhost:3000/gastos.html" -ForegroundColor Cyan
            exit 0
        }
    }
    catch {
        Write-Host "[OK] Puerto 3000 disponible, procediendo..." -ForegroundColor Green
    }
}

# Verificar dependencias automaticamente
if (!$SkipDeps) {
    Write-Host "[CHECK] VERIFICANDO DEPENDENCIAS..." -ForegroundColor Yellow
    
    # Ejecutar script de verificacion de dependencias
    if (Test-Path "fix-deps.ps1") {
        & .\fix-deps.ps1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Fallo la verificacion de dependencias" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[INSTALL] fix-deps.ps1 no encontrado, ejecutando npm install..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "[OK] DEPENDENCIAS VERIFICADAS" -ForegroundColor Green
} else {
    Write-Host "[SKIP] SALTANDO VERIFICACION DE DEPENDENCIAS" -ForegroundColor Yellow
}

# Verificar archivos criticos
$CriticalFiles = @("server.js", "package.json")
foreach ($File in $CriticalFiles) {
    if (!(Test-Path $File)) {
        Write-Host "[ERROR] Archivo critico no encontrado: $File" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] ARCHIVOS CRITICOS VERIFICADOS" -ForegroundColor Green

# Iniciar servidor
Write-Host "[START] INICIANDO SERVIDOR..." -ForegroundColor Cyan

if ($Background) {
    Write-Host "[BACKGROUND] Iniciando servidor en segundo plano..." -ForegroundColor Yellow
    
    # Matar procesos node existentes si es necesario
    if ($Force) {
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    
    $ServerProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden
    
    # Esperar un momento para verificar que se inicio correctamente
    Start-Sleep -Seconds 3
    
    # Verificar que el proceso sigue ejecutandose
    if (Get-Process -Id $ServerProcess.Id -ErrorAction SilentlyContinue) {
        Write-Host "[OK] SERVIDOR INICIADO EN SEGUNDO PLANO" -ForegroundColor Green
        Write-Host "[PID] Proceso ID: $($ServerProcess.Id)" -ForegroundColor Cyan
        Write-Host "[URL] Servidor: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "[URL] Gastos: http://localhost:3000/gastos.html" -ForegroundColor Cyan
        
        # Verificar conectividad
        Start-Sleep -Seconds 3
        try {
            $HealthCheck = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
            if ($HealthCheck.StatusCode -eq 200) {
                Write-Host "[OK] SERVIDOR RESPONDIENDO CORRECTAMENTE" -ForegroundColor Green
                Write-Host "[READY] LISTO PARA USAR" -ForegroundColor Cyan
                
                # Mostrar funcionalidades de gastos
                Write-Host "" -ForegroundColor White
                Write-Host "[GASTOS] FUNCIONALIDAD DE GASTOS DISPONIBLE:" -ForegroundColor Yellow
                Write-Host "[GASTOS] - Crear gastos unicos y recurrentes" -ForegroundColor White
                Write-Host "[GASTOS] - Listar y filtrar gastos" -ForegroundColor White
                Write-Host "[GASTOS] - Estadisticas y reportes" -ForegroundColor White
                Write-Host "[GASTOS] - Categorias: gastos-fijos, insumos, sueldos, marketing, etc." -ForegroundColor White
                Write-Host "[URL] Acceder: http://localhost:3000/gastos.html" -ForegroundColor Cyan
            }
        }
        catch {
            Write-Host "[WAIT] El servidor se esta iniciando, puede tardar unos segundos mas..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[ERROR] El servidor fallo al iniciar" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[FOREGROUND] Iniciando servidor en primer plano..." -ForegroundColor Yellow
    Write-Host "[INFO] Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
    node server.js
}

Write-Host "[COMPLETE] SCRIPT DE INICIO COMPLETADO" -ForegroundColor Cyan
