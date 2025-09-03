@echo off
REM Railway Monitor Service - Windows Batch Starter
REM This script starts the monitoring service and keeps it running

echo Starting Railway Monitor Service...

cd /d "%~dp0"

:START
echo [%date% %time%] Starting monitor service...
node monitor-service.js start

REM If the service exits, wait 5 seconds and restart
echo [%date% %time%] Monitor service stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak > nul

goto START