$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

docker compose stop

if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop FlagGuard services."
}

Push-Location infrastructure/flagsmith

try {
    docker compose stop

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to stop Flagsmith."
    }
} finally {
    Pop-Location
}

Write-Host "FlagGuard AI stopped." -ForegroundColor Green
Write-Host "All persistent data preserved."
