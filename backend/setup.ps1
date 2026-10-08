#!/usr/bin/env pwsh
# Healthcare Backend Setup Script (Windows PowerShell)
# Creates a virtual environment and installs all dependencies

Write-Host "=== Healthcare Backend Setup ===" -ForegroundColor Cyan

# Check Python
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Python not found! Please install Python 3.10+" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $pythonVersion" -ForegroundColor Green

# Remove existing venv if present
if (Test-Path ".venv") {
    Write-Host "Removing existing virtual environment..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".venv"
}

# Create virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Yellow
python -m venv .venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create venv" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Virtual environment created" -ForegroundColor Green

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\.venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet

# Install requirements
Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] All dependencies installed" -ForegroundColor Green

# Run the reset and seed script
Write-Host "`nRunning database reset and seed..." -ForegroundColor Yellow
& ".\reset_and_seed.ps1"

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:" -ForegroundColor Cyan
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  python manage.py runserver 0.0.0.0:8000" -ForegroundColor White
Write-Host ""
Write-Host "Login credentials: admin / admin123" -ForegroundColor Cyan
