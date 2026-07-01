# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from app.core.config import settings
from app.core.db import get_db, init_db, User, TariffPlan, Consumer
from app.api import auth, qr, ocr, billing, prediction, chatbot, admin, properties

# Create directories for models if not exist
os.makedirs("ml", exist_ok=True)

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(qr.router, prefix=settings.API_V1_STR)
app.include_router(ocr.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(prediction.router, prefix=settings.API_V1_STR)
app.include_router(chatbot.router, prefix=settings.API_V1_STR)
app.include_router(properties.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_db_init():
    print("Database Startup Initializer: Initializing database and tables...")
    init_db()
    
    # Self-seeding check: If database is brand-new/empty, run seed_data
    db = next(get_db())
    try:
        user_count = db.query(User).count()
        tariff_count = db.query(TariffPlan).count()
        
        if user_count == 0 or tariff_count == 0:
            print("Database is empty. Initiating self-seed pipeline...")
            from database.seed_data import seed
            seed()
            print("Self-seed completed successfully!")
            
    except Exception as e:
        print(f"Error during self-seed execution: {e}")
    finally:
        db.close()

@app.get("/")
def health_check():
    static_index = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "index.html")
    if os.path.exists(static_index):
        return FileResponse(static_index)
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "api_prefix": settings.API_V1_STR,
        "swagger_documentation": "/docs"
    }

# Mount static files and handle catch-all for SPA client-side routing
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(static_dir):
    # Mount assets folder
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all router for React routes (excluding API and Docs)
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        if catchall.startswith("api") or catchall.startswith("docs") or catchall.startswith("openapi.json"):
            raise HTTPException(status_code=404)
        return FileResponse(os.path.join(static_dir, "index.html"))

