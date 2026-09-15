@echo off
echo ============================================
echo   Operations Control System - First-time Setup
echo ============================================
echo.

if not exist .env (
  copy .env.example .env
  echo Created .env from .env.example - please edit it and set NEXTAUTH_SECRET
  echo before continuing. Opening it now...
  notepad .env
  pause
)

echo Starting the database (Docker)...
docker compose up -d db
if errorlevel 1 (
  echo.
  echo ERROR: Docker did not start the database. Is Docker Desktop running?
  pause
  exit /b 1
)

echo Waiting for the database to be ready...
timeout /t 5 /nobreak >nul

echo Installing dependencies (this can take a few minutes the first time)...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed. See the message above.
  pause
  exit /b 1
)

echo Applying database migrations...
call npm run db:migrate

echo Seeding roles, admin user, and sample data...
call npm run db:seed

echo.
echo ============================================
echo   Setup complete!
echo   Run start.bat to launch the application.
echo ============================================
pause
