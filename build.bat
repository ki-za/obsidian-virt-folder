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

echo Copying files...
cd /d "%~dp0"
move /y src\main.js main.js
copy /y src\styles.css styles.css

echo.
echo Build complete!
pause
