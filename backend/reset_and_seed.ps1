#!/usr/bin/env pwsh
# Reset and seed the Healthcare database (Windows PowerShell)

Write-Host "=== Healthcare Database Reset & Seed ===" -ForegroundColor Cyan

# Remove database
if (Test-Path "db.sqlite3") {
    Remove-Item "db.sqlite3"
    Write-Host "[OK] Removed db.sqlite3" -ForegroundColor Green
}

# Remove and recreate migrations
$migrations = Get-ChildItem -Path "apps" -Directory | ForEach-Object { Join-Path $_.FullName "migrations" }
foreach ($dir in $migrations) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
    }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    New-Item -ItemType File -Path (Join-Path $dir "__init__.py") -Force | Out-Null
}
Write-Host "[OK] Recreated all migrations directories" -ForegroundColor Green

# Make migrations
Write-Host "`nRunning makemigrations..." -ForegroundColor Yellow
python manage.py makemigrations
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED" -ForegroundColor Red; exit 1 }

# Migrate
Write-Host "`nRunning migrate..." -ForegroundColor Yellow
python manage.py migrate
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED" -ForegroundColor Red; exit 1 }

# Seed data
Write-Host "`nRunning seed_data..." -ForegroundColor Yellow
python manage.py seed_data
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED" -ForegroundColor Red; exit 1 }

# Seed roles
Write-Host "`nRunning seed_roles..." -ForegroundColor Yellow
python manage.py seed_roles
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n=== DONE! Database reset and seeded successfully. ===" -ForegroundColor Green
Write-Host "Login: admin / admin123" -ForegroundColor Cyan
