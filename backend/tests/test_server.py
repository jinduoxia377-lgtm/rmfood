from fastapi import FastAPI
from uvicorn import run
import sys

sys.path.insert(0, '/d/RMFOODFP/backend')

app = FastAPI()

@app.get('/health')
def health():
    return {"status": "healthy", "service": "RMFOOD Backend Test"}

@app.get('/')
def root():
    return {"message": "RMFOOD Platform API Server"}

if __name__ == "__main__":
    print("Starting test server on 0.0.0.0:8081...")
    run(app, host="0.0.0.0", port=8081)
