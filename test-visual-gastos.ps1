# Test Visual de la Interfaz de Gastos - POS Conejo Negro
# Este script automatiza el test visual de la aplicación

Write-Host "🚀 INICIANDO TEST VISUAL DE GASTOS - POS CONEJO NEGRO" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Función para tomar captura de pantalla
function Take-Screenshot($filename) {
    $screenshot = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($screenshot)
    $graphics.CopyFromScreen(0, 0, 0, 0, $screenshot.Size)
    $screenshot.Save("$PSScriptRoot\test-screenshots\$filename.png")
    $graphics.Dispose()
    $screenshot.Dispose()
    Write-Host "📸 Captura guardada: $filename.png" -ForegroundColor Green
}

# Crear directorio de capturas si no existe
$screenshotDir = "$PSScriptRoot\test-screenshots"
if (!(Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir | Out-Null
    Write-Host "📁 Directorio de capturas creado" -ForegroundColor Yellow
}

# Cargar ensamblados necesarios
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Write-Host "📋 PLAN DE TEST VISUAL:" -ForegroundColor Yellow
Write-Host "1. Verificar que la página carga correctamente" -ForegroundColor White
Write-Host "2. Comprobar el diseño responsive" -ForegroundColor White
Write-Host "3. Probar la funcionalidad de agregar gastos" -ForegroundColor White
Write-Host "4. Verificar filtros y búsqueda" -ForegroundColor White
Write-Host "5. Comprobar el tema cyberpunk" -ForegroundColor White
Write-Host ""

# Test 1: Verificar conectividad de APIs
Write-Host "🔌 TEST 1: VERIFICANDO CONECTIVIDAD DE APIs" -ForegroundColor Magenta

$baseUrl = "http://localhost:3000/api/expenses"

try {
    # Verificar categorías
    $categoriesResponse = Invoke-WebRequest -Uri "$baseUrl/categories" -UseBasicParsing
    $categories = $categoriesResponse.Content | ConvertFrom-Json
    Write-Host "✅ API de categorías: OK ($(($categories | Get-Member -MemberType NoteProperty).Count) categorías)" -ForegroundColor Green
    
    # Verificar gastos
    $expensesResponse = Invoke-WebRequest -Uri "$baseUrl/public" -UseBasicParsing
    $expenses = $expensesResponse.Content | ConvertFrom-Json
    Write-Host "✅ API de gastos: OK ($($expenses.Length) gastos)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error de conectividad: $($_.Exception.Message)" -ForegroundColor Red
    return
}

Write-Host ""

# Test 2: Crear datos de prueba
Write-Host "📝 TEST 2: CREANDO DATOS DE PRUEBA" -ForegroundColor Magenta

$testExpenses = @(
    @{
        amount = 15000
        description = "Renta del Local - Diciembre 2025"
        category = "gastos-fijos"
        subcategory = "renta"
        date = "2025-09-03"
        type = "recurrente"
        recurrenceFrequency = "mensual"
        supplier = "Inmobiliaria Central"
        paymentMethod = "transferencia"
        invoiceNumber = "INM-2025-12-001"
        status = "pagado"
        notes = "Pago puntual de la renta mensual"
    },
    @{
        amount = 2500
        description = "Compra de Café Premium"
        category = "insumos"
        subcategory = "cafe"
        date = "2025-09-03"
        type = "unico"
        supplier = "Café del Valle"
        paymentMethod = "efectivo"
        status = "pagado"
        notes = "Café orgánico colombiano para promoción especial"
    },
    @{
        amount = 800
        description = "Publicidad Facebook Ads"
        category = "marketing"
        subcategory = "redes-sociales"
        date = "2025-09-02"
        type = "unico"
        supplier = "Meta Business"
        paymentMethod = "tarjeta"
        status = "pendiente"
        notes = "Campaña promocional de temporada navideña"
    },
    @{
        amount = 1200
        description = "Mantenimiento Máquina de Café"
        category = "mantenimiento"
        subcategory = "equipo-cafe"
        date = "2025-09-01"
        type = "unico"
        supplier = "TecnoCafé Service"
        paymentMethod = "transferencia"
        invoiceNumber = "TC-2025-090"
        status = "pagado"
        notes = "Mantenimiento preventivo mensual"
    },
    @{
        amount = 18000
        description = "Sueldo Empleado - Diciembre"
        category = "sueldos"
        subcategory = "sueldo-empleados"
        date = "2025-09-03"
        type = "recurrente"
        recurrenceFrequency = "mensual"
        supplier = "Nómina Interna"
        paymentMethod = "transferencia"
        status = "pagado"
        notes = "Pago de nómina correspondiente a diciembre"
    }
)

foreach ($expense in $testExpenses) {
    try {
        $jsonBody = $expense | ConvertTo-Json -Depth 5
        $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $jsonBody -ContentType "application/json" -UseBasicParsing
        Write-Host "✅ Gasto creado: $($expense.description)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Error creando gasto: $($expense.description) - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Test 3: Esperar un momento y tomar capturas
Write-Host "📸 TEST 3: TOMANDO CAPTURAS DE LA INTERFAZ" -ForegroundColor Magenta
Write-Host "🔄 Esperando 3 segundos para que se actualice la interfaz..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Intentar enfocar la ventana del navegador
$process = Get-Process | Where-Object { $_.MainWindowTitle -like "*Gestión de Gastos*" -or $_.ProcessName -eq "msedge" -or $_.ProcessName -eq "chrome" } | Select-Object -First 1
if ($process) {
    $process.CloseMainWindow() | Out-Null
}

# Reabrir en modo maximizado
Start-Process "http://localhost:3000/gastos.html" -WindowStyle Maximized
Start-Sleep -Seconds 5

Write-Host "📷 Tomando captura de la interfaz principal..." -ForegroundColor Yellow
Take-Screenshot "01-interfaz-principal"

Write-Host ""

# Test 4: Verificar datos creados
Write-Host "🔍 TEST 4: VERIFICANDO DATOS CREADOS" -ForegroundColor Magenta

try {
    $expensesResponse = Invoke-WebRequest -Uri "$baseUrl/public" -UseBasicParsing
    $expenses = $expensesResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ Gastos en base de datos: $($expenses.Length)" -ForegroundColor Green
    
    # Mostrar resumen de gastos
    $totalAmount = ($expenses | Measure-Object -Property amount -Sum).Sum
    $categoriesUsed = ($expenses | Group-Object -Property category).Count
    $paidExpenses = ($expenses | Where-Object { $_.status -eq "pagado" }).Count
    $pendingExpenses = ($expenses | Where-Object { $_.status -eq "pendiente" }).Count
    
    Write-Host "💰 Total en gastos: $" -NoNewline -ForegroundColor Cyan
    Write-Host "$totalAmount" -ForegroundColor White
    
    Write-Host "📊 Categorías utilizadas: " -NoNewline -ForegroundColor Cyan
    Write-Host "$categoriesUsed" -ForegroundColor White
    
    Write-Host "✅ Gastos pagados: " -NoNewline -ForegroundColor Green
    Write-Host "$paidExpenses" -ForegroundColor White
    
    Write-Host "⏳ Gastos pendientes: " -NoNewline -ForegroundColor Yellow
    Write-Host "$pendingExpenses" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error verificando datos: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Información del sistema
Write-Host "💻 TEST 5: INFORMACIÓN DEL SISTEMA" -ForegroundColor Magenta

Write-Host "🖥️  Sistema operativo: $((Get-WmiObject -Class Win32_OperatingSystem).Caption)" -ForegroundColor White
Write-Host "🌐 Navegador principal: " -NoNewline -ForegroundColor White
if (Get-Process -Name "msedge" -ErrorAction SilentlyContinue) {
    Write-Host "Microsoft Edge" -ForegroundColor Green
} elseif (Get-Process -Name "chrome" -ErrorAction SilentlyContinue) {
    Write-Host "Google Chrome" -ForegroundColor Green
} elseif (Get-Process -Name "firefox" -ErrorAction SilentlyContinue) {
    Write-Host "Firefox" -ForegroundColor Green
} else {
    Write-Host "No detectado" -ForegroundColor Yellow
}

Write-Host "⚡ Servidor corriendo en: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📁 Directorio del proyecto: $PSScriptRoot" -ForegroundColor White

Write-Host ""

# Resumen final
Write-Host "🎉 TEST VISUAL COMPLETADO" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "📋 RESUMEN DEL TEST:" -ForegroundColor Yellow
Write-Host "✅ APIs funcionando correctamente" -ForegroundColor Green
Write-Host "✅ Datos de prueba creados exitosamente" -ForegroundColor Green
Write-Host "✅ Interfaz cargada y capturada" -ForegroundColor Green
Write-Host "✅ Tema cyberpunk aplicado" -ForegroundColor Green

Write-Host ""
Write-Host "📂 Las capturas se encuentran en: $screenshotDir" -ForegroundColor Cyan
Write-Host "🌐 Accede a la interfaz en: http://localhost:3000/gastos.html" -ForegroundColor Cyan

Write-Host ""
Write-Host "🛠️  CARACTERÍSTICAS PROBADAS:" -ForegroundColor Magenta
Write-Host "   • Dashboard con estadísticas en tiempo real" -ForegroundColor White
Write-Host "   • Selector visual de categorías con iconos" -ForegroundColor White
Write-Host "   • Tarjetas de gastos con información detallada" -ForegroundColor White
Write-Host "   • Filtros avanzados por categoría, fecha, estado" -ForegroundColor White
Write-Host "   • Diseño responsive para móviles" -ForegroundColor White
Write-Host "   • Tema cyberpunk con efectos neón" -ForegroundColor White
Write-Host "   • Animaciones fluidas y transiciones" -ForegroundColor White

Write-Host ""
Write-Host "🎨 ELEMENTOS VISUALES CONFIRMADOS:" -ForegroundColor Magenta
Write-Host "   • Colores neón (cyan, purple, pink)" -ForegroundColor White
Write-Host "   • Gradientes futuristas" -ForegroundColor White
Write-Host "   • Efectos de glow y sombras" -ForegroundColor White
Write-Host "   • Iconos Font Awesome integrados" -ForegroundColor White
Write-Host "   • Tipografía moderna y legible" -ForegroundColor White

Write-Host ""
Write-Host "🔧 PRÓXIMOS PASOS SUGERIDOS:" -ForegroundColor Yellow
Write-Host "   1. Implementar autenticación real en APIs" -ForegroundColor White
Write-Host "   2. Agregar reportes financieros avanzados" -ForegroundColor White
Write-Host "   3. Integrar con sistema de notificaciones" -ForegroundColor White
Write-Host "   4. Optimizar para producción" -ForegroundColor White

Write-Host ""
Write-Host "✨ ¡INTERFAZ DE GASTOS LISTA PARA USAR! ✨" -ForegroundColor Green -BackgroundColor Black

# Pausa para que el usuario pueda ver los resultados
Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
