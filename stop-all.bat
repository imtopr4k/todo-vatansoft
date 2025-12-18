@echo off
echo Stopping Telegram Todo System...
echo.

REM API sunucusunu durdur
taskkill /FI "WINDOWTITLE eq Telegram-Todo-API*" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [1/3] API Server stopped
) else (
    echo [1/3] API Server was not running
)

REM Bot'u durdur
taskkill /FI "WINDOWTITLE eq Telegram-Todo-Bot*" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [2/3] Telegram Bot stopped
) else (
    echo [2/3] Telegram Bot was not running
)

REM Web frontend'i durdur
taskkill /FI "WINDOWTITLE eq Telegram-Todo-Web*" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [3/3] Web Frontend stopped
) else (
    echo [3/3] Web Frontend was not running
)

echo.
echo ======================================
echo All services stopped
echo ======================================
echo.
pause
