$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'PowerShell 7 on Windows is required' }
# Run only on a disposable runner: the installer writes the QESTIMA HKCU keys.
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Use a disposable GitHub Windows runner for the install test' }
Set-Location (Split-Path $PSScriptRoot -Parent)
$nsisHome = Join-Path ${env:ProgramFiles(x86)} 'NSIS'
$compiler = Join-Path $nsisHome 'makensis.exe'
if (-not (Test-Path $compiler)) { throw "NSIS not found: $compiler" }
node build/create-release.cjs --electron-dist node_modules/electron/dist --electron-version 37.2.6 --nsis $compiler --nsis-dir $nsisHome --output-dir release
if ($LASTEXITCODE -ne 0) { throw 'Release build failed' }
$installers = @(Get-ChildItem release/*Preview-Unsigned.exe)
if ($installers.Count -ne 1) { throw 'Expected exactly one preview installer' }
$testInstall = Join-Path $env:RUNNER_TEMP 'QESTIMA-install-test'
$installer = Start-Process -FilePath $installers[0].FullName -ArgumentList @('/S', "/D=$testInstall") -PassThru
if (-not $installer.WaitForExit(120000)) { $installer.Kill(); throw 'Installer timed out' }
if ($installer.ExitCode -ne 0) { throw "Installer failed: $($installer.ExitCode)" }
$installedExe = Join-Path $testInstall 'QESTIMA.exe'
if (-not (Test-Path $installedExe)) { throw 'Installed executable is missing' }
node tests/windows-open.cjs $installedExe
if ($LASTEXITCODE -ne 0) { throw 'Installed app startup or persistence test failed' }
