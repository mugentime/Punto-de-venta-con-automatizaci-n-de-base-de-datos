@echo off
echo Ejecutando aumento de precios del 25%...
curl -X POST https://hotfix-production.up.railway.app/api/products/increase-prices -H "Content-Type: application/json" -d "{\"percentage\":25}"
echo.
echo Aumento completado!
pause
