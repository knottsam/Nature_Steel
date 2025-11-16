# Calls the deployed adminAddItem HTTP function to insert a furniture item
param(
  [string]$Name = "Sample Console Table",
  [string]$Description = "Handcrafted solid steel console table with oak top.",
  [int]$PricePence = 29900,
  [int]$Stock = 1,
  [string[]]$Images = @(),
  [string]$AdminKey = ""
)

if (-not $AdminKey) {
  # Fallback to ENV var if set
  $AdminKey = $env:ADMIN_API_KEY
}

if (-not $AdminKey) {
  Write-Host "Missing Admin Key. Set -AdminKey or define ADMIN_API_KEY env var." -ForegroundColor Yellow
  exit 1
}

$body = @{ 
  name = $Name
  description = $Description
  pricePence = $PricePence
  stock = $Stock
  images = $Images
} | ConvertTo-Json -Depth 5

try {
  $uri = "https://us-central1-nature-and-steel.cloudfunctions.net/adminAddItem"
  $headers = @{ 'Content-Type' = 'application/json'; 'x-admin-key' = $AdminKey }
  $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body
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
