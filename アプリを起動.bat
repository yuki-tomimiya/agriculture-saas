@echo off
cd /d "%~dp0"

if not exist "package.json" (
  echo ERROR: package.json not found in this folder.
  pause
  exit /b 1
)

echo ===== Tillto app launcher =====
echo.

if not exist "node_modules" (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
  echo.
)

if not exist "node_modules\.prisma" (
  echo [2/3] Generating Prisma Client...
  call npx prisma generate
  if errorlevel 1 (
    echo ERROR: prisma generate failed.
    pause
    exit /b 1
  )
  echo.
)

if not exist "prisma\dev.db" (
  echo [3/3] Setting up database...
  call npx prisma migrate dev --name init
  if errorlevel 1 (
    echo ERROR: prisma migrate failed.
    pause
    exit /b 1
  )
  echo.
)

echo Starting dev server on http://localhost:3000
echo Browser will open in ~10 seconds.
echo Press Ctrl+C in this window to stop.
echo.

start "tillto-open-browser" /min cmd /c "ping -n 11 127.0.0.1 >nul & start http://localhost:3000"

call npm run dev
if errorlevel 1 (
  echo.
  echo ERROR: dev server failed to start.
  pause
  exit /b 1
)

pause
