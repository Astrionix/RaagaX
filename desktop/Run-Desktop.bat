@echo off
setlocal
cd /d "%~dp0desktopApp\build\windows-portable\Raaga"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
start "" "Raaga.bat"
endlocal
