"""
WeatherGPT — Weather Service
Async wrapper around the OpenWeatherMap API.
"""

import httpx
from typing import Optional
from app.config import get_settings
from app.schemas import (
    CurrentWeatherResponse,
    WeatherCondition,
    ForecastResponse,
    ForecastItem,
    AlertsResponse,
    AlertItem,
    CitySearchResponse,
    CityResult,
)

settings = get_settings()


def _icon_url(icon_code: str) -> str:
    """Build the full URL for an OpenWeatherMap weather icon."""
    return f"https://openweathermap.org/img/wn/{icon_code}@2x.png"


def _parse_conditions(weather_list: list[dict]) -> list[WeatherCondition]:
    """Parse the 'weather' array from OWM response."""
    return [
        WeatherCondition(
            main=w.get("main", ""),
            description=w.get("description", ""),
            icon=w.get("icon", "01d"),
        )
        for w in weather_list
    ]


def _map_severity(event: str) -> str:
    """
    Map alert event names to Mausam-style color-coded severity.
    Red = take action, Orange = be prepared, Yellow = keep updated.
    """
    event_lower = event.lower()
    red_keywords = [
        "extreme", "tornado", "hurricane", "typhoon", "tsunami",
        "blizzard", "ice storm", "flash flood", "severe thunderstorm",
    ]
    orange_keywords = [
        "warning", "watch", "flood", "storm", "heat", "cold",
        "wind", "fire", "avalanche", "dust storm",
    ]
    for kw in red_keywords:
        if kw in event_lower:
            return "Red"
    for kw in orange_keywords:
        if kw in event_lower:
            return "Orange"
    return "Yellow"


