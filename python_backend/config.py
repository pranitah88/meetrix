import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
FRONTEND_PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public"

# Database & Storage
# By default, uses a persistent SQLite database in python_backend/meetrix.db
# or uses :memory: if TEST_MODE is set
DB_PATH = os.getenv("SQLITE_DB_PATH", str(BASE_DIR / "meetrix.db"))

# Security
JWT_SECRET = os.getenv("JWT_SECRET", "meetrix_super_secure_jwt_secret_dev_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# Anthropic Claude API (Optional - falls back to Local Intelligence Engine if missing)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Server
PORT = int(os.getenv("PORT", "5000"))
HOST = os.getenv("HOST", "0.0.0.0")
