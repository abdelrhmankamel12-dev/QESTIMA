param(
  [string]$Installer = "",
  [string]$RuntimeDirectory = "",
  [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) { throw "Windows SDK signtool.exe was not found. Install the Windows SDK before signing." }
if ([string]::IsNullOrWhiteSpace($Installer) -and [string]::IsNullOrWhiteSpace($RuntimeDirectory)) { throw "Provide -Installer and/or -RuntimeDirectory." }

$targets = New-Object System.Collections.Generic.List[string]
if (-not [string]::IsNullOrWhiteSpace($Installer)) {
  if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) { throw "Installer not found: $Installer" }
  $targets.Add((Resolve-Path -LiteralPath $Installer).Path)
}
if (-not [string]::IsNullOrWhiteSpace($RuntimeDirectory)) {
  if (-not (Test-Path -LiteralPath $RuntimeDirectory -PathType Container)) { throw "Runtime directory not found: $RuntimeDirectory" }
  Get-ChildItem -LiteralPath $RuntimeDirectory -Recurse -File | Where-Object { $_.Extension -in ".exe", ".dll", ".node" } | ForEach-Object { $targets.Add($_.FullName) }
}

foreach ($target in ($targets | Select-Object -Unique)) {
  & $signtool.Source sign /sha1 $CertificateThumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $target
  if ($LASTEXITCODE -ne 0) { throw "Code signing failed: $target" }
  & $signtool.Source verify /pa /v $target
  if ($LASTEXITCODE -ne 0) { throw "Code signature verification failed: $target" }
  Write-Host "Signed and verified: $target"
}
