# 🚀 GUÍA PASO A PASO - DEPLOY EN RENDER.COM

## 📋 **REQUISITOS PREVIOS** ✅
- ✅ Repositorio Git committeado y actualizado
- ✅ Package.json configurado para producción  
- ✅ render.yaml creado
- ✅ Endpoints mock eliminados
- ✅ Autenticación configurada

---

## 🔧 **PASO 1: CREAR CUENTA EN RENDER** (2 minutos)

### 1.1 Ir a Render.com
- Ve a: **https://render.com**
- Hacer clic en **"Sign Up"**

### 1.2 Registrarse con GitHub (RECOMENDADO)
- Seleccionar **"Sign up with GitHub"**  
- Autorizar conexión con GitHub
- ✅ **VENTAJA:** Deploy automático desde repositorio

### 1.3 Alternativa: Email
- Crear cuenta con email si prefieres
- Verificar email
- Conectar GitHub después

---

## 🔗 **PASO 2: CONECTAR REPOSITORIO** (3 minutos)

### 2.1 Dashboard de Render
- Una vez logueado, ir al **Dashboard**
- Hacer clic en **"New +"**
- Seleccionar **"Web Service"**

### 2.2 Conectar GitHub
- Seleccionar **"Build and deploy from a Git repository"**
- Hacer clic en **"Connect GitHub"**
- Autorizar Render para acceder a repositorios

### 2.3 Seleccionar Repositorio
- Buscar: **"POS-CONEJONEGRO"** (o el nombre de tu repo)
- Hacer clic en **"Connect"**

---

## ⚙️ **PASO 3: CONFIGURAR WEB SERVICE** (5 minutos)

### 3.1 Información Básica
```
Name: pos-conejo-negro
Region: Oregon (US West) - RECOMENDADO por velocidad
Branch: main
Runtime: Node
```

### 3.2 Build & Deploy Settings
```
Build Command: npm install
Start Command: node server.js
```

### 3.3 Plan de Pricing
- **FREE Plan:** Para pruebas (limitado)  
- **Starter Plan ($7/mes):** RECOMENDADO para producción
  - 512MB RAM
  - Siempre activo
  - SSL incluido
  - Custom domain

---

## 🔐 **PASO 4: VARIABLES DE ENTORNO** (3 minutos)

### 4.1 Scrollear a "Environment Variables"
Agregar las siguientes variables:

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=tu-jwt-secret-super-seguro-aqui
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.2 Variables Opcionales (según tus necesidades)
```bash
# Si usas PostgreSQL de Render (se genera automáticamente)
DATABASE_URL=postgresql://...  # Auto-generada

# Si tienes dominio personalizado
CORS_ORIGIN=https://tu-dominio.com

# Para emails (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-password-app
```

---

## 💾 **PASO 5: BASE DE DATOS** (OPCIONAL - 2 minutos)

### 5.1 Si necesitas PostgreSQL
- En el Dashboard, hacer clic **"New +"**
- Seleccionar **"PostgreSQL"**
- Configurar:
  ```
  Name: pos-conejo-negro-db
  Database Name: pos_conejo_negro
  User: pos_user
  Region: Oregon (US West) - MISMO que el web service
  ```

### 5.2 Plan de Base de Datos
- **FREE:** 1GB, bueno para empezar
- **Starter ($7/mes):** 10GB, recomendado

### 5.3 Conectar a Web Service
- Copiar **DATABASE_URL** de la página de la BD
- Agregar como variable de entorno en el Web Service

---

## 🚀 **PASO 6: DEPLOY** (5 minutos)

### 6.1 Iniciar Deploy
- Hacer clic en **"Create Web Service"**
- Render iniciará el build automáticamente
- ⏱️ Tiempo estimado: **3-5 minutos**

### 6.2 Monitorear Deploy
- Ver logs en tiempo real
- Buscar mensaje: **"Your service is live at..."**

### 6.3 URL de Producción
- Render asignará una URL: `https://pos-conejo-negro-xxxx.onrender.com`
- ✅ SSL incluido automáticamente

