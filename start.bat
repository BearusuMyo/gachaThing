@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Gacha Thing
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on your system.
  echo Please install it from https://nodejs.org/ and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    echo.
    pause
    exit /b 1
  )
)

echo Starting the server...
echo Press Ctrl+C here to stop safely.
echo.
node src\server.js

echo.
echo Gacha Thing has stopped.
pause
