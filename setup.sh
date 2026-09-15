#!/usr/bin/env bash
set -e

echo "============================================"
echo "  Operations Control System - First-time Setup"
echo "============================================"
echo

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — please edit it and set NEXTAUTH_SECRET"
  echo "before continuing (a text editor will not open automatically on macOS/Linux)."
  read -p "Press Enter once you've edited .env..."
fi

echo "Starting the database (Docker)..."
docker compose up -d db

echo "Waiting for the database to be ready..."
sleep 5

echo "Installing dependencies (this can take a few minutes the first time)..."
npm install

echo "Applying database migrations..."
npm run db:migrate

echo "Seeding roles, admin user, and sample data..."
npm run db:seed

echo
echo "============================================"
echo "  Setup complete! Run ./start.sh to launch the application."
echo "============================================"
