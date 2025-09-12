# SUPERVISOR AGENT DASHBOARD
# Dashboard de control para múltiples instancias TaskMaster
# Capacidades: Desktop Commander MCP + Multi-Instance Management

param(
    [string]$Action = "status",
    [string]$InstanceId = "",
    [string]$ErrorFile = ""
)

function Show-SupervisorHeader {
    Write-Host ""
    Write-Host "🎯 AGENTE SUPERVISOR PRINCIPAL - DASHBOARD DE CONTROL" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Gray
    Write-Host "📋 Capacidades: Desktop Commander MCP + Multi-Instance Management" -ForegroundColor Yellow
    Write-Host "🏗️ Proyecto: POS-CONEJONEGRO" -ForegroundColor Gray
    Write-Host ""
}

function Show-SupervisorStatus {
    Show-SupervisorHeader
    
    Write-Host "📊 ESTADO DEL SUPERVISOR:" -ForegroundColor Yellow
    
    # Verificar si el supervisor está ejecutándose
    $supervisorProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*supervisor-agent.js*" 
    }
    
    if ($supervisorProcess) {
        Write-Host "✅ Supervisor Agent: EJECUTÁNDOSE (PID: $($supervisorProcess.Id))" -ForegroundColor Green
        Write-Host "   Memoria: $([math]::Round($supervisorProcess.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "   Iniciado: $($supervisorProcess.StartTime)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Supervisor Agent: NO EJECUTÁNDOSE" -ForegroundColor Red
        Write-Host "   Para iniciar: .\supervisor-dashboard.ps1 -Action start" -ForegroundColor Yellow
    }
    
    # Verificar servidor de comunicación
    Write-Host "`n📡 SERVIDOR DE COMUNICACIÓN:" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 5
        Write-Host "✅ Puerto 3001: ACTIVO" -ForegroundColor Green
        Write-Host "   Instancias totales: $($response.instances.total)" -ForegroundColor Gray
        Write-Host "   Instancias activas: $($response.instances.active)" -ForegroundColor Gray
        Write-Host "   Supervisor ID: $($response.supervisor.id)" -ForegroundColor Gray
        Write-Host "   Uptime: $([math]::Round($response.supervisor.uptime, 2)) segundos" -ForegroundColor Gray
        
        if ($response.instances.list.Count -gt 0) {
            Write-Host "`n🔧 INSTANCIAS ACTIVAS:" -ForegroundColor Yellow
            foreach ($instance in $response.instances.list) {
                $statusIcon = switch ($instance.status) {
                    "running" { "✅" }
                    "starting" { "🔄" }
                    "inactive" { "❌" }
                    default { "⚠️" }
                }
                Write-Host "   $statusIcon $($instance.id) ($($instance.type)) - $($instance.status)" -ForegroundColor Gray
                Write-Host "      Creado: $($instance.createdAt)" -ForegroundColor DarkGray
                if ($instance.lastReportTime) {
                    Write-Host "      Último reporte: $($instance.lastReportTime)" -ForegroundColor DarkGray
                }
            }
        }
    } catch {
        Write-Host "❌ Puerto 3001: NO ACCESIBLE" -ForegroundColor Red
        Write-Host "   El servidor de comunicación no está respondiendo" -ForegroundColor Yellow
    }
    
    # Verificar directorios de trabajo
    Write-Host "`n📁 ESTRUCTURA DE DIRECTORIOS:" -ForegroundColor Yellow
    $directories = @("instances", "supervisor-logs", "templates", "reports")
    foreach ($dir in $directories) {
        if (Test-Path $dir) {
            $itemCount = (Get-ChildItem $dir -ErrorAction SilentlyContinue).Count
            Write-Host "✅ $dir/ ($itemCount elementos)" -ForegroundColor Green
        } else {
            Write-Host "❌ $dir/ (no existe)" -ForegroundColor Red
        }
    }
    
    Show-AvailableCommands
}

