$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzc3Mjg3MzI0LCJ0eXBlIjoiYWNjZXNzIn0.0rrbTOFRvGZ2C4M5o57IrKgmTOOnyx-qZpa6sNKpXyM"

$parts = $token.Split('.')
$payload = $parts[1]

# Add padding if needed
while ($payload.Length % 4 -ne 0) {
    $payload += "="
}

$decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
$decoded | ConvertFrom-Json | ConvertTo-Json