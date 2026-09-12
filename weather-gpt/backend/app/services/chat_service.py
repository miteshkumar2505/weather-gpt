"""
WeatherGPT — Chat Service
Google Gemini-powered conversational AI with weather intelligence.
"""

import json
import uuid
import re
from typing import Optional
from google import generativeai as genai
from app.config import get_settings
from app.services import weather_service

settings = get_settings()

# Configure Gemini
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key, transport="rest")

# ── In-memory conversation store ────────────────────────────────
# Maps session_id → list of {"role": "user"|"model", "parts": [str]}
_conversations: dict[str, list[dict]] = {}

SYSTEM_PROMPT = """You are **WeatherGPT**, an intelligent AI weather assistant developed for the India Meteorological Department (IMD) ecosystem, inspired by the Mausam app.

Your capabilities:
1. **Real-time Weather** — Provide current weather conditions for any city worldwide.
2. **Forecasts** — Deliver weather forecasts with trends and insights.
3. **Weather Alerts** — Explain color-coded warnings (🔴 Red = take action, 🟠 Orange = be prepared, 🟡 Yellow = stay updated).
4. **Climate Insights** — Explain weather patterns, monsoon dynamics, climate phenomena (El Niño, La Niña, Western Disturbances, cyclones).
5. **Disaster Preparedness & Health** — Offer safety tips during heatwaves, cold waves, thunderstorms, heavy rain, and air quality issues.

Guidelines:
- Present temperatures in Celsius (°C).
- Use live weather data provided in the context whenever available.
- For forecasts, summarize key trends (temperature changes, rain likelihood, wind).
- Be conversational, warm, accurate, and concise.
- Format responses cleanly with Markdown, bullet points, and relevant emojis (☀️🌧️🌩️❄️💨🌡️🌈).
"""


def _extract_potential_city(message: str) -> Optional[str]:
    """Extract a city name from common weather query patterns."""
    patterns = [
        r"(?:weather|forecast|temperature|climate|rain|alert|conditions?)\s+(?:in|at|for|of)\s+([a-zA-Z\s]+)",
        r"(?:how is the weather in|what's the weather in|what is the weather in)\s+([a-zA-Z\s]+)",
        r"([a-zA-Z\s]+)\s+(?:weather|forecast|temperature|climate)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            city = match.group(1).strip()
            # Filter out generic stop words
            clean_city = re.sub(r"\b(today|tomorrow|now|currently|like|this week)\b", "", city, flags=re.IGNORECASE).strip()
            if clean_city and len(clean_city) > 2 and len(clean_city) < 40:
                return clean_city
    return None


async def chat(message: str, session_id: Optional[str] = None) -> tuple[str, str, list[str]]:
    """
    Process a chat message and return (reply, session_id, sources).
    Uses Gemini with real-time weather context injection.
    """
    # Create or retrieve session
    if not session_id:
        session_id = str(uuid.uuid4())

    if session_id not in _conversations:
        _conversations[session_id] = []

    sources = ["Google Gemini AI"]

    # Try to fetch live weather context if query is location-related
    weather_context = ""
    city_candidate = _extract_potential_city(message)
    if city_candidate:
        try:
            current = await weather_service.get_current_weather(city=city_candidate)
            sources.append(f"OpenWeatherMap (Current: {current.city})")
            weather_context += (
                f"\n\n[LIVE WEATHER DATA for {current.city}, {current.country}]:\n"
                f"- Condition: {current.conditions[0].description.title() if current.conditions else 'N/A'}\n"
                f"- Temperature: {current.temperature}°C (Feels like: {current.feels_like}°C)\n"
                f"- Min/Max: {current.temp_min}°C / {current.temp_max}°C\n"
                f"- Humidity: {current.humidity}%\n"
                f"- Wind Speed: {current.wind_speed} m/s\n"
                f"- Pressure: {current.pressure} hPa\n"
                f"- Visibility: {current.visibility / 1000:.1f} km\n"
            )
            # If asking about forecast, also fetch forecast
            if any(w in message.lower() for w in ["forecast", "tomorrow", "week", "next days", "days"]):
                try:
                    forecast = await weather_service.get_forecast(city=city_candidate)
                    sources.append(f"OpenWeatherMap (5-Day Forecast: {forecast.city})")
                    weather_context += f"\n[5-DAY FORECAST HIGHLIGHTS]:\n"
                    # Take sample intervals
                    for item in forecast.items[::4][:6]:
                        cond = item.conditions[0].description if item.conditions else ""
                        weather_context += f"- {item.date_text}: {item.temperature}°C, {cond}, Rain prob: {int(item.pop * 100)}%\n"
                except Exception:
                    pass
        except Exception:
            # City lookup failed or not found, model will respond conversationally
            pass

    # Build Gemini history and prompt
    history = _conversations[session_id]
    
    # Configure Gemini with current key
    current_settings = get_settings()
    if current_settings.gemini_api_key:
        genai.configure(api_key=current_settings.gemini_api_key, transport="rest")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=SYSTEM_PROMPT,
        )

        # Construct full prompt with history context
        formatted_contents = []
        for turn in history[-10:]:
            formatted_contents.append({
                "role": turn["role"],
                "parts": turn["parts"]
            })

        user_content = message
        if weather_context:
            user_content += f"\n{weather_context}\n(Please use the above verified live data to answer accurately.)"

        formatted_contents.append({
            "role": "user",
            "parts": [user_content]
        })

        response = model.generate_content(formatted_contents)
        reply = response.text if response.text else "I could not generate a response. Please try asking again."

        # Save history
        _conversations[session_id].append({"role": "user", "parts": [message]})
        _conversations[session_id].append({"role": "model", "parts": [reply]})

        # Keep history trimmed
        if len(_conversations[session_id]) > 30:
            _conversations[session_id] = _conversations[session_id][-30:]

        return reply, session_id, sources

    except Exception as e:
        error_msg = str(e)
        if "API_KEY_INVALID" in error_msg or "expired" in error_msg.lower():
            return "The Gemini API key appears to be invalid or expired. Please check your API key in `backend/.env`.", session_id, sources
        
        # Fallback if Gemini request encounters an error
        return f"WeatherGPT AI is currently processing your request. Error details: {error_msg[:120]}...", session_id, sources
