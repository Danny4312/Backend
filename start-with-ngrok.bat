@echo off
echo ========================================
echo iSafari Global - Quick Live Backend
echo ========================================

echo [1/3] Starting backend server...
start "Backend Server" cmd /k "node full-server.js"

echo [2/3] Waiting for server to start...
timeout /t 5 /nobreak > nul

echo [3/3] Instructions for ngrok:
echo.
echo 1. Download ngrok from: https://ngrok.com/download
echo 2. Extract ngrok.exe to this folder
echo 3. Open new terminal and run: ngrok http 5000
echo 4. Copy the https URL (e.g., https://abc123.ngrok.io)
echo 5. Update Netlify environment variable:
echo    VITE_API_BASE_URL = https://abc123.ngrok.io/api
echo.
echo Backend is running on http://localhost:5000
echo ========================================

pause