function Start-Supervisor {
    Write-Host "🚀 INICIANDO AGENTE SUPERVISOR..." -ForegroundColor Green
    
    # Verificar si ya está ejecutándose
    $existing = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*supervisor-agent.js*" 
    }
    
    if ($existing) {
        Write-Host "⚠️ El Supervisor Agent ya está ejecutándose (PID: $($existing.Id))" -ForegroundColor Yellow
        Write-Host "   Para reiniciar, usa: .\supervisor-dashboard.ps1 -Action restart" -ForegroundColor Cyan
        return
    }
    
    # Configurar entorno
    . .\setup-env-simple.ps1
    
    # Iniciar supervisor en proceso en background
    $supervisorProcess = Start-Process -FilePath "node" -ArgumentList "supervisor-agent.js" -WindowStyle Hidden -PassThru
    
    Write-Host "✅ Supervisor Agent iniciado (PID: $($supervisorProcess.Id))" -ForegroundColor Green
    Write-Host "📡 Servidor de comunicación estará disponible en http://localhost:3001" -ForegroundColor Cyan
    Write-Host "🔄 Esperando inicialización..." -ForegroundColor Yellow
    
    # Esperar a que el servidor esté listo
    $timeout = 30
    $elapsed = 0
    do {
        Start-Sleep -Seconds 2
        $elapsed += 2
        try {
            $null = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 2
            Write-Host "✅ Supervisor Agent operacional y listo" -ForegroundColor Green
            return
        } catch {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
    } while ($elapsed -lt $timeout)
    
    Write-Host "`n⚠️ Timeout esperando respuesta del supervisor. Puede estar iniciando aún." -ForegroundColor Yellow
}

function Stop-Supervisor {
    Write-Host "🛑 DETENIENDO AGENTE SUPERVISOR..." -ForegroundColor Red
    
    $supervisorProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*supervisor-agent.js*" 
    }
    
    if ($supervisorProcess) {
        Stop-Process -Id $supervisorProcess.Id -Force
        Write-Host "✅ Supervisor Agent detenido (PID: $($supervisorProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "ℹ️ No se encontró ningún Supervisor Agent ejecutándose" -ForegroundColor Blue
    }
    
    # También detener instancias hijas si las hay
    $childProcesses = Get-Process -Name "warp" -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -eq "warp"
    }
    
    if ($childProcesses) {
        Write-Host "🔄 Deteniendo $($childProcesses.Count) instancia(s) de Warp..." -ForegroundColor Yellow
        foreach ($process in $childProcesses) {
            try {
                Stop-Process -Id $process.Id -Force
            } catch {
                Write-Host "⚠️ No se pudo detener proceso $($process.Id)" -ForegroundColor Yellow
            }
        }
        Write-Host "✅ Instancias de Warp detenidas" -ForegroundColor Green
    }
}

function Restart-Supervisor {
    Write-Host "🔄 REINICIANDO AGENTE SUPERVISOR..." -ForegroundColor Yellow
    Stop-Supervisor
    Start-Sleep -Seconds 3
    Start-Supervisor
}

function Process-ErrorFile {
    param($FilePath)
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "❌ Archivo no encontrado: $FilePath" -ForegroundColor Red
        return
    }
    
    Write-Host "📋 PROCESANDO ARCHIVO DE ERRORES: $FilePath" -ForegroundColor Cyan
    
    try {
        $content = Get-Content $FilePath -Raw | ConvertFrom-Json
        Write-Host "✅ Archivo cargado: $($content.Count) errores encontrados" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error leyendo archivo JSON: $($_.Exception.Message)" -ForegroundColor Red
        return
    }
    
    # Ejecutar el error handler
    Write-Host "🚀 Iniciando Error Handler..." -ForegroundColor Green
    try {
        & node "error-handler.js" $FilePath
        Write-Host "✅ Errores procesados exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error procesando errores: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-InstanceDetails {
    param($InstanceId)
    
    if (-not $InstanceId) {
        Write-Host "❌ ID de instancia requerido" -ForegroundColor Red
        Write-Host "Uso: .\supervisor-dashboard.ps1 -Action instance -InstanceId TM-DATABASE-123..." -ForegroundColor Yellow
        return
    }
    
    Write-Host "🔍 DETALLES DE INSTANCIA: $InstanceId" -ForegroundColor Cyan
    Write-Host "═".repeat(60) -ForegroundColor Gray
    
    # Verificar si la instancia existe
    $instanceDir = "instances\$InstanceId"
    if (-not (Test-Path $instanceDir)) {
        Write-Host "❌ Instancia no encontrada: $InstanceId" -ForegroundColor Red
        return
    }
    
    Write-Host "📁 Directorio: $instanceDir" -ForegroundColor Gray
    
    # Mostrar archivos de la instancia
    $files = Get-ChildItem $instanceDir -ErrorAction SilentlyContinue
    if ($files) {
        Write-Host "`n📄 ARCHIVOS:" -ForegroundColor Yellow
        foreach ($file in $files) {
            Write-Host "   $($file.Name) ($($file.Length) bytes)" -ForegroundColor Gray
        }
    }
    
    # Mostrar configuración si existe
    $configPath = "$instanceDir\taskmaster.config.json"
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath | ConvertFrom-Json
            Write-Host "`n⚙️ CONFIGURACIÓN:" -ForegroundColor Yellow
            Write-Host "   Nombre: $($config.name)" -ForegroundColor Gray
            Write-Host "   Instance ID: $($config.instanceId)" -ForegroundColor Gray
            Write-Host "   Tipo de Error: $($config.errorHandling.type)" -ForegroundColor Gray
            Write-Host "   Prioridad: $($config.errorHandling.priority)" -ForegroundColor Gray
            Write-Host "   Descripción: $($config.errorHandling.description)" -ForegroundColor Gray
        } catch {
            Write-Host "⚠️ Error leyendo configuración" -ForegroundColor Yellow
        }
    }
    
    # Mostrar logs si existen
    $logPath = "supervisor-logs\$InstanceId.log"
    if (Test-Path $logPath) {
        Write-Host "`n📝 ÚLTIMAS LÍNEAS DEL LOG:" -ForegroundColor Yellow
        try {
            $logLines = Get-Content $logPath -Tail 10
            foreach ($line in $logLines) {
                Write-Host "   $line" -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "⚠️ Error leyendo log" -ForegroundColor Yellow
        }
    }
}

