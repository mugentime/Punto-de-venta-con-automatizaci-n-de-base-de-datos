@echo off
echo 🔍 Getting Railway Logs for POS System
echo ========================================

echo.
echo 📊 Getting variables for POS-CONEJONEGRO service...
railway variables --service POS-CONEJONEGRO

echo.
echo 📜 Getting logs for POS-CONEJONEGRO service...
railway logs --service POS-CONEJONEGRO

echo.
echo ✅ Railway log analysis complete!