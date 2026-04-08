from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class TripSave(BaseModel):
    query: str
    response: str
    trip_id: Optional[str] = None


class TripInDB(BaseModel):
    id: Optional[str] = None
    user_id: str
    query: str
    response: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TripPublic(BaseModel):
    id: str
    query: str
    response: str
    created_at: datetime
