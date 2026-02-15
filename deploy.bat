@echo off
set "DEST=C:\Users\user\Documents\kb\.obsidian\plugins\virt-folder"

if not exist "%DEST%" mkdir "%DEST%"
copy /y "%~dp0main.js" "%DEST%\"
copy /y "%~dp0styles.css" "%DEST%\"
copy /y "%~dp0manifest.json" "%DEST%\"

echo.
echo Deployed to %DEST%
pause
