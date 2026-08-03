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

echo [3/6] Starting API Backend (Port 3000)...
start cmd /k "title SERS API && cd services\api && npm run dev"

ping 127.0.0.1 -n 3 >nul

echo [4/6] Starting Hospital Command Dashboard (Port 3002)...
start cmd /k "title SERS Hospital Dashboard && cd apps\web-admin && npm run dev"

echo [5/6] Starting Python ML Microservice (Port 8001)...
start cmd /k "title SERS ML Microservice && cd services\ml && uvicorn main:app --port 8001 --reload"

echo [6/6] Starting Mobile App (Expo)...
start cmd /k "title SERS Mobile App (Expo) && cd apps\mobile && npx expo start"

echo.
echo ========================================================
echo   All core SERS services started!
echo ========================================================
echo   API Backend       : http://localhost:3000
echo   Hospital Dashboard: http://localhost:3002
echo   ML Microservice   : http://localhost:8001
echo   Mobile App (Expo) : http://localhost:8081
echo ========================================================
echo.
pause


