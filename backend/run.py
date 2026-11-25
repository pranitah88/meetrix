import uvicorn
from config import HOST, PORT

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Starting Meetrix Python Backend (FastAPI)...")
    print(f"  Web Interface:    http://localhost:{PORT}")
    print(f"  Interactive Docs: http://localhost:{PORT}/docs")
    print(f"  Health Check:     http://localhost:{PORT}/api/health")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)

