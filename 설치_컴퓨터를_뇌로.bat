@echo off
chcp 65001 >nul
set "SELF=%~dp0selfllm"
set "SU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\RAY_뇌_자동시작.bat"
> "%SU%" echo @echo off
>> "%SU%" echo cd /d "%SELF%"
>> "%SU%" echo start "" /min python brain_daemon.py loop
>> "%SU%" echo start "" /min python ray_app.py
echo.
echo [완료] 이제 컴퓨터를 켤 때마다 RAY 뇌가 자동 상주하고 제작기가 뜹니다.
echo   - 24시간 뇌: 토큰 배분·학습·매일 수면
echo   - 올인원 제작기: http://127.0.0.1:8777
echo 해제: 아래 파일을 삭제하세요
echo   "%SU%"
pause
