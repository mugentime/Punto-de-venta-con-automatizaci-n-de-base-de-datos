# SUPERVISOR AGENT DASHBOARD - Simple Version
# Dashboard de control para multiples instancias TaskMaster

param(
    [string]$Action = "status",
    [string]$ErrorFile = ""
)

function Show-SupervisorStatus {
    Write-Host ""
    Write-Host "AGENTE SUPERVISOR PRINCIPAL - DASHBOARD DE CONTROL" -ForegroundColor Cyan
    Write-Host "===================================================" -ForegroundColor Gray
    Write-Host "Capacidades: Desktop Commander MCP + Multi-Instance Management" -ForegroundColor Yellow
    Write-Host "Proyecto: POS-CONEJONEGRO" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "ESTADO DEL SUPERVISOR:" -ForegroundColor Yellow
    
    # Verificar si el supervisor esta ejecutandose
    $supervisorProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.ProcessName -eq "node" 
    }
    
    if ($supervisorProcess) {
        Write-Host "Supervisor Agent: EJECUTANDOSE" -ForegroundColor Green
        Write-Host "PID: $($supervisorProcess[0].Id)" -ForegroundColor Gray
    } else {
        Write-Host "Supervisor Agent: NO EJECUTANDOSE" -ForegroundColor Red
        Write-Host "Para iniciar: .\supervisor-dashboard-simple.ps1 -Action start" -ForegroundColor Yellow
    }
    
    # Verificar servidor de comunicacion
    Write-Host ""
    Write-Host "SERVIDOR DE COMUNICACION:" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 5
        Write-Host "Puerto 3001: ACTIVO" -ForegroundColor Green
        Write-Host "Instancias totales: $($response.instances.total)" -ForegroundColor Gray
        Write-Host "Instancias activas: $($response.instances.active)" -ForegroundColor Gray
    } catch {
        Write-Host "Puerto 3001: NO ACCESIBLE" -ForegroundColor Red
        Write-Host "El servidor de comunicacion no esta respondiendo" -ForegroundColor Yellow
    }
    
    Show-AvailableCommands
}

function Start-Supervisor {
    Write-Host "INICIANDO AGENTE SUPERVISOR..." -ForegroundColor Green
    
    # Configurar entorno
    . .\setup-env-simple.ps1
    
    # Iniciar supervisor
    $supervisorProcess = Start-Process -FilePath "node" -ArgumentList "supervisor-agent.js" -WindowStyle Hidden -PassThru
    
    Write-Host "Supervisor Agent iniciado (PID: $($supervisorProcess.Id))" -ForegroundColor Green
    Write-Host "Servidor de comunicacion estara disponible en http://localhost:3001" -ForegroundColor Cyan
    
    # Esperar a que el servidor este listo
    Write-Host "Esperando inicializacion..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 5
        Write-Host "Supervisor Agent operacional y listo" -ForegroundColor Green
    } catch {
        Write-Host "Supervisor iniciado, puede tardar unos segundos en estar listo" -ForegroundColor Yellow
    }
}

function Stop-Supervisor {
    Write-Host "DETENIENDO AGENTE SUPERVISOR..." -ForegroundColor Red
    
    $supervisorProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($supervisorProcess) {
        foreach ($process in $supervisorProcess) {
            Stop-Process -Id $process.Id -Force
        }
        Write-Host "Supervisor Agent detenido" -ForegroundColor Green
    } else {
        Write-Host "No se encontro ningun Supervisor Agent ejecutandose" -ForegroundColor Blue
    }
}

function Process-ErrorFile {
    param($FilePath)
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "Archivo no encontrado: $FilePath" -ForegroundColor Red
        return
    }
    
    Write-Host "PROCESANDO ARCHIVO DE ERRORES: $FilePath" -ForegroundColor Cyan
    
    try {
        $content = Get-Content $FilePath -Raw | ConvertFrom-Json
        Write-Host "Archivo cargado: $($content.Count) errores encontrados" -ForegroundColor Green
    } catch {
        Write-Host "Error leyendo archivo JSON: $($_.Exception.Message)" -ForegroundColor Red
        return
    }
    
    # Ejecutar el error handler
    Write-Host "Iniciando Error Handler..." -ForegroundColor Green
    & node "error-handler.js" $FilePath
    Write-Host "Errores procesados" -ForegroundColor Green
}

function Show-ExampleErrorFile {
    Write-Host "CREANDO ARCHIVO DE EJEMPLO: errors-example.json" -ForegroundColor Cyan
    
    $exampleErrors = @(
        @{
            type = "database"
            description = "Error de conexion a la base de datos"
            priority = "critical"
        },
        @{
            type = "api" 
            description = "Endpoint /api/users devuelve 500"
            priority = "high"
        },
        @{
            type = "ui"
            description = "Boton de login no responde en movil"
            priority = "medium"
        }
    )
    
    $exampleErrors | ConvertTo-Json -Depth 3 | Set-Content "errors-example.json"
    Write-Host "Archivo creado: errors-example.json" -ForegroundColor Green
    Write-Host "Para procesar: .\supervisor-dashboard-simple.ps1 -Action errors -ErrorFile errors-example.json" -ForegroundColor Cyan
}

function Show-AvailableCommands {
    Write-Host ""
    Write-Host "COMANDOS DISPONIBLES:" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Gray
    Write-Host ".\supervisor-dashboard-simple.ps1                    # Mostrar status" -ForegroundColor White
    Write-Host ".\supervisor-dashboard-simple.ps1 -Action start      # Iniciar supervisor" -ForegroundColor White  
    Write-Host ".\supervisor-dashboard-simple.ps1 -Action stop       # Detener supervisor" -ForegroundColor White
    Write-Host ".\supervisor-dashboard-simple.ps1 -Action example    # Crear archivo ejemplo" -ForegroundColor White
    Write-Host ".\supervisor-dashboard-simple.ps1 -Action errors -ErrorFile archivo.json" -ForegroundColor White
    Write-Host ""
    Write-Host "EJEMPLOS RAPIDOS:" -ForegroundColor Yellow
    Write-Host "node error-handler.js --example                     # Procesar errores de ejemplo" -ForegroundColor Gray
    Write-Host "node error-handler.js --interactive                 # Modo interactivo" -ForegroundColor Gray
    Write-Host ""
}

# Ejecutar accion basada en parametros
switch ($Action.ToLower()) {
    "start" { Start-Supervisor }
    "stop" { Stop-Supervisor }
    "errors" { 
        if ($ErrorFile) {
            Process-ErrorFile $ErrorFile
        } else {
            Write-Host "Archivo de errores requerido" -ForegroundColor Red
            Write-Host "Uso: .\supervisor-dashboard-simple.ps1 -Action errors -ErrorFile errors.json" -ForegroundColor Yellow
        }
    }
    "example" { Show-ExampleErrorFile }
    default { Show-SupervisorStatus }
}
