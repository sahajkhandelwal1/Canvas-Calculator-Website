# Canvas Grade Calculator

A full-stack web application for analyzing Canvas LMS grades with what-if scenarios.

## Features

- View all your Canvas courses and current grades
- Analyze individual courses with detailed assignment breakdowns
- Run what-if scenarios by modifying assignment scores
- See projected grade changes in real-time
- Supports weighted grading with drop rules

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Flask (Python)
- **API**: Canvas LMS REST API

## Setup

### Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. Get your Canvas API token:
   - Log into Canvas
   - Go to Account → Settings
   - Scroll to "Approved Integrations"
   - Click "+ New Access Token"
   - Copy the token

2. Open the app and enter your API token

3. Select a course to analyze

4. Modify assignment scores to see projected grade changes

## Deployment (Free!)

### Quick Deploy

Run the deployment helper:
```bash
./deploy.sh
```

Or follow the detailed guide in [DEPLOYMENT.md](DEPLOYMENT.md)

### Recommended Free Hosting

**Backend**: [Render](https://render.com) (Free tier)
- Auto-deploys from GitHub
- Free SSL
- Sleeps after 15 min inactivity

**Frontend**: [Vercel](https://vercel.com) (Free tier)
- Instant deployments
- Global CDN
- Free SSL

### Quick Steps

1. Push to GitHub
2. Deploy backend to Render (5 min)
3. Deploy frontend to Vercel (2 min)
4. Done! 🎉

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.

## Security Note

Never commit your Canvas API token. The token is only stored in the browser session and sent to your backend for API requests.
