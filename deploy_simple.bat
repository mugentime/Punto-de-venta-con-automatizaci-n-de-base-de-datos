@echo off
echo =============================================
echo 🚀 DESPLIEGUE AUTOMATIZADO - CONEJO NEGRO POS
echo =============================================
echo.
echo 📊 Desplegando nuevos reportes con graficas interactivas...
echo.

REM Login to Railway
echo 🔑 Configurando Railway...
railway login --token e0ae87e0-75e3-4db6-bebe-8286df2b7a10

echo.
echo 🔍 Estado del proyecto:
railway status

echo.
echo 🚀 Iniciando despliegue...
railway up

echo.
echo ✅ Despliegue completado!
echo.
echo 🌐 URL de acceso:
railway domain

echo.
echo 🎯 Ve a la seccion Reportes para ver las nuevas graficas!
echo.
pause