function Show-ExampleErrorFile {
    Write-Host "📋 CREANDO ARCHIVO DE EJEMPLO: errors-example.json" -ForegroundColor Cyan
    
    $exampleErrors = @(
        @{
            type = "database"
            description = "Error de conexión a la base de datos"
            priority = "critical"
            details = @{
                error = "Connection timeout"
                table = "users"
                query = "SELECT * FROM users WHERE active = 1"
            }
        },
        @{
            type = "api" 
            description = "Endpoint /api/users devuelve 500"
            priority = "high"
            details = @{
                endpoint = "/api/users"
                method = "GET"
                statusCode = 500
                responseTime = 15000
            }
        },
        @{
            type = "ui"
            description = "Botón de login no responde en móvil"
            priority = "medium"
            details = @{
                component = "login-button"
                platform = "mobile"
                browser = "Safari iOS"
            }
        }
    )
    
    $exampleErrors | ConvertTo-Json -Depth 3 | Set-Content "errors-example.json"
    Write-Host "✅ Archivo creado: errors-example.json" -ForegroundColor Green
    Write-Host "📝 Para procesar: .\supervisor-dashboard.ps1 -Action errors -ErrorFile errors-example.json" -ForegroundColor Cyan
}

function Show-AvailableCommands {
    Write-Host "`n🎮 COMANDOS DISPONIBLES:" -ForegroundColor Cyan
    Write-Host "═".repeat(50) -ForegroundColor Gray
    Write-Host "   .\supervisor-dashboard.ps1                           # Mostrar status" -ForegroundColor White
    Write-Host "   .\supervisor-dashboard.ps1 -Action start             # Iniciar supervisor" -ForegroundColor White  
    Write-Host "   .\supervisor-dashboard.ps1 -Action stop              # Detener supervisor" -ForegroundColor White
    Write-Host "   .\supervisor-dashboard.ps1 -Action restart           # Reiniciar supervisor" -ForegroundColor White
    Write-Host "   .\supervisor-dashboard.ps1 -Action errors -ErrorFile errors.json  # Procesar errores" -ForegroundColor White
    Write-Host "   .\supervisor-dashboard.ps1 -Action instance -InstanceId ID  # Ver instancia específica" -ForegroundColor White
    Write-Host "   .\supervisor-dashboard.ps1 -Action example           # Crear archivo de ejemplo" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 EJEMPLOS RÁPIDOS:" -ForegroundColor Yellow
    Write-Host "   node error-handler.js --example                     # Procesar errores de ejemplo" -ForegroundColor Gray
    Write-Host "   node error-handler.js --interactive                 # Modo interactivo" -ForegroundColor Gray
    Write-Host "   curl http://localhost:3001/status                   # API del supervisor" -ForegroundColor Gray
    Write-Host ""
}

# Ejecutar acción basada en parámetros
switch ($Action.ToLower()) {
    "start" { Start-Supervisor }
    "stop" { Stop-Supervisor }
    "restart" { Restart-Supervisor }
    "errors" { 
        if ($ErrorFile) {
            Process-ErrorFile $ErrorFile
        } else {
            Write-Host "❌ Archivo de errores requerido" -ForegroundColor Red
            Write-Host "Uso: .\supervisor-dashboard.ps1 -Action errors -ErrorFile errors.json" -ForegroundColor Yellow
        }
    }
    "instance" { Show-InstanceDetails $InstanceId }
    "example" { Show-ExampleErrorFile }
    default { Show-SupervisorStatus }
}
