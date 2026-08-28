$endpoints = @(
    @{name="API v1 Root"; url="http://localhost:8000/api/v1"},
    @{name="Health"; url="http://localhost:8000/health"},
    @{name="API Docs"; url="http://localhost:8000/docs"},
    @{name="Login"; url="http://localhost:8000/api/v1/auth/login"; method="POST"; body=@{username="admin"; password="admin123"} | ConvertTo-Json}
)

foreach ($endpoint in $endpoints) {
    Write-Host "=== $($endpoint.name) ===" -ForegroundColor Cyan
    if ($endpoint.method -eq "POST") {
        $response = Invoke-RestMethod -Uri $endpoint.url -Method POST -ContentType "application/json" -Body $endpoint.body
        $response | ConvertTo-Json
    } else {
        $response = Invoke-RestMethod -Uri $endpoint.url -Method GET
        $response | ConvertTo-Json
    }
    Write-Host ""
}