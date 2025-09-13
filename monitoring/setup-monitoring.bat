@echo off
echo ================================================================
echo POS Conejo Negro - Monitoring System Setup
echo ================================================================

echo.
echo 1. Installing monitoring dependencies...
cd monitoring
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install monitoring dependencies
    pause
    exit /b 1
)

echo.
echo 2. Creating directories...
if not exist logs mkdir logs
if not exist data mkdir data  
if not exist reports mkdir reports
if not exist logs\errors mkdir logs\errors

echo.
echo 3. Testing monitoring components...
echo Testing health monitor...
node scripts\health-monitor.js test
if errorlevel 1 (
    echo WARNING: Health monitor test failed
)

echo.
echo Testing alert system...
node scripts\alert-system.js init
if errorlevel 1 (
    echo WARNING: Alert system initialization failed
)

echo.
echo Testing performance monitor...
node scripts\performance-monitor.js test
if errorlevel 1 (
    echo WARNING: Performance monitor test failed
)

echo.
echo 4. Running deployment verification...
node scripts\deployment-checker.js quick
if errorlevel 1 (
    echo WARNING: Quick deployment check failed
)

echo.
echo ================================================================
echo Monitoring System Setup Complete!
echo ================================================================
echo.
echo Available commands:
echo   npm start                 - Start all monitoring services
echo   npm run deploy:quick      - Quick health check
echo   npm run report            - Generate monitoring report
echo   npm run test              - Test all components
echo.
echo Dashboard will be available at:
echo   http://your-deployment-url/monitoring/dashboard
echo.
echo To start monitoring now, run:
echo   npm start
echo.
echo ================================================================
pause