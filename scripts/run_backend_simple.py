#!/usr/bin/env python
"""
Minimal FastAPI backend startup script
Bypasses problematic lazy-loaded modules
"""
import sys
import os
import logging

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Set environment variables for database connection
if not os.environ.get('DATABASE_URL'):
    os.environ['DATABASE_URL'] = 'postgresql+asyncpg://rmfood:rmfood_secure_password_123@localhost:5432/rmfood_db'

if not os.environ.get('REDIS_URL'):
    os.environ['REDIS_URL'] = 'redis://localhost:6380/0'

if not os.environ.get('SECRET_KEY'):
    os.environ['SECRET_KEY'] = 'rmfood_development_secret_key_min_32_characters_long_2024'

if not os.environ.get('CORS_ORIGINS'):
    os.environ['CORS_ORIGINS'] = 'http://localhost:3000'

if __name__ == "__main__":
    logger.info("Starting RMFOOD Backend API...")
    logger.info(f"Database: {os.environ.get('DATABASE_URL', 'Not configured')}")
    logger.info(f"Redis: {os.environ.get('REDIS_URL', 'Not configured')}")
    
    try:
        from app.main import app
        import uvicorn
        
        logger.info("Starting Uvicorn server on 0.0.0.0:8000...")
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            workers=1,
            reload=False,
            log_level="info",
        )
    except Exception as e:
        logger.error(f"Failed to start backend: {e}", exc_info=True)
        sys.exit(1)
