# 💰 Cortes de Caja (Cash Cuts) - API Documentation

## 📋 Descripción General

El sistema de Cortes de Caja permite gestionar el flujo de dinero en efectivo del establecimiento mediante:

- **Creación de cortes de caja**: Apertura con monto inicial
- **Gestión de movimientos**: Registro de ventas, gastos y ajustes  
- **Cierre de cortes**: Conteo final y cálculo de diferencias
- **Cortes automáticos**: Programados por cron job
- **Constraintes**: Prevención de múltiples cortes abiertos simultáneamente

---

## 🚀 Endpoints API

### Base URL
- **Desarrollo**: `http://localhost:3000/api/cashcuts`
- **Producción**: `https://pos-conejonegro.onrender.com/api/cashcuts`

### Autenticación
Todos los endpoints requieren autenticación Bearer Token:
```
Authorization: Bearer <token>
```

---

## 📊 Endpoints Principales

### 1. **GET** `/api/cashcuts` - Listar cortes de caja

**Query Parameters:**
- `limit` (number): Límite de resultados (default: 50)
- `offset` (number): Offset para paginación (default: 0)
- `from` (string): Fecha desde (ISO format)
- `to` (string): Fecha hasta (ISO format) 
- `status` (string): Filtrar por estado (`open` | `closed`)

**Response:**
```json
[
  {
    "_id": "ea7b162d696ff615f1506362",
    "id": "ea7b162d696ff615f1506362",
    "status": "open",
    "openingAmount": 1000,
    "closingAmount": null,
    "expectedAmount": 1200.25,
    "difference": null,
    "openedBy": "admin-user",
    "openedAt": "2025-09-10T01:15:00.000Z",
    "closedBy": null,
    "closedAt": null,
    "notes": "Apertura del día",
    "entries": [
      {
        "id": "entry123",
        "type": "sale",
        "amount": 250.50,
        "referenceId": "SALE-001",
        "note": "Venta cafetería",
        "createdAt": "2025-09-10T01:20:00.000Z"
      }
    ],
    "createdAt": "2025-09-10T01:15:00.000Z",
    "updatedAt": "2025-09-10T01:20:00.000Z"
  }
]
```

### 2. **GET** `/api/cashcuts/open` - Obtener corte abierto actual

**Response:**
- **200 OK**: Retorna el corte abierto (mismo formato que arriba)
- **404 Not Found**: No hay corte abierto

### 3. **POST** `/api/cashcuts` - Crear nuevo corte de caja

**Body:**
```json
{
  "openingAmount": 1000,
  "openedBy": "usuario-id",
  "notes": "Notas opcionales"
}
```

**Response:**
- **201 Created**: Corte creado exitosamente
- **409 Conflict**: Ya existe un corte abierto
- **400 Bad Request**: Datos inválidos

### 4. **GET** `/api/cashcuts/:id` - Obtener corte específico

**Response:**
- **200 OK**: Datos del corte
- **404 Not Found**: Corte no encontrado

### 5. **POST** `/api/cashcuts/:id/entries` - Agregar movimiento

**Body:**
```json
{
  "type": "sale|expense|adjustment",
  "amount": 250.75,
  "referenceId": "SALE-001",
  "note": "Descripción del movimiento"
}
```

**Response:**
- **200 OK**: Corte actualizado con el nuevo movimiento
- **404 Not Found**: Corte no encontrado
- **409 Conflict**: Corte no está abierto

### 6. **POST** `/api/cashcuts/:id/close` - Cerrar corte de caja

**Body:**
```json
{
  "closingAmount": 1195.75,
  "closedBy": "usuario-id",
  "notes": "Notas del cierre"
}
```

**Response:**
- **200 OK**: Corte cerrado exitosamente con diferencia calculada
- **404 Not Found**: Corte no encontrado
- **409 Conflict**: Corte ya está cerrado

### 7. **POST** `/api/cashcuts/auto-run` - Ejecutar corte automático

Dispara un corte automático on-demand.

**Response:**
```json
{
  "success": true,
  "message": "Automatic cash cut completed successfully",
  "cashCut": {
    "id": "17574673529847mqbefjcn",
    "totalRecords": 15,
    "totalIncome": 2450.50,
    "totalExpenses": 150.00,
    "netProfit": 2300.50
  }
}
```

---

## 🔧 Variables de Entorno

### Variables Requeridas

| Variable | Descripción | Ejemplo | Default |
|----------|-------------|---------|---------|
| `CASHCUT_CRON` | Expresión cron para cortes automáticos | `0 23 * * *` | `off` |
| `TZ` | Zona horaria para los cortes | `America/Mexico_City` | `UTC` |
| `DATABASE_URL` | URL de base de datos PostgreSQL | `postgresql://...` | `null` |
| `PORT` | Puerto del servidor | `3000` | `3000` |

### Configuraciones de Cron

- **Desactivado**: `CASHCUT_CRON=off`
- **Diario a las 11 PM**: `CASHCUT_CRON="0 23 * * *"`
- **Cada 2 horas**: `CASHCUT_CRON="0 */2 * * *"`
- **Cada 2 minutos** (desarrollo): `CASHCUT_CRON="*/2 * * * *"`

---

## 🛠️ Comandos de Diagnóstico (PowerShell)

### Setup inicial
```powershell
# Variables base
$base = 'http://localhost:3000/api/cashcuts'
$prod = 'https://pos-conejonegro.onrender.com/api/cashcuts'

# Autenticación
$loginBody = @{ email = 'admin@conejonegro.com'; password = 'admin123' } | ConvertTo-Json
$authResponse = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json' -UseBasicParsing
$authData = $authResponse.Content | ConvertFrom-Json
$authHeaders = @{ 'Authorization' = "Bearer $($authData.token)"; 'Content-Type' = 'application/json' }
```

