# ===============================================
# SCRIPT DE REPARACION AUTOMATICA DE DEPENDENCIAS
# POS CONEJO NEGRO - FIX DEPENDENCIES
# ===============================================

Write-Host "[FIX] INICIANDO VERIFICACION DE DEPENDENCIAS..." -ForegroundColor Cyan

# Lista de dependencias criticas que suelen faltar
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

Write-Host "[CHECK] Verificando dependencias criticas..." -ForegroundColor Yellow

# Verificar package.json existe
if (!(Test-Path "package.json")) {
    Write-Host "[ERROR] package.json no encontrado!" -ForegroundColor Red
    exit 1
}

# Leer package.json
try {
    $PackageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $InstalledDeps = @()
    if ($PackageJson.dependencies) {
        $InstalledDeps = $PackageJson.dependencies.PSObject.Properties.Name
    }
} catch {
    Write-Host "[ERROR] No se puede leer package.json!" -ForegroundColor Red
    exit 1
}

$MissingDeps = @()

foreach ($Dep in $CriticalDependencies) {
    if ($InstalledDeps -notcontains $Dep) {
        $MissingDeps += $Dep
        Write-Host "[MISSING] $Dep" -ForegroundColor Red
    } else {
        Write-Host "[OK] $Dep" -ForegroundColor Green
    }
}

if ($MissingDeps.Count -gt 0) {
    Write-Host "[INSTALL] Se encontraron $($MissingDeps.Count) dependencias faltantes" -ForegroundColor Red
    Write-Host "[INSTALL] Instalando dependencias faltantes..." -ForegroundColor Yellow
    
    $DepsString = $MissingDeps -join " "
    Write-Host "[NPM] Ejecutando: npm install $DepsString" -ForegroundColor Cyan
    
    # Instalar cada dependencia individualmente para mayor confiabilidad
    $AllSuccess = $true
    foreach ($Dep in $MissingDeps) {
        Write-Host "[NPM] Instalando $Dep..." -ForegroundColor Yellow
        $Result = & npm install $Dep 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] $Dep instalado correctamente" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Fallo al instalar $Dep" -ForegroundColor Red
            Write-Host "$Result" -ForegroundColor Red
            $AllSuccess = $false
        }
    }
    
    if ($AllSuccess) {
        Write-Host "[SUCCESS] DEPENDENCIAS INSTALADAS CORRECTAMENTE" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] ERROR AL INSTALAR ALGUNAS DEPENDENCIAS" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SUCCESS] TODAS LAS DEPENDENCIAS ESTAN INSTALADAS" -ForegroundColor Green
}

# Verificar node_modules existe y tiene contenido
if (!(Test-Path "node_modules")) {
    Write-Host "[INSTALL] node_modules no existe, ejecutando npm install completo..." -ForegroundColor Yellow
    npm install
    Write-Host "[SUCCESS] npm install completado" -ForegroundColor Green
} else {
    $NodeModulesCount = (Get-ChildItem "node_modules" -Directory -ErrorAction SilentlyContinue).Count
    if ($NodeModulesCount -lt 10) {
        Write-Host "[INSTALL] node_modules parece incompleto ($NodeModulesCount dirs), reinstalando..." -ForegroundColor Yellow
        npm install
        Write-Host "[SUCCESS] npm install completado" -ForegroundColor Green
    } else {
        Write-Host "[SUCCESS] node_modules OK ($NodeModulesCount dependencias)" -ForegroundColor Green
    }
}

Write-Host "[COMPLETE] VERIFICACION DE DEPENDENCIAS COMPLETADA" -ForegroundColor Cyan
Write-Host "[READY] El proyecto esta listo para ejecutarse" -ForegroundColor Green
