@echo off
echo ====================================================
echo Starting Celery Worker for Healthcare System...
echo ====================================================
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m celery -A erp worker -l info -P solo
