#!/usr/bin/env python
"""Start backend with explicit configuration - clean approach"""
import os
import sys

# Set environment variables explicitly
os.environ["PORT"] = "8001"
os.environ["DEBUG"] = "True"
os.environ["ENV"] = "development"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:password@localhost:5432/rmfood"

# Add the backend directory to path
sys.path.insert(0, r"D:\RMFOODFP\backend")

if __name__ == "__main__":
    from app.main import app
    import uvicorn

    print("Starting RMFOOD backend on port 8001...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        reload=False,  # Disable reload for stability
        log_level="info"
    )
