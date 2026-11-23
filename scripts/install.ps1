$ErrorActionPreference = 'Stop'

$ZipUrl = 'https://github.com/XMT-CN/agy-ctx-ring/archive/refs/heads/main.zip'
$PluginDir = Join-Path $env:USERPROFILE '.gemini\config\plugins\agy-ctx-ring'

function Copy-PluginBundle {
  param([string]$Src, [string]$Dst)
  New-Item -ItemType Directory -Force -Path $Dst | Out-Null
  foreach ($sub in @('assets', 'sidecars')) {
    $subDst = Join-Path $Dst $sub
    if (Test-Path $subDst) { Remove-Item -Recurse -Force $subDst }
    Copy-Item -Recurse -Force (Join-Path $Src $sub) $subDst
  }
  foreach ($file in @('plugin.json', 'README.md', 'README.zh-CN.md', 'LICENSE')) {
    $fileSrc = Join-Path $Src $file
    if (Test-Path $fileSrc) {
      Copy-Item -Force $fileSrc (Join-Path $Dst $file)
    }
  }
}

$LocalRepo = $null
if (-not [string]::IsNullOrEmpty($PSScriptRoot)) {
  $Candidate = Split-Path -Parent $PSScriptRoot
  if ((Test-Path (Join-Path $Candidate 'plugin.json')) -and (Test-Path (Join-Path $Candidate 'sidecars\ctx_ring'))) {
    $LocalRepo = $Candidate
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginDir) | Out-Null

if ($LocalRepo -and ($LocalRepo -ne $PluginDir)) {
  Write-Host "==> Installing agy-ctx-ring from local checkout: $LocalRepo"
  Copy-PluginBundle -Src $LocalRepo -Dst $PluginDir
} else {
  $TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("agy-ctx-ring-" + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
  try {
    $ZipPath = Join-Path $TmpDir 'repo.zip'
    Write-Host "==> Downloading agy-ctx-ring from $ZipUrl"
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
    $ExtractDir = Join-Path $TmpDir 'unzipped'
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
    $Root = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
    if (-not $Root) { throw 'Failed to locate extracted repository root.' }
    Copy-PluginBundle -Src $Root.FullName -Dst $PluginDir
  } finally {
    if (Test-Path $TmpDir) { Remove-Item -Recurse -Force $TmpDir }
  }
}

$Candidates = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Antigravity\Antigravity.exe'),
  (Join-Path $env:ProgramFiles 'Antigravity\Antigravity.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Antigravity\Antigravity.exe')
)
$AgyExe = $Candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $AgyExe) {
  $Cmd = Get-Command antigravity -ErrorAction SilentlyContinue
  if ($Cmd) { $AgyExe = $Cmd.Source }
}

if ($AgyExe) {
  $Desktop = [Environment]::GetFolderPath('Desktop')
  $ShortcutPath = Join-Path $Desktop 'Antigravity (HUD).lnk'
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $AgyExe
  $Shortcut.Arguments = '--remote-debugging-port=0'
  $Shortcut.WorkingDirectory = Split-Path -Parent $AgyExe
  $Shortcut.IconLocation = "$AgyExe,0"
  $Shortcut.Save()
  Write-Host "==> Created Desktop shortcut: $ShortcutPath"
} else {
  Write-Host "==> Note: Antigravity.exe not found automatically. Launch Antigravity with: --remote-debugging-port=0"
}

Write-Host ""
Write-Host "Installation complete: $PluginDir"
Write-Host "Next steps:"
Write-Host "  1. Quit Antigravity completely if it is currently running without --remote-debugging-port=0."
Write-Host "  2. Start Antigravity using the 'Antigravity (HUD)' shortcut (or pass --remote-debugging-port=0)."
Write-Host "  3. Confirm '上下文胶囊 (agy-ctx-ring)' is enabled under Customizations -> Plugins."
