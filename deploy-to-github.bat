@echo off
echo ========================================
echo iSafari Global Backend - GitHub Deploy
echo ========================================

echo [1/6] Initializing Git repository...
git init

echo [2/6] Adding all files...
git add .

echo [3/6] Creating initial commit...
git commit -m "Initial backend deployment for iSafari Global"

echo [4/6] Setting main branch...
git branch -M main

echo.
echo ========================================
echo NEXT STEPS (Manual):
echo ========================================
echo 1. Go to https://github.com/new
echo 2. Repository name: isafari-global-backend
echo 3. Make it Public
echo 4. Click "Create repository"
echo 5. Copy the repository URL
echo 6. Run: git remote add origin YOUR_REPO_URL
echo 7. Run: git push -u origin main
echo ========================================

pause
