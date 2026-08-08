"""
用户相关 Pydantic 模式
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """用户基础模式"""
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    """用户创建"""
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """用户更新"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None


class UserResponse(UserBase):
    """用户响应"""
    id: int
    role: str
    is_active: bool
    department: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """令牌响应"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """令牌载荷"""
    sub: str  # user_id (字符串类型，因为JWT要求sub必须是字符串)
    role: str
    exp: int
    type: str = "access"  # access / refresh


class LoginRequest(BaseModel):
    """登录请求"""
    username: str
    password: str


class PasswordChange(BaseModel):
    """密码修改"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
