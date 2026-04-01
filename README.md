# AI Trip Planner v2

Full-stack AI travel planning app — FastAPI + LangGraph backend, Next.js frontend.

## Structure
- `backend/` — FastAPI + LangGraph agent
- `frontend/` — Next.js UI
- `notebook/` — Experiments

## Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Fill in .env with your API keys
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
# .env.local already set to http://localhost:8000
npm run dev
```

## API Keys needed (backend/.env)
- `GROQ_API_KEY`
- `OPENAI_API_KEY` (optional)
- `GPLACES_API_KEY`
- `TAVILY_API_KEY`
- `OPENWEATHERMAP_API_KEY`
- `EXCHANGE_RATE_API_KEY`