### Comandos de diagnóstico

```powershell
# 1. Health check
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing

# 2. Verificar si hay corte abierto
try { 
  $r = Invoke-WebRequest -Uri "$base/open" -Headers $authHeaders -UseBasicParsing
  $r.Content | ConvertFrom-Json | Format-List 
} catch { 
  Write-Host "No hay corte abierto" 
}

# 3. Listar cortes recientes
$r = Invoke-WebRequest -Uri "${base}?limit=5" -Headers $authHeaders -UseBasicParsing
$r.Content | ConvertFrom-Json | Format-Table -Property _id, status, openingAmount, closingAmount

# 4. Crear corte de prueba
$createBody = @{ openingAmount = 1000; openedBy = 'test-user'; notes = 'Test' } | ConvertTo-Json
Invoke-WebRequest -Uri $base -Method POST -Body $createBody -Headers $authHeaders

# 5. Ejecutar corte automático
Invoke-WebRequest -Uri "$base/auto-run" -Method POST -Headers $authHeaders

# 6. Verificar constraint (debe fallar si hay corte abierto)
$createBody = @{ openingAmount = 500; openedBy = 'test-2' } | ConvertTo-Json
try {
  Invoke-WebRequest -Uri $base -Method POST -Body $createBody -Headers $authHeaders
  Write-Host "ERROR: Constraint no funciona"
} catch {
  Write-Host "OK: Constraint previene múltiples cortes abiertos"
}
```

---

## 🚨 Solución de Problemas

### Error 409 - "Already an open cash cut"
**Causa**: Intento de crear un corte cuando ya hay uno abierto.
**Solución**: 
1. Verificar corte abierto: `GET /api/cashcuts/open`
2. Cerrar el corte actual antes de crear uno nuevo

### Error 401 - Unauthorized  
**Causa**: Token de autenticación faltante o inválido.
**Solución**: 
1. Obtener nuevo token desde `/api/auth/login`
2. Incluir header `Authorization: Bearer <token>`

### Error 404 - Cash cut not found
**Causa**: ID de corte incorrecto o corte no existe.
**Solución**:
1. Verificar ID con `GET /api/cashcuts`
2. Usar ID completo correcto

### Cortes automáticos no funcionan
**Diagnóstico**:
```powershell
# Verificar variable de entorno
$env:CASHCUT_CRON

# Verificar logs del servidor
Get-Content .\logs\backend.out.log -Tail 20

# Probar corte manual
Invoke-WebRequest -Uri "$base/auto-run" -Method POST -Headers $authHeaders
```

### Diferencia inesperada en el cierre
**Diagnóstico**:
```powershell
# Obtener detalles completos del corte
$cutId = "ID_DEL_CORTE"
$r = Invoke-WebRequest -Uri "$base/$cutId" -Headers $authHeaders
$cut = $r.Content | ConvertFrom-Json

# Revisar movimientos
$cut.entries | Format-Table type, amount, note, createdAt

# Verificar cálculo esperado
Write-Host "Apertura: $($cut.openingAmount)"
Write-Host "Esperado: $($cut.expectedAmount)"  
Write-Host "Cierre: $($cut.closingAmount)"
Write-Host "Diferencia: $($cut.difference)"
```

---

## 📈 Estados del Sistema

### Estados de Corte de Caja
- **`open`**: Corte activo, puede recibir movimientos
- **`closed`**: Corte cerrado, solo lectura

### Tipos de Movimientos
- **`sale`**: Venta (suma al expected)
- **`expense`**: Gasto (resta del expected)  
- **`adjustment`**: Ajuste manual (suma al expected)

### Códigos de Respuesta HTTP
- **200 OK**: Operación exitosa
- **201 Created**: Recurso creado
- **400 Bad Request**: Datos inválidos
- **401 Unauthorized**: Sin autenticación
- **403 Forbidden**: Sin permisos
- **404 Not Found**: Recurso no encontrado
- **409 Conflict**: Conflicto de estado (ej: múltiples cortes abiertos)
- **500 Internal Server Error**: Error del servidor

---

## 🔄 Workflow Recomendado

### 1. Apertura del día
```powershell
# Verificar que no hay corte abierto
GET /api/cashcuts/open

# Crear nuevo corte
POST /api/cashcuts
{
  "openingAmount": 1000,
  "openedBy": "cajero-id",
  "notes": "Apertura del día"
}
```

### 2. Durante el día (opcional)
```powershell  
# Agregar movimientos manuales si es necesario
POST /api/cashcuts/:id/entries
{
  "type": "expense",
  "amount": 50,
  "note": "Cambio para cliente"
}
```

### 3. Cierre del día
```powershell
# Contar dinero físico y cerrar
POST /api/cashcuts/:id/close  
{
  "closingAmount": 1245.75,
  "closedBy": "cajero-id",
  "notes": "Cierre del día"
}
```

---

## 🔗 Integración con Frontend

El frontend incluye una interfaz completa para gestionar cortes de caja:

- **Modal de detalles**: Visualización completa con movimientos
- **Botones de acción**: Crear, cerrar, ver detalles  
- **Estado en tiempo real**: Indicador de corte abierto/cerrado
- **Validación**: Prevención de acciones inválidas
- **Notificaciones**: Feedback visual para todas las operaciones

---

*Última actualización: 10 de septiembre de 2025*
*Sistema POS Conejo Negro - Versión 2.0*
