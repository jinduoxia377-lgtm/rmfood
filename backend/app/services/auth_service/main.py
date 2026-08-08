"""Authentication Service - Entry point."""

from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from .auth_handler import AuthHandler

app = FastAPI()

class Credentials(BaseModel):
    username: str
    password: str

@app.post("/login")
async def login(credentials: Credentials, auth_handler: AuthHandler = Depends()):
    try:
        token = await auth_handler.authenticate(credentials.username, credentials.password)
        return {"token": token}
    except HTTPException as e:
        raise e

@app.get("/users/me")
async def read_current_user(user_id: str = Depends(auth_handler.get_current_user)):
    return {"user_id": user_id}
