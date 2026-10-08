@echo off
echo === Healthcare Backend Setup ===
echo.

echo [1/4] Creating virtual environment...
python -m venv .venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)
echo OK: Virtual environment created

echo [2/4] Activating virtual environment and upgrading pip...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet

echo [3/4] Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK: All dependencies installed

echo [4/4] Resetting and seeding database...
call reset.bat

echo.
echo === Setup Complete! ===
echo.
echo To start the server:
echo   .venv\Scripts\activate.bat
echo   python manage.py runserver 0.0.0.0:8000
echo.
echo Login credentials: admin / admin123
echo.
pause
