$portableDir = Join-Path $PSScriptRoot "desktopApp\build\windows-portable\Raaga"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
Start-Process -FilePath (Join-Path $portableDir "Raaga.bat") -WorkingDirectory $portableDir
