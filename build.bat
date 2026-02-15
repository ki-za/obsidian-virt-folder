@echo off
cd /d "%~dp0src"

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo Building plugin...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo Copying files to release...
cd /d "%~dp0"
if not exist release mkdir release
move /y src\main.js release\main.js
copy /y src\styles.css release\styles.css
copy /y manifest.json release\manifest.json

echo.
echo Build complete! Files are in the release folder.
pause
