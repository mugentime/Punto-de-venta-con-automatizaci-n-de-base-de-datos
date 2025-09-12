# ===============================================
# SCRIPT DE REPARACION AUTOMATICA DE DEPENDENCIAS
# POS CONEJO NEGRO - FIX DEPENDENCIES
# ===============================================

Write-Host "[FIX] INICIANDO VERIFICACION DE DEPENDENCIAS..." -ForegroundColor Cyan

# Lista de dependencias críticas que suelen faltar
$CriticalDependencies = @(
    "redis",
    "express",
    "cors",
    "helmet", 
    "express-rate-limit",
    "dotenv",
    "bcryptjs",
    "jsonwebtoken",
    "multer",
    "node-cron"
)

Write-Host "📋 Verificando dependencias críticas..." -ForegroundColor Yellow

# Verificar package.json existe
if (!(Test-Path "package.json")) {
    Write-Host "❌ ERROR: package.json no encontrado!" -ForegroundColor Red
    exit 1
}

# Leer package.json
$PackageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$InstalledDeps = $PackageJson.dependencies.PSObject.Properties.Name

$MissingDeps = @()

foreach ($Dep in $CriticalDependencies) {
    if ($InstalledDeps -notcontains $Dep) {
        $MissingDeps += $Dep
        Write-Host "❌ Falta: $Dep" -ForegroundColor Red
    } else {
        Write-Host "✅ OK: $Dep" -ForegroundColor Green
    }
}

if ($MissingDeps.Count -gt 0) {
    Write-Host "🚨 Se encontraron $($MissingDeps.Count) dependencias faltantes" -ForegroundColor Red
    Write-Host "🔧 Instalando dependencias faltantes..." -ForegroundColor Yellow
    
    $DepsString = $MissingDeps -join " "
    Write-Host "📦 Ejecutando: npm install $DepsString" -ForegroundColor Cyan
    
    $InstallResult = Start-Process -FilePath "npm" -ArgumentList "install", $DepsString -Wait -PassThru -NoNewWindow
    
    if ($InstallResult.ExitCode -eq 0) {
        Write-Host "✅ DEPENDENCIAS INSTALADAS CORRECTAMENTE" -ForegroundColor Green
    } else {
        Write-Host "❌ ERROR AL INSTALAR DEPENDENCIAS" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ TODAS LAS DEPENDENCIAS ESTÁN INSTALADAS" -ForegroundColor Green
}

# Verificar node_modules existe y tiene contenido
if (!(Test-Path "node_modules")) {
    Write-Host "⚠️ node_modules no existe, ejecutando npm install completo..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ npm install completado" -ForegroundColor Green
} else {
    $NodeModulesCount = (Get-ChildItem "node_modules" -Directory).Count
    if ($NodeModulesCount -lt 10) {
        Write-Host "⚠️ node_modules parece incompleto ($NodeModulesCount dirs), reinstalando..." -ForegroundColor Yellow
        npm install
        Write-Host "✅ npm install completado" -ForegroundColor Green
    } else {
        Write-Host "✅ node_modules OK ($NodeModulesCount dependencias)" -ForegroundColor Green
    }
}

Write-Host "🎯 VERIFICACIÓN DE DEPENDENCIAS COMPLETADA" -ForegroundColor Cyan
Write-Host "🚀 El proyecto está listo para ejecutarse" -ForegroundColor Green
