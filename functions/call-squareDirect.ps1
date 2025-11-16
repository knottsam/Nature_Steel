# Reads SQUARE_ACCESS_TOKEN from functions/.env.local and calls Square merchants & locations directly
$envPath = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envPath)) {
  Write-Host "Missing functions/.env.local" -ForegroundColor Red
  exit 1
}
$tokenLine = (Get-Content $envPath | Where-Object { $_ -match '^SQUARE_ACCESS_TOKEN=' } | Select-Object -First 1)
if (-not $tokenLine) {
  Write-Host "SQUARE_ACCESS_TOKEN not found in .env.local" -ForegroundColor Red
  exit 1
}
$token = ($tokenLine -split '=', 2)[1].Trim()
$headers = @{ Authorization = "Bearer $token"; "Square-Version" = "2025-10-16" }

$sbBase = "https://connect.squareupsandbox.com"
$prodBase = "https://connect.squareup.com"

Write-Host "Token preview: $($token.Substring(0,6))...$($token.Substring($token.Length-4))"

function Invoke-Endpoint($base, $path) {
  try {
    $resp = Invoke-WebRequest -Method GET -Uri ("$base$path") -Headers $headers -UseBasicParsing -ErrorAction Stop
    return @{ ok = $true; status = $resp.StatusCode; body = $resp.Content }
  } catch {
    $r = $_.Exception.Response
    $status = if ($r) { $r.StatusCode.value__ } else { 0 }
    $body = $null
    if ($r -and $r.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
      $reader.BaseStream.Position = 0
      $reader.DiscardBufferedData()
      $body = $reader.ReadToEnd()
    }
    return @{ ok = $false; status = $status; body = $body }
  }
}

Write-Host "Sandbox merchants:" -ForegroundColor Cyan
$mr = Invoke-Endpoint $sbBase "/v2/merchants"
$mr | ConvertTo-Json -Depth 5

Write-Host "Sandbox locations:" -ForegroundColor Cyan
$lr = Invoke-Endpoint $sbBase "/v2/locations"
$lr | ConvertTo-Json -Depth 5

Write-Host "Production merchants:" -ForegroundColor Magenta
$mrp = Invoke-Endpoint $prodBase "/v2/merchants"
$mrp | ConvertTo-Json -Depth 5

Write-Host "Production locations:" -ForegroundColor Magenta
$lrp = Invoke-Endpoint $prodBase "/v2/locations"
$lrp | ConvertTo-Json -Depth 5
