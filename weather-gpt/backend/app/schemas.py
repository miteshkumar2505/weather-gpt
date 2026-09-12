"""
WeatherGPT — Pydantic Schemas
Request and response models for all API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Weather Models ──────────────────────────────────────────────

class WeatherCondition(BaseModel):
    """A single weather condition descriptor."""
    main: str = Field(..., description="Group of weather parameters (Rain, Snow, Clouds, etc.)")
    description: str = Field(..., description="Weather condition within the group")
    icon: str = Field(..., description="Weather icon ID")


class CurrentWeatherResponse(BaseModel):
    """Current weather data for a location."""
    city: str
    country: str
    lat: float
    lon: float
    temperature: float = Field(..., description="Temperature in selected units")
    feels_like: float
    temp_min: float
    temp_max: float
    humidity: int = Field(..., description="Humidity percentage")
    pressure: int = Field(..., description="Atmospheric pressure in hPa")
    wind_speed: float = Field(..., description="Wind speed in m/s (metric) or mph (imperial)")
    wind_deg: int = Field(..., description="Wind direction in degrees")
    visibility: int = Field(..., description="Visibility in meters")
    clouds: int = Field(..., description="Cloudiness percentage")
    conditions: list[WeatherCondition]
    sunrise: int = Field(..., description="Sunrise time, Unix timestamp")
    sunset: int = Field(..., description="Sunset time, Unix timestamp")
    timezone: int = Field(..., description="Timezone offset in seconds from UTC")
    icon_url: str = Field(..., description="URL for weather icon")
    dt: int = Field(..., description="Time of data calculation, Unix timestamp")


class ForecastItem(BaseModel):
    """A single forecast data point (3-hour interval)."""
    dt: int
    date_text: str
    temperature: float
    feels_like: float
    temp_min: float
    temp_max: float
    humidity: int
    pressure: int
    wind_speed: float
    wind_deg: int
    clouds: int
    conditions: list[WeatherCondition]
    icon_url: str
    pop: float = Field(0, description="Probability of precipitation (0-1)")


class ForecastResponse(BaseModel):
    """5-day / 3-hour forecast for a location."""
    city: str
    country: str
    lat: float
    lon: float
    items: list[ForecastItem]


# ── Alert Models ────────────────────────────────────────────────

class AlertItem(BaseModel):
    """A weather alert/warning."""
    sender: str = ""
    event: str
    start: int
    end: int
    description: str
    severity: str = Field("Yellow", description="Color-coded severity: Red, Orange, Yellow")
    tags: list[str] = []


class AlertsResponse(BaseModel):
    """Weather alerts for a location."""
    lat: float
    lon: float
    alerts: list[AlertItem]


# ── Chat Models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """User message to the chatbot."""
    message: str = Field(..., min_length=1, max_length=2000, description="User's message")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")


class ChatResponse(BaseModel):
    """AI chatbot response."""
    reply: str = Field(..., description="AI-generated response")
    session_id: str = Field(..., description="Session ID for follow-up messages")
    sources: list[str] = Field(default_factory=list, description="Data sources used")


# ── City Search Models ──────────────────────────────────────────

class CityResult(BaseModel):
    """A city from the geocoding API."""
    name: str
    state: Optional[str] = None
    country: str
    lat: float
    lon: float


class CitySearchResponse(BaseModel):
    """City autocomplete results."""
    results: list[CityResult]
