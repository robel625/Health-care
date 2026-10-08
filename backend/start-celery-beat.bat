@echo off
echo ====================================================
echo Starting Celery Beat Scheduler for Healthcare System...
echo ====================================================
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m celery -A erp beat -l info
