$body = @{ data = @{} } | ConvertTo-Json -Depth 2
try {
  $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5001/nature-and-steel/us-central1/squareDiagnostics" -Headers @{ "Content-Type" = "application/json" } -Body $body
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
