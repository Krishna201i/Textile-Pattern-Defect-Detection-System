@echo off
echo Stopping existing processes on port 5000 (Backend) and 5173 (Frontend)...

FOR /F "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /F /PID %%a 2>nul
)

FOR /F "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a 2>nul
)

echo Starting Backend...
start cmd /k start_backend.bat

echo Starting Frontend...
start cmd /k start_frontend.bat

echo Servers restarted!
