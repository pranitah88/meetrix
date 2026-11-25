import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from config import FRONTEND_PUBLIC_DIR, PORT, HOST
from db import db, iso_now
from routers import auth, meetings, tasks, users, notifications, ai, analytics, search

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-seed database with demo users & initial meetings on startup
    db.seed_initial_data()
    yield

app = FastAPI(
    title="Meetrix API",
    description="Meeting Intelligence & Team Productivity Platform — High-Performance Python FastAPI Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "timestamp": iso_now(),
        "engine": "FastAPI (Python 3.13)",
        "platform": "Meetrix"
    }

# Mount API Routers
app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(ai.router)
app.include_router(analytics.router)
app.include_router(search.router)

# Mount Static Frontend Files (if directory exists)
if FRONTEND_PUBLIC_DIR.exists():
    # Route for root index.html
    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = FRONTEND_PUBLIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return JSONResponse({"status": "Meetrix API Running", "docs": "/docs"})

    app.mount("/", StaticFiles(directory=str(FRONTEND_PUBLIC_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  Meetrix Python Backend starting...")
    print(f"  Web Application:   http://localhost:{PORT}")
    print(f"  Interactive Docs:  http://localhost:{PORT}/docs")
    print(f"  ReDoc View:        http://localhost:{PORT}/redoc")
    print(f"  Health Check:      http://localhost:{PORT}/api/health")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)

