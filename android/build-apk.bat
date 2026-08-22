@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"
call gradlew.bat assembleDebug
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\padal\OneDrive\Desktop\Raaga.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\padal\OneDrive\Desktop\Raaga-debug.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\Raaga.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\Raaga-debug.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\RaagaX-debug.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\RaagaX.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\public\RaagaX.apk"
    echo APK successfully generated and copied to Desktop as Raaga.apk at: %TIME%
)
