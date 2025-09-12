# 🎯 AGENTE SUPERVISOR PRINCIPAL
## Sistema Multi-Instancia TaskMaster con Desktop Commander MCP

### 📋 DESCRIPCIÓN DEL SISTEMA

El **Agente Supervisor Principal** es un sistema avanzado que permite crear múltiples instancias especializadas de TaskMaster, cada una dedicada a manejar un tipo específico de error en la aplicación POS-CONEJONEGRO.

**Capacidades Especiales:**
- 🖥️ **Desktop Commander MCP**: Control completo del escritorio para lanzar múltiples instancias de Warp
- 🔄 **Multi-Instance Management**: Cada error obtiene su propia instancia dedicada
- 📡 **Comunicación Inter-Instancias**: Sistema centralizado de reportes y coordinación
- 🚨 **Alertas Automáticas**: Creación automática de issues en GitHub para errores críticos

### 🏗️ ARQUITECTURA DEL SISTEMA

```
AGENTE SUPERVISOR PRINCIPAL (Esta instancia)
├── 📡 Servidor de Comunicación (Puerto 3001)
├── 🖥️ Desktop Commander MCP
└── 🔧 Gestión de Instancias
    ├── TM-DATABASE-xxx (Errores de Base de Datos)
    ├── TM-API-xxx (Errores de API)
    ├── TM-UI-xxx (Errores de Interfaz)
    ├── TM-AUTH-xxx (Errores de Autenticación)
    └── TM-PERFORMANCE-xxx (Errores de Rendimiento)
```

### 🚀 CÓMO USAR EL SISTEMA

#### 1. Iniciar el Agente Supervisor
```powershell
.\supervisor-dashboard-simple.ps1 -Action start
```

#### 2. Verificar Estado
```powershell
.\supervisor-dashboard-simple.ps1
```

#### 3. Enviar Lista de Errores

**Opción A: Archivo JSON**
```powershell
# Crear archivo de ejemplo
.\supervisor-dashboard-simple.ps1 -Action example

# Procesar errores desde archivo
.\supervisor-dashboard-simple.ps1 -Action errors -ErrorFile errors-example.json
```

**Opción B: Errores de Ejemplo**
```powershell
node error-handler.js --example
```

**Opción C: Modo Interactivo**
```powershell
node error-handler.js --interactive
```

### 📄 FORMATO DE ERRORES

Cada error debe tener la siguiente estructura:

```json
{
  "type": "database",           // Tipo: database, api, ui, auth, performance
  "description": "Error de conexión a la base de datos",
  "priority": "critical",       // Prioridad: critical, high, medium, low
  "details": {                  // Detalles específicos (opcional)
    "error": "Connection timeout",
    "table": "users",
    "query": "SELECT * FROM users WHERE active = 1"
  }
}
```

### 🔧 TIPOS DE ERROR SOPORTADOS

| Tipo | Descripción | Monitoreo Especializado |
|------|-------------|-------------------------|
| `database` | Errores de base de datos | Conexiones, queries, integridad |
| `api` | Errores de endpoints REST | Salud de endpoints, tiempos de respuesta |
| `ui` | Errores de interfaz usuario | Carga de páginas, errores JavaScript |
| `auth` | Errores de autenticación | Fallos de login, validación de tokens |
| `performance` | Errores de rendimiento | Memoria, CPU, latencia de red |

### 🎮 COMANDOS DE CONTROL

#### Dashboard del Supervisor
```powershell
# Estado general
.\supervisor-dashboard-simple.ps1

# Iniciar/Detener
.\supervisor-dashboard-simple.ps1 -Action start
.\supervisor-dashboard-simple.ps1 -Action stop

# Crear archivo de ejemplo
.\supervisor-dashboard-simple.ps1 -Action example
```

#### Error Handler
```powershell
# Procesar desde archivo
node error-handler.js archivo.json

# Errores de ejemplo
node error-handler.js --example

# Modo interactivo
node error-handler.js --interactive
```

#### API REST del Supervisor
```powershell
# Estado del supervisor
curl http://localhost:3001/status

# Ver respuesta en formato JSON
Invoke-RestMethod -Uri "http://localhost:3001/status"
```

### 📊 FLUJO DE TRABAJO

1. **Envío de Errores**: El usuario envía una lista de errores al Agente Supervisor
2. **Creación de Instancias**: Para cada error, se crea una instancia especializada
3. **Lanzamiento de Warp**: Desktop Commander MCP abre una nueva ventana de Warp por instancia
4. **Inicialización**: Cada instancia se configura con monitoreo especializado
5. **Monitoreo Continuo**: Las instancias monitoran y reportan al supervisor
6. **Alertas Automáticas**: Errores críticos crean issues automáticamente en GitHub

### 🔍 EJEMPLO PRÁCTICO

Si envías estos errores:

```json
[
  {
    "type": "database",
    "description": "Error de conexión a la base de datos",
    "priority": "critical"
  },
  {
    "type": "api",
    "description": "Endpoint /api/users devuelve 500",
    "priority": "high"
  },
  {
    "type": "ui",
    "description": "Botón de login no responde en móvil",
    "priority": "medium"
  }
]
```

El sistema creará automáticamente:
- **TM-DATABASE-xxx**: Instancia dedicada a monitorear problemas de base de datos
- **TM-API-xxx**: Instancia dedicada a monitorear endpoints de API
- **TM-UI-xxx**: Instancia dedicada a monitorear problemas de interfaz

Cada una ejecutándose en su propia ventana de Warp y reportando al supervisor central.

### 📁 ESTRUCTURA DE ARCHIVOS

```
POS-CONEJONEGRO/
├── supervisor-agent.js              # Agente supervisor principal
├── error-handler.js                 # Interfaz para enviar errores
├── supervisor-dashboard-simple.ps1  # Dashboard de control
├── instances/                       # Directorios de instancias
│   ├── TM-DATABASE-xxx/
│   ├── TM-API-xxx/
│   └── TM-UI-xxx/
├── supervisor-logs/                 # Logs de instancias
├── reports/                         # Reportes del supervisor
└── templates/                       # Templates de configuración
```

### 🚨 ALERTAS Y ESCALAMIENTO

- **Errores Critical**: Crean issues automáticamente en GitHub con label "critical"
- **Errores High**: Se registran y alertan cada 15 segundos
- **Errores Medium/Low**: Se monitorean según intervalos configurados

### 🔄 ESTADO ACTUAL

✅ **Agente Supervisor**: OPERACIONAL  
✅ **Desktop Commander MCP**: ACTIVO  
✅ **Servidor de Comunicación**: Puerto 3001 ACTIVO  
✅ **Integración GitHub**: CONFIGURADA  
✅ **Integración Render**: CONFIGURADA  

### 📞 SOPORTE

El sistema está completamente configurado y listo para recibir tu lista de errores. Solo necesitas:

1. Enviarme tu lista de errores de la aplicación
2. El sistema creará automáticamente una instancia especializada para cada error
3. Cada instancia monitoreará y reportará sobre ese tipo específico de problema

**¡El Agente Supervisor está esperando tus errores para crear las instancias especializadas!** 🎯
