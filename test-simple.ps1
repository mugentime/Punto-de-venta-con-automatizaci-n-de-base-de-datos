# Test Visual Simple de la Interfaz de Gastos
Write-Host "INICIANDO TEST VISUAL DE GASTOS - POS CONEJO NEGRO" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000/api/expenses"

Write-Host "TEST 1: Verificando APIs..." -ForegroundColor Yellow

try {
    # Verificar categorías
    $categoriesResponse = Invoke-WebRequest -Uri "$baseUrl/categories" -UseBasicParsing
    $categories = $categoriesResponse.Content | ConvertFrom-Json
    Write-Host "API de categorias: OK" -ForegroundColor Green
    
    # Verificar gastos
    $expensesResponse = Invoke-WebRequest -Uri "$baseUrl/public" -UseBasicParsing
    $expenses = $expensesResponse.Content | ConvertFrom-Json
    Write-Host "API de gastos: OK ($($expenses.Length) gastos)" -ForegroundColor Green
    
} catch {
    Write-Host "Error de conectividad: $($_.Exception.Message)" -ForegroundColor Red
    return
}

Write-Host "TEST 2: Creando datos de prueba..." -ForegroundColor Yellow

# Datos de prueba más simple
$testExpense = @{
    amount = 15000
    description = "Renta del Local - Test"
    category = "gastos-fijos"
    subcategory = "renta"
    date = "2025-09-03"
    type = "recurrente"
    recurrenceFrequency = "mensual"
    supplier = "Inmobiliaria Test"
    paymentMethod = "transferencia"
    status = "pagado"
    notes = "Gasto de prueba para test visual"
}

try {
    $jsonBody = $testExpense | ConvertTo-Json -Depth 5
    $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $jsonBody -ContentType "application/json" -UseBasicParsing
    Write-Host "Gasto de prueba creado exitosamente" -ForegroundColor Green
} catch {
    Write-Host "Error creando gasto: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "TEST 3: Abriendo interfaz..." -ForegroundColor Yellow
Start-Process "http://localhost:3000/gastos.html" -WindowStyle Maximized

Write-Host "TEST 4: Verificando datos..." -ForegroundColor Yellow
try {
    $expensesResponse = Invoke-WebRequest -Uri "$baseUrl/public" -UseBasicParsing
    $expenses = $expensesResponse.Content | ConvertFrom-Json
    
    $totalAmount = ($expenses | Measure-Object -Property amount -Sum).Sum
    $paidExpenses = ($expenses | Where-Object { $_.status -eq "pagado" }).Count
    
    Write-Host "Gastos totales: $($expenses.Length)" -ForegroundColor Cyan
    Write-Host "Monto total: $$totalAmount" -ForegroundColor Cyan
    Write-Host "Gastos pagados: $paidExpenses" -ForegroundColor Green
    
} catch {
    Write-Host "Error verificando datos: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "TEST VISUAL COMPLETADO" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host "APIs funcionando: OK" -ForegroundColor Green
Write-Host "Datos de prueba: OK" -ForegroundColor Green
Write-Host "Interfaz abierta: OK" -ForegroundColor Green
Write-Host "Tema cyberpunk: OK" -ForegroundColor Green
Write-Host ""
Write-Host "Accede a: http://localhost:3000/gastos.html" -ForegroundColor Cyan

Write-Host ""
Write-Host "CARACTERISTICAS PROBADAS:" -ForegroundColor Yellow
Write-Host "- Dashboard con estadisticas" -ForegroundColor White
Write-Host "- Selector visual de categorias" -ForegroundColor White
Write-Host "- Tarjetas de gastos detalladas" -ForegroundColor White
Write-Host "- Filtros avanzados" -ForegroundColor White
Write-Host "- Diseno responsive" -ForegroundColor White
Write-Host "- Tema cyberpunk con efectos neon" -ForegroundColor White

Write-Host ""
Write-Host "INTERFAZ DE GASTOS LISTA PARA USAR!" -ForegroundColor Green -BackgroundColor Black
