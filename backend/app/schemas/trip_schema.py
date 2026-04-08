from pydantic import BaseModel, Field
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str  # "human" or "assistant"
    content: str


class Coordinates(BaseModel):
    lat: float
    lng: float


class WeatherData(BaseModel):
    temp: Optional[str] = None
    condition: Optional[str] = None
    location: Optional[str] = None
    season: Optional[str] = None
    best_time_to_visit: Optional[str] = None
    feels_like: Optional[str] = None
    humidity: Optional[str] = None
    wind_speed: Optional[str] = None
    key_points: List[str] = Field(default_factory=list)


class CurrencyData(BaseModel):
    rate: Optional[str] = None
    from_currency: Optional[str] = None
    to_currency: Optional[str] = None
    symbol: Optional[str] = None
    from_symbol: Optional[str] = None
    user_country: Optional[str] = None
    destination_country: Optional[str] = None
    same_currency: Optional[bool] = None
    exchange_text: Optional[str] = None
    key_points: List[str] = Field(default_factory=list)


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
    total_local: Optional[str] = None
    total_destination: Optional[str] = None
    per_day_local: Optional[str] = None
    per_day_destination: Optional[str] = None
    destination_currency: Optional[str] = None
    local_currency: Optional[str] = None
    same_currency: Optional[bool] = None
    exchange_text: Optional[str] = None
    key_points: List[str] = Field(default_factory=list)


class WidgetData(BaseModel):
    weather: Optional[WeatherData] = None
    currency: Optional[CurrencyData] = None
    budget: Optional[BudgetData] = None


class TripRequest(BaseModel):
    question: str
    model_provider: str = "groq"
    history: List[ChatMessage] = Field(default_factory=list)
    current_location: Optional[Coordinates] = None
    location_context: Optional[str] = None


class TripResponse(BaseModel):
    answer: str
    widgets: Optional[WidgetData] = None
    destination: Optional[str] = None
    destination_coords: Optional[Coordinates] = None
