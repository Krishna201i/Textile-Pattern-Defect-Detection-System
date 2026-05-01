@echo off
echo ================================================
echo  TextileGuard Backend  (OpenCV + SSIM pipeline)
echo ================================================

cd /d "%~dp0backend"

echo [1/3] Installing / verifying dependencies...
pip install -r requirements.txt --quiet

echo [2/3] Creating uploads folder if needed...
if not exist uploads mkdir uploads

echo [3/3] Starting Flask server on http://localhost:5000 ...
echo.
echo  API endpoints:
echo    GET  http://localhost:5000/api/health
echo    POST http://localhost:5000/api/predict
echo    GET  http://localhost:5000/api/performance
echo.
echo  Optional: set REFERENCE_IMAGE_PATH=C:\path\to\good_fabric.jpg
echo            for SSIM comparison mode (more accurate).
echo.
python app.py
pause
