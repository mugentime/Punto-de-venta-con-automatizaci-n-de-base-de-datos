# Script para enviar errores al Agente Supervisor existente

param(
    [string]$ErrorFile = "pos-errors.json"
)

Write-Host "ENVIANDO ERRORES AL AGENTE SUPERVISOR" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Gray

# Verificar que el supervisor esta ejecutandose
try {
    $supervisorStatus = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 5
    Write-Host "Supervisor encontrado: $($supervisorStatus.supervisor.id)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: El Agente Supervisor no esta ejecutandose" -ForegroundColor Red
    Write-Host "Ejecuta: .\supervisor-dashboard-simple.ps1 -Action start" -ForegroundColor Yellow
    return
}

# Cargar errores
if (-not (Test-Path $ErrorFile)) {
    Write-Host "ERROR: Archivo no encontrado: $ErrorFile" -ForegroundColor Red
    return
}

try {
    $errors = Get-Content $ErrorFile | ConvertFrom-Json
    Write-Host "Archivo cargado: $($errors.Count) errores encontrados" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo leer el archivo JSON" -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "CREANDO INSTANCIAS ESPECIALIZADAS:" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Gray

# Crear instancias especializadas
$instances = @()
foreach ($error in $errors) {
    $instanceId = "TM-$($error.type.ToUpper())-$(Get-Random -Minimum 1000 -Maximum 9999)"
    
    Write-Host ""
    Write-Host "Creando instancia: $instanceId" -ForegroundColor Cyan
    Write-Host "Tipo: $($error.type)" -ForegroundColor Gray
    Write-Host "Prioridad: $($error.priority)" -ForegroundColor Gray
    Write-Host "Descripcion: $($error.description)" -ForegroundColor Gray
    
    # Crear reporte de instancia
    $report = @{
        instanceId = $instanceId
        errorType = $error.type
        status = "starting"
        message = $error.description
        priority = $error.priority
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        details = $error.details
    }
    
    $instances += $report
    
    # Enviar reporte al supervisor
    try {
        $jsonReport = $report | ConvertTo-Json -Depth 5
        $response = Invoke-RestMethod -Uri "http://localhost:3001/report" -Method Post -Body $jsonReport -ContentType "application/json"
        Write-Host "Instancia reportada al supervisor" -ForegroundColor Green
    } catch {
        Write-Host "Error reportando al supervisor: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Simular inicializacion de Warp
    Write-Host "[SIMULADO] Abriendo nueva ventana Warp para $instanceId..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "RESUMEN DE INSTANCIAS CREADAS:" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Gray

# Mostrar resumen por tipo
$summary = @{}
foreach ($error in $errors) {
    if (-not $summary[$error.type]) {
        $summary[$error.type] = @{ count = 0; priorities = @{} }
    }
    $summary[$error.type].count++
    if (-not $summary[$error.type].priorities[$error.priority]) {
        $summary[$error.type].priorities[$error.priority] = 0
    }
    $summary[$error.type].priorities[$error.priority]++
}

foreach ($type in $summary.Keys) {
    Write-Host ""
    Write-Host "$($type.ToUpper()): $($summary[$type].count) instancia(s)" -ForegroundColor White
    foreach ($priority in $summary[$type].priorities.Keys) {
        Write-Host "   $priority: $($summary[$type].priorities[$priority])" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "ESTADO DEL SUPERVISOR ACTUALIZADO:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Gray

try {
    $finalStatus = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 5
    Write-Host "Instancias totales: $($finalStatus.instances.total)" -ForegroundColor Green
    Write-Host "Instancias activas: $($finalStatus.instances.active)" -ForegroundColor Green
} catch {
    Write-Host "No se pudo obtener el estado actualizado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "TODAS LAS INSTANCIAS HAN SIDO ENVIADAS AL SUPERVISOR" -ForegroundColor Green
Write-Host "Cada tipo de error ahora tiene su propia instancia especializada" -ForegroundColor Cyan
Write-Host "Desktop Commander MCP esta listo para abrir ventanas Warp individuales" -ForegroundColor Yellow

# Mostrar detalles de las instancias creadas
Write-Host ""
Write-Host "INSTANCIAS ESPECIALIZADAS CREADAS:" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Gray

foreach ($instance in $instances) {
    Write-Host ""
    Write-Host "ID: $($instance.instanceId)" -ForegroundColor Cyan
    Write-Host "Tipo: $($instance.errorType)" -ForegroundColor Gray
    Write-Host "Estado: $($instance.status)" -ForegroundColor Gray
    Write-Host "Mensaje: $($instance.message)" -ForegroundColor Gray
    Write-Host "Prioridad: $($instance.priority)" -ForegroundColor Gray
}
