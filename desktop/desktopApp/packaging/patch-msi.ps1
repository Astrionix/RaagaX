param(
    [Parameter(Mandatory=$true)]
    [string]$MsiPath
)

if (-not (Test-Path $MsiPath)) {
    Write-Warning "MSI path not found: $MsiPath"
    exit 0
}

$fullPath = (Resolve-Path $MsiPath).Path
$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $installer.GetType().InvokeMember("OpenDatabase", "InvokeMethod", $null, $installer, @($fullPath, 1))

# 1. Disable Windows Restart Manager dialogs
try {
    $v1 = $db.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $db, @("INSERT INTO Property (Property, Value) VALUES ('MSIRESTARTMANAGERCONTROL', 'Disable')"))
    $v1.GetType().InvokeMember("Execute", "InvokeMethod", $null, $v1, $null)
} catch {
    Write-Warning "Property MSIRESTARTMANAGERCONTROL already present or could not be inserted."
}

# 2. Locate FileKey for Raaga.exe dynamically
$fileKey = "file156fed5088993ec19ea4563bb7abb635"
try {
    $vf = $db.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $db, @("SELECT File, FileName FROM File"))
    $vf.GetType().InvokeMember("Execute", "InvokeMethod", $null, $vf, $null)
    $rec = $vf.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $vf, $null)
    while ($rec -ne $null) {
        $fn = $rec.GetType().InvokeMember("StringData", "GetProperty", $null, $rec, @(2))
        if ($fn -match "Raaga\.exe") {
            $fileKey = $rec.GetType().InvokeMember("StringData", "GetProperty", $null, $rec, @(1))
            break
        }
        $rec = $vf.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $vf, $null)
    }
} catch {
    Write-Warning "Could not dynamically read File table, falling back to default key."
}

# 3. Add CustomAction to launch installed application immediately after install
try {
    $v2 = $db.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $db, @("INSERT INTO CustomAction (Action, Type, Source, Target) VALUES ('LaunchRaagaApp', 210, '$fileKey', '')"))
    $v2.GetType().InvokeMember("Execute", "InvokeMethod", $null, $v2, $null)
} catch {
    Write-Warning "CustomAction LaunchRaagaApp already present or could not be inserted."
}

# 4. Schedule CustomAction in InstallExecuteSequence after InstallFinalize (Seq 6601)
try {
    $v3 = $db.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $db, @("INSERT INTO InstallExecuteSequence (Action, Condition, Sequence) VALUES ('LaunchRaagaApp', 'NOT (REMOVE=""ALL"")', 6601)"))
    $v3.GetType().InvokeMember("Execute", "InvokeMethod", $null, $v3, $null)
} catch {
    Write-Warning "InstallExecuteSequence LaunchRaagaApp already present or could not be inserted."
}

$db.GetType().InvokeMember("Commit", "InvokeMethod", $null, $db, $null)
Write-Output "Successfully patched MSI ($MsiPath): Restart Manager disabled & auto-launch enabled."
