@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22.5+ is required. Install from https://nodejs.org & pause & exit /b 1)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<22||(v[0]===22&&v[1]<5)){console.error('Brightloop requires Node.js 22.5 or newer.');process.exit(1)}" || (pause & exit /b 1)
if not exist .env (
  echo PORT=4000> .env
  echo JWT_SECRET=change-this-secret-before-production-please-1234567890>> .env
  echo DATABASE_FILE=./data/brightloop.sqlite>> .env
  echo APP_URL=http://localhost:4000>> .env
)
if not exist node_modules\express\package.json npm install
if errorlevel 1 (pause & exit /b 1)
start "Brightloop" http://localhost:4000
npm start
pause
