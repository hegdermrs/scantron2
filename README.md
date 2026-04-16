# scantron2

OMR upload app with:

- a React frontend for students and admins
- a FastAPI backend for preprocessing, splitting, and shared test storage
- AI-assisted PDF answer-key extraction for admin uploads

## Repo layout

```text
scantron2/
├── App.jsx               # Frontend app shell
├── src/main.jsx          # React entry point
├── package.json          # Frontend dependencies
├── backend/
│   ├── app.py            # FastAPI backend
│   ├── requirements.txt  # Backend dependencies
│   └── data/             # SQLite database (ignored)
├── static/               # Legacy local assets
├── templates/            # Legacy OMR templates
├── fixed_template_engine.py
├── omr_engine.py
└── diagnose.py
```

## Local frontend

```bash
npm install
npm run dev
```

Frontend env vars:

```text
VITE_BACKEND_BASE_URL=http://localhost:5000
VITE_PARSE_API_URL=https://rmrs.app.n8n.cloud/webhook/omr-upload
```

## Local backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 5000
```

Backend env vars:

```text
ANTHROPIC_API_KEY=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=omr123
ANSWER_KEY_EXTRACTION_MODEL=claude-sonnet-4-20250514
CORS_ALLOW_ORIGINS=http://localhost:5173
```

## Deploy

### Netlify

Deploy the repo root as the frontend.

Set:

```text
VITE_BACKEND_BASE_URL=https://your-backend.up.railway.app
VITE_PARSE_API_URL=https://rmrs.app.n8n.cloud/webhook/omr-upload
```

### Railway

Deploy the `backend/` folder as the service root.

Start command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

Recommended Railway vars:

```text
ANTHROPIC_API_KEY=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ANSWER_KEY_EXTRACTION_MODEL=claude-sonnet-4-20250514
CORS_ALLOW_ORIGINS=https://your-netlify-site.netlify.app
```

Mount a persistent volume at:

```text
/app/data
```
