"""
WeatherGPT — Chat Service
Google Gemini-powered conversational AI with weather intelligence.
"""

import json
import uuid
import re
from typing import Optional
import google.generativeai as genai
from app.config import get_settings
from app.services import weather_service
from app.services import nwp_service

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
- For forecasts, summarize key trends such as temperature changes, rain likelihood, wind, and cloud cover.
- Be conversational, warm, accurate, and concise.
- Format responses cleanly with Markdown, bullet points, and relevant emojis.

IMPORTANT SOURCE SEPARATION:

When both current weather data and NWP/GFS data are available, always create
these two separate sections:

🌤️ Current Weather — OpenWeatherMap
- Use this section only for current temperature, feels-like temperature,
  humidity, current condition, wind, pressure, and visibility.
- Do not describe this data as NWP or GFS data.

📊 Numerical Forecast — NOAA GFS via Open-Meteo
- Use this section only for future model-predicted temperature,
  precipitation, wind speed, and cloud-cover trends.
- Clearly state that these are numerical model predictions.
- Do not call GFS data IMD data.
- Do not mix current weather values with GFS forecast values.

Always mention the source names exactly as provided.
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


async def chat(message: str, session_id: Optional[str] = None,language: str = "en",city: Optional[str] = None) -> tuple[str, str, list[str]]:
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
    nwp_context = ""
   
    city_candidate = city or _extract_potential_city(message)

    
    if city_candidate:
     try:
       
        current_for_nwp = await weather_service.get_current_weather(
    city=city_candidate
)

        nwp_data = await nwp_service.get_gfs_forecast(
    latitude=current_for_nwp.lat,
    longitude=current_for_nwp.lon,
)

        nwp_summary = nwp_service.summarize_gfs_forecast(nwp_data)

        nwp_context = (
                "\n\n[NUMERICAL FORECAST DATA — NOAA GFS via Open-Meteo]:\n"
                f"- Temperatures: {nwp_summary['temperature']}\n"
                f"- Precipitation: {nwp_summary['precipitation']}\n"
                f"- Wind speed: {nwp_summary['wind_speed']}\n"
                f"- Cloud cover: {nwp_summary['cloud_cover']}\n"
            )

     except Exception:
             nwp_context = ""
    if city_candidate:
     try:
        # Fetch current weather only once
        current = await weather_service.get_current_weather(
            city=city_candidate
        )

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

        # Fetch NWP/GFS using the same city's coordinates
        try:
            nwp_data = await nwp_service.get_gfs_forecast(
                latitude=current.lat,
                longitude=current.lon,
            )

            nwp_summary = nwp_service.summarize_gfs_forecast(nwp_data)

            nwp_context = (
                "\n\n[NWP/GFS FORECAST DATA]:\n"
                f"- Temperatures: {nwp_summary['temperature']}\n"
                f"- Precipitation: {nwp_summary['precipitation']}\n"
                f"- Wind speed: {nwp_summary['wind_speed']}\n"
                f"- Cloud cover: {nwp_summary['cloud_cover']}\n"
            )

            sources.append("NOAA GFS via Open-Meteo")

        except Exception:
            nwp_context = ""

        # Fetch the 5-day forecast when requested
        if any(
            word in message.lower()
            for word in ["forecast", "tomorrow", "week", "next days", "days"]
        ):
            try:
                forecast = await weather_service.get_forecast(
                    city=city_candidate
                )

                sources.append(
                    f"OpenWeatherMap (5-Day Forecast: {forecast.city})"
                )

                weather_context += "\n[5-DAY FORECAST HIGHLIGHTS]:\n"

                for item in forecast.items[::4][:6]:
                    cond = (
                        item.conditions[0].description
                        if item.conditions
                        else ""
                    )

                    weather_context += (
                        f"- {item.date_text}: {item.temperature}°C, "
                        f"{cond}, Rain prob: {int(item.pop * 100)}%\n"
                    )

            except Exception:
                pass

     except Exception:
        # City lookup failed
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

        def detect_language(text: str) -> str:
            """Detect the language from the user's message."""
            if re.search(r"[\u0A80-\u0AFF]", text):
                return "Gujarati"

            if re.search(r"[\u0900-\u097F]", text):
                return "Hindi"

            return "English"

        response_language = detect_language(message)

        language_instruction = (
            f"\n\nIMPORTANT LANGUAGE INSTRUCTION: "
    f"Respond entirely in {response_language}. "
    "Reply in the same language used by the user. "
    "Do not translate the user's language into English. "
    "Use natural, simple, easy-to-understand wording."
        )

        user_content += language_instruction

        if weather_context:
            user_content += f"\n{weather_context}\n(Please use the above verified live data to answer accurately.)"
        
        if nwp_context:
          user_content += (
        f"\n{nwp_context}\n"
        "(Use the NWP/GFS data as the primary source for forecast trends. "
        "Do not invent values or mix it with other forecast values.)"
    )


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
