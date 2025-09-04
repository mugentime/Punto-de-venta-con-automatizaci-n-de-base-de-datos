@echo off
echo 🚀 Railway Direct Log Access
echo ============================

echo.
echo 🔗 Linking to POS project...
railway link --project POS

echo.
echo 📊 Checking environment variables...
railway vars | findstr -i database

echo.
echo 📜 Getting recent logs (last 100 lines)...
railway logs --tail 100 > railway-logs-output.txt

echo.
echo ✅ Logs saved to railway-logs-output.txt
echo 🔍 Analyzing for DATABASE_URL issues...

echo.
echo 📊 DATABASE_URL mentions in logs:
findstr /i "database_url" railway-logs-output.txt

echo.
echo 📊 PostgreSQL mentions in logs:
findstr /i "postgres" railway-logs-output.txt

echo.
echo 📊 File-based storage mentions:
findstr /i "file-based" railway-logs-output.txt

echo.
echo 📊 Environment variable mentions:
findstr /i "environment" railway-logs-output.txt

echo.
echo ✅ Log analysis complete!
echo 📁 Full logs available in: railway-logs-output.txt