"""
WeatherGPT — Weather Router
Endpoints for current weather, forecasts, and city search.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.schemas import CurrentWeatherResponse, ForecastResponse, CitySearchResponse
from app.services import weather_service

router = APIRouter(prefix="/api/weather", tags=["Weather"])


@router.get("/current", response_model=CurrentWeatherResponse)
async def get_current_weather(
    city: Optional[str] = Query(None, description="City name (e.g., Mumbai, London)"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
):
    """
    Get current weather conditions for a city or coordinates.
    Provide either `city` OR both `lat` and `lon`.
    """
    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Provide either 'city' or both 'lat' and 'lon' query parameters.",
        )
    try:
        return await weather_service.get_current_weather(city=city, lat=lat, lon=lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather: {str(e)}")


@router.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
):
    """
    Get 5-day / 3-hour weather forecast.
    Provide either `city` OR both `lat` and `lon`.
    """
    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Provide either 'city' or both 'lat' and 'lon' query parameters.",
        )
    try:
        return await weather_service.get_forecast(city=city, lat=lat, lon=lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch forecast: {str(e)}")


@router.get("/search", response_model=CitySearchResponse)
async def search_cities(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Max results"),
):
    """Search for cities by name (autocomplete)."""
    try:
        return await weather_service.search_cities(query=q, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"City search failed: {str(e)}")
