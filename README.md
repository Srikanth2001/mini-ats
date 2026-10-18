# Hireboard — Mini Applicant Tracking System (ATS)

A polished, responsive applicant tracking system built for the hiring workflow assignment. Recruiters can manage candidates, move applicants through hiring stages, search and filter the directory, view pipeline metrics, and export candidate data.

## Features
- Dashboard cards for total candidates, active candidates, interviews, offers, hires, and new candidates this week.
- Hiring pipeline distribution for Applied, Screening, Interview, Offer, Hired, and Rejected.
- Candidate CRUD: create, view details, edit, delete, and add recruiter notes.
- Search by name, email, or role; filter by stage and role.
- Update a candidate's stage inline from the table, details drawer/modal, or pipeline board.
- Candidate priority and 1–5 rating.
- CSV export, responsive layout, validation, duplicate-email handling, and demo seed data.
- PostgreSQL persistence, typed Express API, Zod request validation, Helmet, and CORS configuration.

## Tech stack
- Frontend: React 18, TypeScript, Vite, Lucide icons, custom responsive CSS.
- Backend: Node.js, Express, TypeScript, PostgreSQL (`pg`), Zod.
- Local orchestration: Docker Compose.

## Run locally (recommended: Docker)
Prerequisites: Docker Desktop / Docker Engine with Compose.

```bash
git clone https://github.com/YOUR_USERNAME/mini-ats.git
cd mini-ats
docker compose up --build
```

Open:
- Frontend: http://localhost:5173
- API health: http://localhost:5000/api/health
- Candidate API: http://localhost:5000/api/candidates

The backend creates the database table and inserts eight demo candidates automatically when the table is empty. Data persists in the `ats_data` Docker volume.

To stop: `docker compose down`. To stop and remove demo database data too: `docker compose down -v`.

## Run without Docker
1. Install Node.js 20+ and PostgreSQL 16+.
2. Create a database and user, or use a local connection string.
3. Copy `backend/.env.example` to `backend/.env`, and set `DATABASE_URL`.
4. In one terminal:

```bash
cd backend
npm install
npm run dev
```

5. In another terminal:

```bash
cd frontend
npm install
# optional: copy .env.example to .env.local and set VITE_API_URL
npm run dev
```

Vite runs on http://localhost:5173. Backend defaults to http://localhost:5000.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/meta` | Available stages and priorities |
| GET | `/api/candidates?search=&stage=All&role=All` | List/search/filter candidates |
| GET | `/api/dashboard` | Dashboard metrics and pipeline counts |
| POST | `/api/candidates` | Create candidate |
| PATCH | `/api/candidates/:id` | Update candidate details or stage |
| DELETE | `/api/candidates/:id` | Delete candidate |

Candidate creation fields: `name`, `email`, `role`; optional `stage`, `source`, `priority`, `rating`, `notes`.

## Deployment guide
This repository is ready to deploy, but you must create the cloud resources and set the environment variables in your own accounts.

### 1. Database
Create a managed PostgreSQL database on Neon, Supabase, Railway, Render, or another PostgreSQL provider. Copy its connection string. If the provider requires SSL, append the provider's recommended SSL query parameters to `DATABASE_URL` (follow the provider's current instructions).

### 2. Backend API
Deploy the `backend` directory as a Node web service. Build command: `npm install && npm run build`. Start command: `npm start`. Set:
- `DATABASE_URL` = your managed PostgreSQL connection string
- `PORT` = the platform-provided port (many platforms set this automatically)
- `CORS_ORIGIN` = your deployed frontend origin, e.g. `https://your-ats-frontend.example`

The API creates its table and demo records on startup. Confirm `https://YOUR_API_HOST/api/health` returns `{ "status": "ok", "service": "mini-ats-api" }`.

### 3. Frontend
Deploy the `frontend` directory as a static Vite site. Build command: `npm install && npm run build`. Output directory: `dist`. Set build environment variable `VITE_API_URL=https://YOUR_API_HOST/api`. Rebuild after changing this variable.

### 4. Verify
- Add a candidate and refresh; it should remain in the database.
- Try search and stage/role filters.
- Move a candidate to Interview or Hired and check dashboard metrics.
- Export CSV and test on a mobile viewport.

## Demo video checklist (60–90 seconds)
Record your screen with OBS Studio, Clipchamp, or the built-in Windows screen recorder. Show:
1. Open the dashboard and briefly point out the metric cards and pipeline distribution.
2. Open Candidates; search for a name and filter by stage.
3. Add a candidate and show the success toast.
4. Open the candidate, update the stage to Interview, and show the change in the table/dashboard.
5. Open Pipeline to show the kanban-style stage columns.
6. Export CSV.

Suggested narration: “Hireboard is a lightweight ATS for tracking applicants end to end. The dashboard summarizes the pipeline, while recruiters can search and filter candidates, record notes and priority, and move applicants between stages. Candidate records are stored in PostgreSQL through a validated TypeScript API.”

## Submission checklist
- [ ] Deploy frontend and backend; set production environment variables.
- [ ] Add the live frontend URL below.
- [ ] Push this project to a public GitHub repository.
- [ ] Record and upload a 60–90 second demo video (unlisted YouTube or Google Drive link).
- [ ] Test the live site on desktop and mobile.

**Live app:** `PASTE_DEPLOYED_FRONTEND_URL_HERE`  
**GitHub:** `PASTE_PUBLIC_REPOSITORY_URL_HERE`  
**Demo video:** `PASTE_DEMO_VIDEO_URL_HERE`

## Security / scope notes
This is an assignment/demo application, not a production HR system. Authentication, role-based access, file uploads, audit logs, email notifications, and privacy/retention workflows are not included. Do not store real applicant personal data until authentication and production security controls are implemented.
