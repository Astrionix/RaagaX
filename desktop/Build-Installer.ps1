Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Building Professional Windows Installer (.exe)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$repoRoot = $PSScriptRoot
$wixDir = Join-Path $repoRoot "build\wix311"
$jdkDir = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"

if (-not (Test-Path (Join-Path $jdkDir "bin\jpackage.exe"))) {
    Write-Host "[ERROR] JDK 21 with jpackage not found at: $jdkDir" -ForegroundColor Red
    pause
    exit 1
}

$env:JAVA_HOME = $jdkDir
$env:PATH = "$wixDir;$jdkDir\bin;" + $env:PATH

Push-Location $repoRoot
try {
    Write-Host "`nCompiling and packaging standalone installer..." -ForegroundColor Yellow
    & .\gradlew.bat :desktopApp:packageExe

    if ($LASTEXITCODE -eq 0) {
        $distDir = Join-Path $repoRoot "dist"
        if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }
        Copy-Item (Join-Path $repoRoot "desktopApp\build\compose\binaries\main\exe\Raaga-*.exe") $distDir -Force
        Write-Host "`n========================================================" -ForegroundColor Green
        Write-Host " SUCCESS! Professional installer is ready in:" -ForegroundColor Green
        Write-Host " $distDir" -ForegroundColor White
        Write-Host "========================================================" -ForegroundColor Green
    } else {
        Write-Host "`n[ERROR] Build failed." -ForegroundColor Red
    }
} finally {
    Pop-Location
}
