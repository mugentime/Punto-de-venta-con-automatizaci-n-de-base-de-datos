# 🚀 Script de despliegue automatizado - POS Conejo Negro
# Reportes modernizados con gráficas interactivas

Write-Host "🚀 DESPLIEGUE AUTOMATIZADO - CONEJO NEGRO POS" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuración Railway
$RAILWAY_TOKEN = "e0ae87e0-75e3-4db6-bebe-8286df2b7a10"
$RAILWAY_API_KEY = "00a98eb4-3969-4e8e-8b0f-c333090ac1d1"

Write-Host "Configurando autenticacion Railway..." -ForegroundColor Yellow
$env:RAILWAY_TOKEN = $RAILWAY_TOKEN

try {
    Write-Host "📋 Verificando Railway CLI..." -ForegroundColor Green
    railway version
    
    Write-Host "Iniciando sesion en Railway..." -ForegroundColor Green
    railway login --token $RAILWAY_TOKEN
    
    Write-Host "📊 Estado actual del proyecto:" -ForegroundColor Green
    railway status
    
    Write-Host "Variables de entorno:" -ForegroundColor Green
    railway variables
    
    Write-Host ""
    Write-Host "🚀 Iniciando despliegue..." -ForegroundColor Magenta
    Write-Host "📈 Nuevas características:" -ForegroundColor White
    Write-Host "  ✅ Dashboard de reportes completamente rediseñado" -ForegroundColor Green
    Write-Host "  ✅ 4 tipos de gráficas interactivas (Chart.js)" -ForegroundColor Green
    Write-Host "  ✅ Tarjetas de métricas con animaciones" -ForegroundColor Green
    Write-Host "  ✅ Actividad reciente visual" -ForegroundColor Green
    Write-Host "  ✅ Integración de cortes de caja automatizados" -ForegroundColor Green
    Write-Host "  ✅ Diseño responsive para móviles" -ForegroundColor Green
    Write-Host ""
    
    # Despliegue
    railway up --detach
    
    Write-Host ""
    Write-Host "✅ DESPLIEGUE COMPLETADO!" -ForegroundColor Green
    Write-Host "=========================" -ForegroundColor Green
    
    Write-Host "🌐 Obteniendo URL de acceso..." -ForegroundColor Yellow
    railway domain
    
    Write-Host ""
    Write-Host "📱 Acceso directo a los nuevos reportes:" -ForegroundColor Cyan
    $domain = railway domain | Select-String -Pattern "https://" | ForEach-Object { $_.Line.Trim() }
    if ($domain) {
        Write-Host "$domain/online" -ForegroundColor White
        Write-Host ""
        Write-Host "🎯 Ve directamente a Reportes para ver las nuevas gráficas!" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🎉 ¡El dashboard modernizado está listo!" -ForegroundColor Green
    Write-Host "   Los usuarios ahora verán gráficas interactivas" -ForegroundColor White
    Write-Host "   en lugar de números aburridos." -ForegroundColor White
    
} catch {
    Write-Host "❌ Error durante el despliegue:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Soluciones posibles:" -ForegroundColor Yellow
    Write-Host "  1. Verificar que Railway CLI esté instalado" -ForegroundColor White
    Write-Host "  2. Revisar token de acceso" -ForegroundColor White
    Write-Host "  3. Verificar conexión a internet" -ForegroundColor White
}

Write-Host ""
Read-Host "Presiona Enter para continuar"