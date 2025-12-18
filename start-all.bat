@echo off
echo Starting Telegram Todo System...
echo.

REM Logs klasörünü oluştur
if not exist "logs" mkdir logs

echo [1/3] Starting API Server...
start "Telegram-Todo-API" cmd /k "cd apps\api && npm run dev"
timeout /t 2 /nobreak > nul

echo [2/3] Starting Telegram Bot...
start "Telegram-Todo-Bot" cmd /k "cd apps\bot && npm run dev"
timeout /t 2 /nobreak > nul

echo [3/3] Starting Web Frontend...
start "Telegram-Todo-Web" cmd /k "cd apps\web && npm run dev"
timeout /t 2 /nobreak > nul

echo.
echo ======================================
echo All services started successfully!
echo ======================================
echo.
echo API:  http://localhost:8080
echo Web:  http://localhost:5173
echo.
echo Press any key to close this window...
pause > nul
