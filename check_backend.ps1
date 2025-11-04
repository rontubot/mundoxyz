$url = "https://confident-bravery-production-ce7b.up.railway.app/api/health"
$response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
Write-Output "Backend Status: $($response.StatusCode)"
