$ErrorActionPreference = "SilentlyContinue"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DataDir = Join-Path $Root "data"
$PublicUrlFile = Join-Path $Root "public-share-url.txt"
$PlatformLog = Join-Path $DataDir "platform-server.log"
$PlatformErr = Join-Path $DataDir "platform-server.err.log"
$TunnelLog = Join-Path $DataDir "cloudflared-public.log"
$TunnelOut = Join-Path $DataDir "cloudflared-public.out.log"
$TunnelErr = Join-Path $DataDir "cloudflared-public.err.log"
$CloudflaredExe = Join-Path $Root "tools\cloudflared.exe"
$DisabledFlag = Join-Path $DataDir "public-share-disabled.flag"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (Test-Path $DisabledFlag) {
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "cloudflared" -and $_.CommandLine -like "*127.0.0.1:8020*"
  } | ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force
    } catch {}
  }
  @(
    "Public automatic sharing is disabled.",
    "",
    "Local access remains available:",
    "http://localhost:8020/",
    "http://localhost:8020/share"
  ) | Out-File -FilePath $PublicUrlFile -Encoding utf8
  exit 0
}

function Test-PlatformReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://127.0.0.1:8020/api/health"
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Platform {
  if (Test-PlatformReady) {
    return
  }

  $python = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $python) {
    $python = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  }

  Start-Process -FilePath $python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8020") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $PlatformLog `
    -RedirectStandardError $PlatformErr
}

function Stop-WarningTunnels {
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "localtunnel|lt --port|serveo.net"
  } | ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force
    } catch {}
  }
}

function Test-CloudflaredRunning {
  $process = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "cloudflared" -and $_.CommandLine -like "*--url*127.0.0.1:8020*"
  } | Select-Object -First 1
  return $null -ne $process
}

function Start-CloudflaredTunnel {
  if (-not (Test-Path $CloudflaredExe)) {
    "cloudflared not found: $CloudflaredExe" | Out-File -FilePath $TunnelErr -Encoding utf8
    return
  }

  if (Test-CloudflaredRunning) {
    return
  }

  Remove-Item $TunnelLog,$TunnelOut,$TunnelErr -ErrorAction SilentlyContinue

  Start-Process -FilePath $CloudflaredExe `
    -ArgumentList @("tunnel", "--url", "http://127.0.0.1:8020", "--protocol", "http2", "--logfile", $TunnelLog, "--loglevel", "info") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $TunnelOut `
    -RedirectStandardError $TunnelErr
}

function Get-CloudflareUrl {
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $TunnelLog) {
      $text = Get-Content $TunnelLog -Raw -ErrorAction SilentlyContinue
      $match = [regex]::Match($text, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
      if ($match.Success) {
        return $match.Value
      }
    }
    Start-Sleep -Seconds 1
  }
  return $null
}

Start-Platform

for ($i = 0; $i -lt 12; $i++) {
  if (Test-PlatformReady) {
    break
  }
  Start-Sleep -Seconds 2
}

Stop-WarningTunnels
Start-CloudflaredTunnel
$BaseUrl = Get-CloudflareUrl

if ($BaseUrl) {
  $ShareUrl = "$BaseUrl/share"
  $ShareLines = @(
    "Public read-only share URL:",
    $ShareUrl,
    "",
    "Notes:",
    "1. This link uses Cloudflare quick tunnel and does not show the localtunnel IP warning page.",
    "2. The public URL exposes only the read-only /share page. Admin write/download APIs remain blocked for public visitors.",
    "3. Quick tunnel URLs can change after the tunnel restarts. A permanently fixed URL requires a domain name plus a Cloudflare named tunnel, or a cloud server and domain.",
    "4. If the computer is powered off, sleeping, or offline, the public URL is unavailable until the machine is back online."
  )
} else {
  $ShareLines = @(
    "Public share tunnel failed to start.",
    "",
    "Check logs:",
    $TunnelLog,
    $TunnelErr
  )
}

$ShareLines | Out-File -FilePath $PublicUrlFile -Encoding utf8
