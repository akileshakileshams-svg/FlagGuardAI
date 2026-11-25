$ErrorActionPreference = "Stop"

$urls = @(
    "http://127.0.0.1:8080/health",
    "http://127.0.0.1:8080/api/flags",
    "http://127.0.0.1:8080/api/flags/checkout_v2",
    "http://127.0.0.1:8080/api/metrics",
    "http://127.0.0.1:8080/api/risk",
    "http://127.0.0.1:8080/api/rollback/history",
    "http://127.0.0.1:8080/api/replay",
    "http://127.0.0.1:8080/api/experiments",
    "http://127.0.0.1:8081/health",
    "http://127.0.0.1:8081/api/experiment/stats",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3001"
)

$passed = 0
$failed = 0

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest `
            -Uri $url `
            -UseBasicParsing `
            -TimeoutSec 30

        if ($response.StatusCode -ne 200) {
            throw "Unexpected HTTP status"
        }

        Write-Host "PASS $url" -ForegroundColor Green
        $passed++
    } catch {
        Write-Host "FAIL $url" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"

if ($failed -gt 0) {
    exit 1
}

Write-Host "ALL SMOKE TESTS PASSED" -ForegroundColor Green
exit 0
