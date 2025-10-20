# EASY DEPLOYMENT - Copy & Paste Commands

## Option 1: Manual GitHub Upload (Easiest)

1. **Create ZIP file of backend folder**
2. **Go to GitHub.com** → Sign in with mfungojoctan01@gmail.com
3. **Click "New repository"**
   - Name: `isafari-global-backend`
   - Public
   - Add README: ✓
4. **Upload files** → Drag backend folder contents
5. **Commit changes**

## Option 2: Command Line (If Git works)

```bash
cd backend
git init
git add .
git commit -m "Initial backend deployment"
git branch -M main
```

Then create repo on GitHub and:
```bash
git remote add origin https://github.com/YOUR_USERNAME/isafari-global-backend.git
git push -u origin main
```

## Option 3: Alternative - Use Render Direct Deploy

1. **Go to render.com** → Sign up with mfungojoctan01@gmail.com
2. **New** → **Web Service** → **Deploy without Git**
3. **Upload backend folder as ZIP**
4. **Configure**:
   - Build: `npm install`
   - Start: `npm start`
   - Environment: Node

## Render Configuration (Copy-Paste)

**Environment Variables:**
```
NODE_ENV=production
PORT=10000
JWT_SECRET=isafari_global_super_secret_jwt_key_2024_production
SESSION_SECRET=isafari_session_secret_key_2024
FRONTEND_URL=https://isafari-global.netlify.app
```

**Database (PostgreSQL):**
- Create new PostgreSQL database on Render
- Copy connection details to environment variables

## Expected Result

Backend URL: `https://isafari-global-backend.onrender.com`

Test: `https://isafari-global-backend.onrender.com/health`
