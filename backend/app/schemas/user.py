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
    role: Optional[str] = Field(None, description="角色: admin/reviewer/researcher/formulator/guest，默认 researcher")
    department: Optional[str] = Field(None, max_length=100)
    organization_id: Optional[int] = None


class UserUpdate(BaseModel):
    """用户更新"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None

    # 个人资料扩展字段（设置页「账户」模块）
    position: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=2000)
    website: Optional[str] = Field(None, max_length=500)
    github: Optional[str] = Field(None, max_length=100)
    linkedin: Optional[str] = Field(None, max_length=500)

    preferences: Optional[dict] = None


class UserResponse(UserBase):
    """用户响应"""
    # A-24：username 的 `^[a-zA-Z0-9_]+$` 格式约束属于「创建账号时」的输入校验，
    #       不应该施加在读取响应上 —— 库里存在 dev-demo 这类历史账号（含连字符），
    #       一旦响应模型套用该 pattern，整个用户列表接口会 422，
    #       /users 页面因此直接落到「加载失败」错误态。这里放宽为只校验长度。
    username: str = Field(..., min_length=1, max_length=50)
    id: int
    role: str
    plan: str = "free"  # 用户级版本: free/pro（规格 tenant-isolation-segmentation-plan.md 2.1）
    is_active: bool
    department: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    position: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    login_attempts: int = 0
    locked_until: Optional[datetime] = None

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
    two_factor_code: str | None = Field(None, min_length=6, max_length=6, description="2FA 动态验证码（启用两步验证后必填）")


class PasswordChange(BaseModel):
    """密码修改"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class DeleteAccountRequest(BaseModel):
    """账户注销确认请求"""
    confirm: str = Field(..., description="确认文本，必须为 DELETE MY ACCOUNT")
