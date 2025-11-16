$locationId = $env:TEST_SQUARE_LOCATION_ID
if (-not $locationId) {
    $repoEnvPath = Join-Path $PSScriptRoot "..\\.env.local"
    if (Test-Path $repoEnvPath) {
        $line = Get-Content $repoEnvPath | Where-Object { $_ -match "^VITE_SQUARE_LOCATION_ID=" } | Select-Object -First 1
        if ($line) {
            $locationId = ($line -split '=', 2)[1].Trim()
        }
    }
}

if (-not $locationId) {
    Write-Host "Missing Square location ID. Set TEST_SQUARE_LOCATION_ID before running." -ForegroundColor Yellow
    exit 1
}

$body = @{
    data = @{
        sourceId = "cnon:card-nonce-ok"
        amount = 100
        currency = "GBP"
        locationId = $locationId
    }
} | ConvertTo-Json -Depth 4

try {
    $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5001/nature-and-steel/us-central1/processSquarePayment" -Headers @{ "Content-Type" = "application/json" } -Body $body
    $response | ConvertTo-Json -Depth 6
} catch {
    Write-Host "HTTP request failed:" $_.Exception.Message
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        Write-Host "Response body:"
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
