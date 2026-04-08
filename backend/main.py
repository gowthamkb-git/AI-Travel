from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.api.trip import router as trip_router
from app.api.auth import router as auth_router
from app.api.history import router as history_router
from app.api.transcribe import router as transcribe_router
from app.db.database import connect_db, close_db

load_dotenv()

app = FastAPI(title="AI Trip Planner API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await connect_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


app.include_router(trip_router, prefix="/api/trip", tags=["trip"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(history_router, prefix="/api/trips", tags=["history"])
app.include_router(transcribe_router, prefix="/api/transcribe", tags=["transcribe"])


@app.get("/health")
def health():
    return {"status": "ok"}