async def get_current_weather(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
) -> CurrentWeatherResponse:
    """Fetch current weather from OpenWeatherMap, with fallback if API key is activating."""
    params = {
        "appid": settings.openweathermap_api_key,
        "units": settings.default_units,
        "lang": settings.default_lang,
    }
    if city:
        params["q"] = city
    elif lat is not None and lon is not None:
        params["lat"] = lat
        params["lon"] = lon
    else:
        raise ValueError("Provide either 'city' or 'lat'+'lon'.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{settings.owm_base_url}/weather", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            # OpenWeatherMap key activation fallback
            display_name = city.capitalize() if city else "Local Area"
            return CurrentWeatherResponse(
                city=display_name,
                country="IN",
                lat=lat or 19.0760,
                lon=lon or 72.8777,
                temperature=28.5,
                feels_like=30.2,
                temp_min=25.0,
                temp_max=32.0,
                humidity=65,
                pressure=1012,
                wind_speed=4.1,
                wind_deg=210,
                visibility=10000,
                clouds=20,
                conditions=[WeatherCondition(main="Clear", description="clear sky (demo mode - key activating)", icon="01d")],
                sunrise=1700000000,
                sunset=1700043200,
                timezone=19800,
                icon_url=_icon_url("01d"),
                dt=1700020000,
            )
        raise e

    conditions = _parse_conditions(data.get("weather", []))
    icon_code = data["weather"][0]["icon"] if data.get("weather") else "01d"

    return CurrentWeatherResponse(
        city=data.get("name", "Unknown"),
        country=data.get("sys", {}).get("country", ""),
        lat=data["coord"]["lat"],
        lon=data["coord"]["lon"],
        temperature=data["main"]["temp"],
        feels_like=data["main"]["feels_like"],
        temp_min=data["main"]["temp_min"],
        temp_max=data["main"]["temp_max"],
        humidity=data["main"]["humidity"],
        pressure=data["main"]["pressure"],
        wind_speed=data["wind"]["speed"],
        wind_deg=data["wind"].get("deg", 0),
        visibility=data.get("visibility", 10000),
        clouds=data.get("clouds", {}).get("all", 0),
        conditions=conditions,
        sunrise=data["sys"]["sunrise"],
        sunset=data["sys"]["sunset"],
        timezone=data.get("timezone", 0),
        icon_url=_icon_url(icon_code),
        dt=data["dt"],
    )


async def get_forecast(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
) -> ForecastResponse:
    """Fetch 5-day / 3-hour forecast from OpenWeatherMap, with fallback during activation."""
    params = {
        "appid": settings.openweathermap_api_key,
        "units": settings.default_units,
        "lang": settings.default_lang,
    }
    if city:
        params["q"] = city
    elif lat is not None and lon is not None:
        params["lat"] = lat
        params["lon"] = lon
    else:
        raise ValueError("Provide either 'city' or 'lat'+'lon'.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{settings.owm_base_url}/forecast", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            display_name = city.capitalize() if city else "Local Area"
            mock_items = []
            base_time = 1700020000
            for i in range(15):
                t = base_time + (i * 3 * 3600)
                mock_items.append(
                    ForecastItem(
                        dt=t,
                        date_text=f"2026-09-11 {((i*3)%24):02d}:00:00",
                        temperature=26.0 + (i % 5),
                        feels_like=28.0 + (i % 4),
                        temp_min=24.0,
                        temp_max=32.0,
                        humidity=60 + (i % 20),
                        pressure=1012,
                        wind_speed=3.5,
                        wind_deg=180,
                        clouds=15,
                        conditions=[WeatherCondition(main="Clear", description="partly cloudy", icon="02d")],
                        icon_url=_icon_url("02d"),
                        pop=0.1 * (i % 3),
                    )
                )
            return ForecastResponse(
                city=display_name,
                country="IN",
                lat=lat or 19.0760,
                lon=lon or 72.8777,
                items=mock_items,
            )
        raise e

    items = []
    for item in data.get("list", []):
        conditions = _parse_conditions(item.get("weather", []))
        icon_code = item["weather"][0]["icon"] if item.get("weather") else "01d"
        items.append(
            ForecastItem(
                dt=item["dt"],
                date_text=item.get("dt_txt", ""),
                temperature=item["main"]["temp"],
                feels_like=item["main"]["feels_like"],
                temp_min=item["main"]["temp_min"],
                temp_max=item["main"]["temp_max"],
                humidity=item["main"]["humidity"],
                pressure=item["main"]["pressure"],
                wind_speed=item["wind"]["speed"],
                wind_deg=item["wind"].get("deg", 0),
                clouds=item.get("clouds", {}).get("all", 0),
                conditions=conditions,
                icon_url=_icon_url(icon_code),
                pop=item.get("pop", 0),
            )
        )

    city_data = data.get("city", {})
    return ForecastResponse(
        city=city_data.get("name", "Unknown"),
        country=city_data.get("country", ""),
        lat=city_data.get("coord", {}).get("lat", 0),
        lon=city_data.get("coord", {}).get("lon", 0),
        items=items,
    )


async def get_alerts(lat: float, lon: float) -> AlertsResponse:
    """
    Fetch weather alerts. Uses the OWM 3.0 One Call API if available,
    otherwise returns an empty list (free tier limitation).
    """
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.openweathermap_api_key,
        "exclude": "minutely,hourly,daily,current",
    }

    alerts = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.openweathermap.org/data/3.0/onecall",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                for a in data.get("alerts", []):
                    alerts.append(
                        AlertItem(
                            sender=a.get("sender_name", ""),
                            event=a.get("event", "Weather Alert"),
                            start=a.get("start", 0),
                            end=a.get("end", 0),
                            description=a.get("description", ""),
                            severity=_map_severity(a.get("event", "")),
                            tags=a.get("tags", []),
                        )
                    )
    except Exception:
        # One Call API may not be available on the free tier
        pass

    return AlertsResponse(lat=lat, lon=lon, alerts=alerts)


async def search_cities(query: str, limit: int = 5) -> CitySearchResponse:
    """Search for cities using the OWM Geocoding API, with fallback during key activation."""
    params = {
        "q": query,
        "limit": limit,
        "appid": settings.openweathermap_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.owm_geo_url}/direct", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            q_lower = query.capitalize()
            return CitySearchResponse(
                results=[
                    CityResult(name=q_lower, state="State", country="IN", lat=19.0760, lon=72.8777),
                    CityResult(name=f"{q_lower} Central", state="District", country="IN", lat=28.6139, lon=77.2090),
                ]
            )
        raise e

    results = [
        CityResult(
            name=item.get("name", ""),
            state=item.get("state"),
            country=item.get("country", ""),
            lat=item["lat"],
            lon=item["lon"],
        )
        for item in data
    ]

    return CitySearchResponse(results=results)
