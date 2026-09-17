"""
WeatherGPT — FastAPI Application Entry Point
Conversational AI for Weather Forecasting, Alerts, and Climate Information.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.config import get_settings
from app.routers import nwp
from app.routers import weather, alerts, chat

settings = get_settings()

# ── Create FastAPI App ──────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    description="Conversational AI for Weather Forecasting, Alerts, and Climate Information — Inspired by IMD's Mausam App",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ───────────────────────────────────────────
app.include_router(weather.router)
app.include_router(alerts.router)
app.include_router(chat.router)
app.include_router(nwp.router)

# ── Static Files (Frontend) ────────────────────────────────────
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend")
frontend_dir = os.path.abspath(frontend_dir)

if os.path.exists(frontend_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")


# ── Health Check ────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


# ── Serve Frontend ─────────────────────────────────────────────
@app.get("/", tags=["Frontend"])
async def serve_frontend():
    """Serve the frontend application."""
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": f"Welcome to {settings.app_name} API. Visit /docs for API documentation."}
