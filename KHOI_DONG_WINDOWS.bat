@echo off
chcp 65001 >nul
title Smart TKB - Nam Nha Trang
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Chua cai Node.js. Vui long cai Node.js LTS tu https://nodejs.org
 pause
 exit /b 1
)
if not exist "node_modules\vite" (
 echo Dang cai thu vien du an...
 call npm install
 if errorlevel 1 (
  echo Cai dat that bai. Kiem tra ket noi Internet.
  pause
  exit /b 1
 )
)
echo Dang khoi dong Smart TKB...
call npm run dev
pause
