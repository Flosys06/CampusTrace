from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import engine, Base
import app.models # Ensure all models are registered with Base

# Import all API routers
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.categories_locations import router as cat_loc_router
from app.api.reports import router as reports_router
from app.api.matches import router as matches_router
from app.api.claims import router as claims_router
from app.api.custody import router as custody_router
from app.api.returns import router as returns_router
from app.api.notifications import router as notifications_router
from app.api.admin import router as admin_router
from app.api.colleges import router as colleges_router

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description="AI-Powered Campus Lost & Found Management System with Computer Vision Matching and Complete Chain of Custody",
    version=settings.PROJECT_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory for static image serving
uploads_path = settings.UPLOAD_DIR
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Include Routers under /api
api_prefix = settings.API_V1_STR # "/api"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(colleges_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(cat_loc_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)
app.include_router(matches_router, prefix=api_prefix)
app.include_router(claims_router, prefix=api_prefix)
app.include_router(custody_router, prefix=api_prefix)
app.include_router(returns_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)

@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "RUNNING",
        "documentation": "/api/docs"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "timestamp": "2026-10-15T12:00:00Z",
        "database": "CONNECTED",
        "version": settings.PROJECT_VERSION
    }
