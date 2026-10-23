@echo off
rem Windows 啟動腳本：優先 Python，其次 Node.js（皆非必須安裝兩個）
cd /d "%~dp0"
set PORT=%PORT:8080%

where python >nul 2>nul
if %errorlevel%==0 (
  echo 使用 Python 啟動本機伺服器 -^> http://localhost:%PORT%
  python -m http.server %PORT%
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo 使用 Python(launcher) 啟動本機伺服器 -^> http://localhost:%PORT%
  py -m http.server %PORT%
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  echo 使用 Node.js 啟動本機伺服器 -^> http://localhost:%PORT%
  node scripts\serve.js %PORT%
  goto :eof
)

echo.
echo 找不到 Python 或 Node.js，無法自動啟動。
echo 請安裝 Python 3（https://www.python.org/）或 Node.js（https://nodejs.org/），
echo 或在專案資料夾開終端機執行： python -m http.server 8080
echo.
pause
