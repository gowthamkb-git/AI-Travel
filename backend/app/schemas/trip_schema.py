from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str  # "human" or "assistant"
    content: str


class WeatherData(BaseModel):
    temp: Optional[str] = None
    condition: Optional[str] = None
    location: Optional[str] = None
    season: Optional[str] = None


class CurrencyData(BaseModel):
    rate: Optional[str] = None
    from_currency: Optional[str] = None
    to_currency: Optional[str] = None
    symbol: Optional[str] = None


class BudgetBreakdown(BaseModel):
    accommodation: Optional[str] = None
    food: Optional[str] = None
    transport: Optional[str] = None
    activities: Optional[str] = None


class BudgetData(BaseModel):
    total: Optional[str] = None
    per_day: Optional[str] = None
    currency_symbol: Optional[str] = None
    breakdown: Optional[BudgetBreakdown] = None


class WidgetData(BaseModel):
    weather: Optional[WeatherData] = None
    currency: Optional[CurrencyData] = None
    budget: Optional[BudgetData] = None


class TripRequest(BaseModel):
    question: str
    model_provider: str = "gemini"
    history: List[ChatMessage] = []


class TripResponse(BaseModel):
    answer: str
    widgets: Optional[WidgetData] = None
