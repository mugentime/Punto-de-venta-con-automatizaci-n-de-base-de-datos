# 🚀 Despliegue Manual - POS Conejo Negro

## Problemas de Autenticación Railway
Los scripts automáticos están teniendo problemas con la autenticación. Usa estos pasos manuales:

## Opción 1: Railway Web Dashboard
1. Ve a https://railway.app/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto "POS-CONEJONEGRO" 
4. Ve a la pestaña "Deployments"
5. Haz clic en "Deploy Now" o conecta el repositorio

## Opción 2: Railway CLI Manual
```bash
# 1. Instalar Railway CLI (si no está instalado)
npm install -g @railway/cli

# 2. Login manual
railway login

# 3. Verificar proyecto
railway status

# 4. Desplegar
railway up
```

## Opción 3: Usar Token Directamente
```bash
# Configurar token en variables de entorno
export RAILWAY_TOKEN=e0ae87e0-75e3-4db6-bebe-8286df2b7a10

# Intentar despliegue
railway up --detach
```

## 📋 Datos del Proyecto
- Token: `e0ae87e0-75e3-4db6-bebe-8286df2b7a10`
- API Key: `00a98eb4-3969-4e8e-8b0f-c333090ac1d1`

## ✅ Características Desplegadas
- ✅ Sistema de cortes de caja automatizado (cada 12 horas)
- ✅ Dashboard de reportes modernizado con Chart.js
- ✅ 4 tipos de gráficas interactivas
- ✅ Tarjetas de métricas animadas
- ✅ Diseño responsive para móviles
- ✅ Integración completa con base de datos

## 🔍 Verificación Post-Despliegue
1. Accede a `/online` para ver el dashboard
2. Ve a la sección "Reportes" 
3. Verifica que las gráficas se muestren correctamente
4. Confirma que el botón "Finalizar Día" funcione
5. Revisa que los cortes automáticos se ejecuten a las 6:00 AM y 6:00 PM