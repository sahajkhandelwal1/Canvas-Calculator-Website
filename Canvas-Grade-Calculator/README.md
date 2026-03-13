# Canvas Grade Calculator

A full-stack web app that connects to your Canvas LMS account and gives you a real-time view of your grades, upcoming assignments, and overdue work — with what-if scenario modeling so you can see how future scores affect your grade.

## Features

- View all active courses with current grades (supports Semester 1 / Semester 2 filtering)
- Drill into any course for a full assignment breakdown
- Run what-if scenarios by modifying scores or adding hypothetical assignments
- See projected grade changes in real-time
- Supports weighted grading with drop rules (drop lowest, drop highest, never drop)
- Upcoming assignments panel — due dates within the next 60 days
- Overdue assignments panel — past-due work from the last 90 days
- Drag-and-drop course reordering
- Custom course name aliases
- Hide/show individual courses
- Customizable background (preset images or upload your own)
- Animated grade counters and bounce card UI
- Feedback submission

## Tech Stack

- **Frontend**: React 18 + Vite, @dnd-kit (drag and drop), GSAP, Vercel Analytics
- **Backend**: Flask (Python), Gunicorn
- **API**: Canvas LMS REST API

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd Canvas-Grade-Calculator/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5001`

### Frontend

```bash
cd Canvas-Grade-Calculator/frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` — API calls are proxied to the backend automatically via Vite config.

### Environment

Copy `.env.example` and adjust if your backend runs on a different port:

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:5001
```

## Usage

1. Get your Canvas API token:
   - Log into Canvas → Account → Settings
   - Scroll to "Approved Integrations" → click "+ New Access Token"
   - Copy the token

2. Open the app, enter your Canvas domain (e.g. `school.instructure.com`) and your token

3. Your courses load automatically with current grades

4. Click any course to see assignments — modify scores to model what-if scenarios

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/courses` | Fetch all active courses with grades |
| POST | `/api/course/:id/assignments` | Fetch submissions for a course |
| POST | `/api/course/:id/groups` | Fetch assignment groups and weights |
| POST | `/api/course/:id/grading-scheme` | Fetch the course grading scheme |
| POST | `/api/calculate-grade` | Calculate grade from assignments + modifications |
| POST | `/api/upcoming-assignments` | Fetch upcoming assignments (next 60 days) |
| POST | `/api/overdue-assignments` | Fetch overdue assignments (last 90 days) |
| POST | `/api/feedback` | Submit feedback |

All endpoints accept `{ token, canvasUrl }` in the request body.

## Deployment

### Backend — Render (free tier)

1. Push to GitHub
2. New Web Service on [Render](https://render.com)
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
3. Copy your Render URL

### Frontend — Vercel (free tier)

1. Update `frontend/vercel.json` with your Render backend URL
2. New project on [Vercel](https://vercel.com)
   - Root directory: `frontend`
   - Framework: Vite
   - Add env var: `VITE_API_URL=https://your-backend.onrender.com`
3. Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for full step-by-step instructions.

> **Note**: Render's free tier sleeps after 15 minutes of inactivity — the first request after sleep takes ~30 seconds to wake up.

## Security

- Your Canvas token is stored only in `localStorage` in the browser and sent directly to your own backend
- Never commit tokens or credentials
- CORS is open by default — in production you may want to restrict it to your frontend domain
