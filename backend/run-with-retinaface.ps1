# Run backend with Python 3.10 venv (required for RetinaFace + TensorFlow)
# Usage: .\run-with-retinaface.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "venv310\Scripts\Activate.ps1")) {
    Write-Host "venv310 not found. Create it with: py -3.10 -m venv venv310" -ForegroundColor Red
    exit 1
}

& .\venv310\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
