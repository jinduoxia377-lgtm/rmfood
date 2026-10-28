"""Formula Calculation Service - Entry point for optimization calculations."""

from fastapi import FastAPI

from .optimizer import Optimizer

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/optimize")
async def optimize(request: dict):
    optimizer = Optimizer()
    return optimizer.calculate(request)