---

## ✅ **PASO 7: VERIFICAR FUNCIONAMIENTO** (5 minutos)

### 7.1 Pruebas Básicas
1. **Health Check:** `https://tu-url.onrender.com/api/emergency-test`
2. **Interfaz Principal:** `https://tu-url.onrender.com/`
3. **Login:** `https://tu-url.onrender.com/login.html`
4. **Gastos:** `https://tu-url.onrender.com/gastos.html`

### 7.2 Verificar APIs
```bash
# Debería responder con error 401 (normal, necesita autenticación)
curl https://tu-url.onrender.com/api/expenses/categories
```

### 7.3 Logs de Producción
- En Render Dashboard → Tu Service → **"Logs"**
- Verificar que no hay errores críticos

---

## 🔧 **CONFIGURACIONES ADICIONALES**

### 8.1 Dominio Personalizado (OPCIONAL)
- En Service Settings → **"Custom Domains"**  
- Agregar: `tu-dominio.com`
- Configurar DNS según instrucciones

### 8.2 Deploy Automático
- ✅ **YA CONFIGURADO:** Cada push a `main` despliega automáticamente
- Tiempo de deploy: **2-3 minutos**

### 8.3 Monitoreo
- **Health Checks:** Automáticos cada 30 segundos
- **Uptime:** 99.95% garantizado en Starter plan
- **Logs:** Disponibles en tiempo real

---

## 🔐 **VARIABLES DE ENTORNO COMPLETAS**

### Mínimas Requeridas:
```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=genera-un-secret-muy-fuerte-aqui-32-chars-min
```

### Recomendadas:
```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://tu-dominio-render.onrender.com
```

### Con Base de Datos:
```bash
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

---

## 🚨 **TROUBLESHOOTING COMÚN**

### ❌ Build Fails
**Problema:** `npm install` falla
**Solución:** 
- Verificar que `package.json` tiene todas las dependencias
- Verificar versión de Node.js en `engines`

### ❌ App No Inicia
**Problema:** Start command falla
**Solución:**
- Verificar que `server.js` existe
- Verificar puerto: debe usar `process.env.PORT`

### ❌ Variables de Entorno
**Problema:** App no encuentra variables
**Solución:**
- Verificar que están agregadas en Render Dashboard
- Verificar nombres exactos (case-sensitive)

---

## 📈 **MÉTRICAS ESPERADAS**

### Tiempo de Deploy:
- **Build:** 1-2 minutos
- **Deploy:** 30 segundos  
- **Total:** 2-5 minutos

### Performance:
- **Cold Start:** ~2-3 segundos (FREE tier)
- **Warm Response:** <100ms
- **Uptime:** 99.95%

---

## 💰 **COSTOS**

### Plan FREE:
- ❌ Limitación: Se suspende tras 15 min inactivo
- ❌ No ideal para producción
- ✅ Perfecto para pruebas

### Plan Starter ($7/mes):
- ✅ Siempre activo
- ✅ SSL gratis  
- ✅ Custom domains
- ✅ 512MB RAM
- ✅ **RECOMENDADO para tu equipo**

---

## 🎉 **RESULTADO FINAL**

Una vez completados todos los pasos tendrás:

✅ **URL en vivo:** `https://pos-conejo-negro-xxxx.onrender.com`  
✅ **Deploy automático:** Cada push a GitHub  
✅ **SSL incluido:** HTTPS automático  
✅ **Logs en tiempo real:** Para debugging  
✅ **Uptime 99.95%:** Muy confiable  
✅ **Velocidad:** 2-5 min deploys vs 15+ min Railway  

---

## 🔄 **PRÓXIMOS PASOS**

1. ✅ **Deploy inicial**
2. ✅ **Verificar funcionamiento**
3. ⚠️ **Probar con tu equipo**
4. 💳 **Actualizar a plan Starter** si todo va bien
5. 🌐 **Configurar dominio personalizado** (opcional)

---

**🚀 ¡Tu POS estará funcionando en producción en menos de 20 minutos!**
