@echo off
setlocal
set PORT=3000

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  echo Stopping Gacha Thing ^(PID %%a^)...
  taskkill /PID %%a >nul 2>nul
)

echo Done.
pause
