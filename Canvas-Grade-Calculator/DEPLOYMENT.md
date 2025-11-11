# Deployment Guide

## Free Deployment Options

### Backend: Render (Free Tier)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Render**
   - Go to https://render.com and sign up
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: canvas-grade-calculator-api
     - **Root Directory**: `backend`
     - **Environment**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Copy your backend URL (e.g., `https://canvas-grade-calculator-api.onrender.com`)

### Frontend: Vercel (Free Tier)

1. **Update vercel.json with your backend URL**
   - Edit `vercel.json` and replace `your-backend-url.onrender.com` with your actual Render URL

2. **Deploy to Vercel**
   - Go to https://vercel.com and sign up
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
   - Add Environment Variable:
     - **Name**: `VITE_API_URL`
     - **Value**: Your Render backend URL (e.g., `https://canvas-grade-calculator-api.onrender.com`)
   - Click "Deploy"
   - Your app will be live at `https://your-project.vercel.app`

### Alternative: Railway (Backend + Frontend)

Railway offers a simpler all-in-one deployment:

1. Go to https://railway.app and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect both services
5. Configure environment variables if needed
6. Deploy!

### Alternative: Netlify (Frontend)

Similar to Vercel:
1. Go to https://netlify.com
2. Connect your GitHub repo
3. Set build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
4. Add environment variable `VITE_API_URL`
5. Deploy!

## Important Notes

- **Free Tier Limitations**:
  - Render free tier: Services sleep after 15 minutes of inactivity (first request takes ~30s to wake up)
  - Vercel/Netlify: No backend limitations, just frontend hosting
  
- **Security**: Never commit your Canvas API token. Users enter it in the browser.

- **CORS**: The backend already has CORS enabled for all origins. In production, you may want to restrict this to your frontend domain only.

## Production Checklist

- [ ] Push code to GitHub
- [ ] Deploy backend to Render
- [ ] Update `vercel.json` with backend URL
- [ ] Deploy frontend to Vercel
- [ ] Test the live application
- [ ] Share the URL!
