$body = @{ data = @{} } | ConvertTo-Json -Depth 2
try {
  $uri = "https://us-central1-nature-and-steel.cloudfunctions.net/squareDiagnostics"
  $response = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ "Content-Type" = "application/json" } -Body $body
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
