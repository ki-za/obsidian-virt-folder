@echo off
set "DEST=C:\Users\user\Documents\kb\.obsidian\plugins\virt-folder"

if not exist "%DEST%" mkdir "%DEST%"
xcopy /y /s "%~dp0release\*" "%DEST%\"

echo.
echo Deployed to %DEST%
pause
