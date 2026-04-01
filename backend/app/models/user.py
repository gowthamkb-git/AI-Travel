from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime, timezone


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserInDB(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    hashed_password: str
    plan: Literal["free", "pro"] = "free"
    usage_limit: int = 50
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    plan: str
    usage_limit: int
    usage_count: int
    avatar_url: Optional[str] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
