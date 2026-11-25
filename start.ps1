$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Check-Command {
    if ($LASTEXITCODE -ne 0) {
        throw "Previous command failed."
    }
}

Write-Host "Starting FlagGuard AI..." -ForegroundColor Cyan

docker info | Out-Null
Check-Command

if (!(Test-Path "backend/.env")) {
    throw "Configure backend/.env before starting."
}

New-Item -ItemType Directory -Force data | Out-Null

Write-Host "Starting Flagsmith infrastructure..." -ForegroundColor Yellow

Push-Location infrastructure/flagsmith
try {
    docker compose up -d --wait
    Check-Command
} finally {
    Pop-Location
}

Write-Host "Checking local AI..." -ForegroundColor Yellow

try {
    $models = Invoke-RestMethod `
        -Uri "http://127.0.0.1:11434/api/tags" `
        -TimeoutSec 10

    if ($models.models.name -notcontains "qwen2.5:1.5b") {
        Write-Warning "AI model missing. Run ollama pull qwen2.5:1.5b"
    }
} catch {
    Write-Warning "Ollama unavailable. Core dashboard can still run."
}

Write-Host "Starting FlagGuard containers..." -ForegroundColor Yellow

docker compose up -d --build --wait
Check-Command

Write-Host ""
Write-Host "FlagGuard AI is ready!" -ForegroundColor Green
Write-Host "Dashboard : http://127.0.0.1:5173"
Write-Host "DemoStore : http://127.0.0.1:3001"
Write-Host "API Docs  : http://127.0.0.1:8080/docs"
Write-Host "Flagsmith : http://localhost:8000"

Start-Process "http://127.0.0.1:5173"
