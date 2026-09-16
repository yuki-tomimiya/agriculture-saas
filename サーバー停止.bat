@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ===== Stop Tillto dev server (port 3000) =====
echo.

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  set "FOUND=1"
  echo Stopping PID %%a ...
  taskkill /F /PID %%a >nul 2>&1
  if errorlevel 1 (
    echo   Failed to stop PID %%a. Try Task Manager.
  )
)

if "!FOUND!"=="0" (
  echo No LISTENING process found on port 3000.
  echo It may already be stopped or running on another port.
)

echo.
pause
endlocal
