@echo off
title Healthcare System Launcher

:: Automatically resolve project root directory
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo Starting Django Backend...
start "Django Backend" cmd /k "cd /d "%PROJECT_ROOT%backend" && call .venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"

echo Starting Celery Worker...
start "Celery Worker" cmd /k "cd /d "%PROJECT_ROOT%backend" && call .venv\Scripts\activate.bat && call .\start-celery-worker.bat"

echo Starting Celery Beat...
start "Celery Beat" cmd /k "cd /d "%PROJECT_ROOT%backend" && call .venv\Scripts\activate.bat && call .\start-celery-beat.bat"

echo Starting Frontend (slash-admin)...
start "Frontend" cmd /k "cd /d "%PROJECT_ROOT%slash-admin" && npm run dev"

echo All 4 services launched!