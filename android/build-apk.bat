@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"
call gradlew.bat clean assembleDebug
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\padal\OneDrive\Desktop\RaagaX.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\RaagaX.apk"
    echo APK successfully generated as RaagaX.apk at: %TIME%
)
