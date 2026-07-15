@echo off
chcp 65001 >nul
cd /d "%~dp0selfllm"
echo RAY 올인원 제작기 실행 중... 브라우저가 곧 열립니다.
python ray_app.py
pause
