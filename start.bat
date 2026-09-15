@echo off
echo Starting database...
docker compose up -d db

echo Starting Operations Control System at http://localhost:3000 ...
echo (Press Ctrl+C to stop)
call npm run dev
