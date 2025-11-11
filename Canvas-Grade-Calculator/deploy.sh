#!/bin/bash

echo "🚀 Canvas Grade Calculator - Deployment Helper"
echo "=============================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - Canvas Grade Calculator"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create a GitHub repository at https://github.com/new"
echo ""
echo "2. Push your code:"
echo "   git remote add origin YOUR_GITHUB_REPO_URL"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Deploy Backend (Render):"
echo "   • Go to https://render.com"
echo "   • New + → Web Service"
echo "   • Connect your GitHub repo"
echo "   • Root Directory: backend"
echo "   • Build: pip install -r requirements.txt"
echo "   • Start: gunicorn app:app"
echo ""
echo "4. Deploy Frontend (Vercel):"
echo "   • Go to https://vercel.com"
echo "   • Import your GitHub repo"
echo "   • Root Directory: frontend"
echo "   • Framework: Vite"
echo "   • Add env var: VITE_API_URL = your-render-url"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
