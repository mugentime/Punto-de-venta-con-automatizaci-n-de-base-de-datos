@echo off
echo 🚀 Iniciando despliegue automatizado a Railway...
echo.

REM Configurar token de Railway
set RAILWAY_TOKEN=e0ae87e0-75e3-4db6-bebe-8286df2b7a10

echo 📋 Configurando Railway CLI...
railway login --token %RAILWAY_TOKEN%

echo.
echo 🔍 Verificando estado actual...
railway status

echo.
echo 📤 Desplegando nueva versión con reportes modernizados...
railway up --detach

echo.
echo ✅ Despliegue iniciado!
echo 📊 Los nuevos reportes con gráficas interactivas estarán disponibles en unos minutos.
echo.
echo 🌐 URL de acceso:
railway domain

pause