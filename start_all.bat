@echo off
echo ========================================================
echo   SERS — Smart Emergency Response System
echo ========================================================

echo [1/5] Starting PostgreSQL and Redis via Docker...
docker-compose up -d

echo [2/5] Running Database Migrations...
cd services\api
call npm run db:migrate || echo Migration skipped or already applied.
call npm run db:seed    || echo Seeding skipped or already applied.
cd ..\..

echo [3/5] Starting API Backend (Port 3000)...
start cmd /k "title SERS API && cd services\api && npm run dev"

timeout /t 2 /nobreak >nul

echo [4/5] Starting Public Website (Port 3001)...
start cmd /k "title SERS Website && cd apps\web-public && npm run dev"

echo [5/5] Starting Admin Dashboard (Port 3002)...
start cmd /k "title SERS Admin && cd apps\web-admin && npm run dev"

echo.
echo ========================================================
echo   All services started!
echo ========================================================
echo   API Backend   : http://localhost:3000
echo   Public Website: http://localhost:3001
echo   Admin Dashboard: http://localhost:3002
echo ========================================================
echo.
pause
