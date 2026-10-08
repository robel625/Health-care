@echo off
echo === Healthcare Database Reset & Seed ===
echo.

echo [1/5] Removing database...
if exist db.sqlite3 del /f db.sqlite3

echo [2/5] Removing old migrations...
for /d %%d in (apps\*\migrations) do (
    rd /s /q "%%d" 2>nul
    mkdir "%%d" 2>nul
    echo. > "%%d\__init__.py"
)

echo [3/5] Creating migrations...
python manage.py makemigrations
if %errorlevel% neq 0 goto :error

echo [4/5] Running migrations...
python manage.py migrate
if %errorlevel% neq 0 goto :error

echo [5/5] Seeding database...
python manage.py seed_data
if %errorlevel% neq 0 goto :error
python manage.py seed_roles
if %errorlevel% neq 0 goto :error

echo.
echo === DONE! Database reset and seeded successfully. ===
echo Login: admin / admin123
echo.
echo To start server: python manage.py runserver 0.0.0.0:8000
pause
exit /b 0

:error
echo.
echo ERROR: Something went wrong!
pause
exit /b 1
