@echo off
setlocal
echo ========================================================
echo  Building Professional Windows Installer (.exe)
echo ========================================================

set "REPO_ROOT=%~dp0"
set "WIX_DIR=%REPO_ROOT%build\wix311"
set "JDK_DIR=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"

if not exist "%JDK_DIR%\bin\jpackage.exe" (
    echo [ERROR] JDK 21 with jpackage not found at: %JDK_DIR%
    pause
    exit /b 1
)

set "JAVA_HOME=%JDK_DIR%"
set "PATH=%WIX_DIR%;%JDK_DIR%\bin;%PATH%"

cd /d "%REPO_ROOT%"
echo.
echo Compiling and packaging standalone installer...
call gradlew.bat :desktopApp:packageExe

if %ERRORLEVEL% equ 0 (
    if not exist "%REPO_ROOT%dist" mkdir "%REPO_ROOT%dist"
    copy /Y "%REPO_ROOT%desktopApp\build\compose\binaries\main\exe\Raaga-*.exe" "%REPO_ROOT%dist\"
    echo.
    echo ========================================================
    echo  SUCCESS! Professional installer is ready in:
    echo  %REPO_ROOT%dist
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
)

pause
endlocal
