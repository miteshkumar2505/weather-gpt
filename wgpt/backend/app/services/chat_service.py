"""
WeatherGPT — Chat Service
Google Gemini-powered conversational AI with weather intelligence.
Enhanced with specialized Agriculture, Aviation, and Marine advisories.
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
6. **Specialized Targeted Advisories & General Requirements**:
   You provide specialized guidance and understand the critical meteorological requirements for three targeted user groups:
   - **🌾 Agriculture (Farmers, Agronomists, Crop Managers)**:
     * *General requirements*: Critical focus on soil moisture, rainfall windows (3-5 day rain probability), relative humidity (pest/disease correlation), wind speed (< 15 km/h for pesticide/fertilizer spraying), thermal risks (frost < 4°C, heat stress > 38°C), and evapo-transpiration for irrigation scheduling.
     * *Special Advisory response*: Structure with 🌾 **AGROMET ADVISORY BULLETIN**:
       - 🚜 **Spraying Window**: Explicitly state whether conditions are Favorable, Caution, or Not Recommended (based on wind speed and rain probability).
       - 💧 **Irrigation Guidance**: Actionable advice to irrigate or postpone based on humidity and upcoming precipitation.
       - 🐛 **Pest & Disease Risk**: Low / Moderate / Elevated based on relative humidity and warm temperatures.
       - 🌱 **Field Operations & Crop Care**: Practical guidance for sowing, intercultural operations, or harvesting.
   - **✈️ Aviation (Pilots, Flight Dispatchers, Airfield Operators, Drone Flyers)**:
     * *General requirements*: Critical focus on Flight Category (VFR, MVFR, IFR, LIFR), cloud ceiling base (AGL) and obscuration, surface visibility in km and Statute Miles, surface wind direction & speed in knots, gust/crosswind hazards, barometric altimeter setting (QNH in hPa and inHg), convective storms, and icing levels.
     * *Special Advisory response*: Structure with ✈️ **AVIATION METEOROLOGICAL BRIEFING**:
       - 🛩️ **Flight Category**: 🟢 VFR / 🟡 MVFR / 🔴 IFR / 🟣 LIFR with clear rationale.
       - 👁️ **Visibility & Ceiling**: Surface sight distance and cloud coverage/base.
       - 💨 **Surface Winds & Runway Operations**: Wind direction, speed in knots (and m/s), crosswind/gust hazard analysis.
       - 🧭 **Altimeter Setting (QNH)**: Pressure in hPa and inHg.
       - ⚡ **Hazards & En-route Conditions**: Convective activity, turbulence, wind shear, or fog hazards.
   - **⚓ Marine (Fishermen, Coastal Sailors, Port Authorities, Marine Navigators)**:
     * *General requirements*: Critical focus on Fishermen safety warnings (safe vs do-not-venture thresholds: winds >= 40-50 km/h or 22+ knots), Beaufort Wind Scale (Force 0–12), sea state and wave height, squalls/gales, coastal visibility/sea fog, and tidal/storm surge hazards.
     * *Special Advisory response*: Structure with ⚓ **MARINE & COASTAL ADVISORY BULLETIN**:
       - 🎣 **Fishermen Warning**: Clearly state ✅ **SAFE TO VENTURE** / ⚠️ **EXERCISE CAUTION** / ⛔ **DO NOT VENTURE INTO SEA**.
       - 🌊 **Sea State & Beaufort Scale**: Force number (0-12), Beaufort description, and estimated wave height.
       - 💨 **Marine Wind Conditions**: Wind direction, speed in knots and km/h, gust/squall risk.
       - 🚢 **Port & Coastal Operations**: Coastal visibility, sea fog, and vessel navigation advice.

Guidelines:
- When a user asks about the **general requirements** or **how weather affects** these three groups, provide a clear, structured comparative overview explaining the key meteorological factors and operational thresholds for all three sectors.
- When a user asks for a specific advisory (or when domain telemetry is supplied in context), generate the structured **Special Advisory Bulletin** for that domain.
- Present temperatures in Celsius (°C), winds in m/s, km/h, and knots where appropriate.
- Use live weather data provided in the context whenever available.
- Be conversational, authoritative, accurate, and concise.
- Format responses cleanly with Markdown, bullet points, and relevant emojis.

IMPORTANT SOURCE SEPARATION:
When both current weather data and NWP/GFS data are available, always create these separate sections if presenting general weather:
🌤️ Current Weather — OpenWeatherMap
📊 Numerical Forecast — NOAA GFS via Open-Meteo
Always mention the source names exactly as provided.
"""


def _extract_potential_city(message: str) -> Optional[str]:
    """Extract a city name from common weather query patterns."""
    patterns = [
        r"(?:weather|forecast|temperature|climate|rain|alert|advisory|conditions?)\s+(?:in|at|for|of)\s+([a-zA-Z\s]+)",
        r"(?:how is the weather in|what's the weather in|what is the weather in)\s+([a-zA-Z\s]+)",
        r"([a-zA-Z\s]+)\s+(?:weather|forecast|temperature|climate|advisory)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            city = match.group(1).strip()
            # Filter out generic stop words
            clean_city = re.sub(
                r"\b(today|tomorrow|now|currently|like|this week|agriculture|aviation|marine|farmer|pilot|fishermen)\b",
                "",
                city,
                flags=re.IGNORECASE,
            ).strip()
            if clean_city and len(clean_city) > 2 and len(clean_city) < 40:
                return clean_city
    return None


def _detect_advisory_mode(message: str, requested_mode: Optional[str] = None) -> str:
    """Detect if the query is targeted for Agriculture, Aviation, or Marine."""
    if requested_mode in ("agriculture", "aviation", "marine"):
        return requested_mode

    msg = message.lower()
    agri_words = [
        "agri", "farm", "crop", "spray", "pesticide", "irrigation", "soil",
        "harvest", "sow", "kisan", "kheti", "fertilizer", "field", "khet"
    ]
    aviation_words = [
        "aviation", "flight", "pilot", "aircraft", "vfr", "ifr", "mvfr", "lifr",
        "runway", "qnh", "altimeter", "airfield", "ceiling", "crosswind", "takeoff",
        "landing", "plane", "drone", "uav", "airport"
    ]
    marine_words = [
        "marine", "fisherm", "sea", "ocean", "boat", "sail", "coastal", "wave",
        "port", "harbor", "beaufort", "squall", "tide", "matsya", "samudra",
        "machi", "ship", "knot"
    ]

    if any(w in msg for w in agri_words):
        return "agriculture"
    if any(w in msg for w in aviation_words):
        return "aviation"
    if any(w in msg for w in marine_words):
        return "marine"

    return requested_mode or "general"


def _compute_agriculture_telemetry(current, nwp_summary=None) -> dict:
    """Compute agricultural and agro-meteorological metrics from live data."""
    wind_kmh = round(current.wind_speed * 3.6, 1)
    temp = current.temperature
    humidity = current.humidity

    # Check rainfall expectation from NWP if available
    precip_expected = False
    if nwp_summary and nwp_summary.get("precipitation"):
        precip_vals = [p for p in nwp_summary["precipitation"][:12] if isinstance(p, (int, float))]
        if any(p > 0.5 for p in precip_vals):
            precip_expected = True

    # Spraying window determination
    if precip_expected or wind_kmh > 20:
        spray_status = "❌ NOT RECOMMENDED"
        spray_reason = "High drift hazard (wind > 20 km/h) or upcoming precipitation will wash away chemicals."
    elif wind_kmh > 15:
        spray_status = "⚠️ CAUTION"
        spray_reason = "Moderate wind drift risk (15-20 km/h); spray early in the morning with low nozzle heights."
    else:
        spray_status = "✅ FAVORABLE"
        spray_reason = "Calm to gentle wind (< 15 km/h) and minimal rain risk; optimal for foliar spray and fertilizer application."

    # Irrigation guidance
    if precip_expected or humidity > 80:
        irrigation_advice = "Postpone / suspend irrigation; soil moisture retention is high and rain is expected."
    elif temp > 34 or humidity < 35:
        irrigation_advice = "High water demand; apply light and frequent irrigation to prevent thermal stress and wilting."
    else:
        irrigation_advice = "Normal scheduled irrigation recommended in accordance with current crop phenological stage."

    # Pest / Fungal risk
    if humidity >= 75 and 20 <= temp <= 32:
        pest_risk = "🟠 ELEVATED / HIGH"
        pest_detail = "Warm and humid conditions favor fungal pathogens (blight, powdery mildew, rust) and sucking pests."
    elif humidity >= 65:
        pest_risk = "🟡 MODERATE"
        pest_detail = "Regular scouting recommended; conditions are moderately favorable for insect and fungal growth."
    else:
        pest_risk = "🟢 LOW"
        pest_detail = "Atmosphere is dry/mild; immediate fungal spore germination risk is low."

    # Crop thermal stress
    if temp <= 4:
        crop_stress = "🔴 CRITICAL FROST RISK: Protect sensitive seedlings, use mulching, and provide light nighttime irrigation."
    elif temp >= 38:
        crop_stress = "🟠 SEVERE HEAT STRESS: Maintain adequate soil moisture; shield sensitive horticulture and vegetable nurseries."
    else:
        crop_stress = "🟢 OPTIMAL TEMPERATURE RANGE for crop photosynthesis and development."

    return {
        "wind_kmh": wind_kmh,
        "temperature": temp,
        "humidity": humidity,
        "spray_status": spray_status,
        "spray_reason": spray_reason,
        "irrigation_advice": irrigation_advice,
        "pest_risk": pest_risk,
        "pest_detail": pest_detail,
        "crop_stress": crop_stress,
    }


def _compute_aviation_telemetry(current, nwp_summary=None) -> dict:
    """Compute aviation flight rules, runway parameters, and altimeter setting."""
    vis_km = round(current.visibility / 1000.0, 1)
    vis_sm = round(current.visibility / 1609.34, 1)
    wind_kt = round(current.wind_speed * 1.94384, 1)
    wind_deg = current.wind_deg
    clouds = current.clouds
    pressure_hpa = current.pressure
    pressure_inhg = round(pressure_hpa * 0.02953, 2)

    # Standard FAA/ICAO Flight Category estimation:
    # VFR: Ceiling > 3000 ft (clouds < 60%) and Vis > 5 SM (> 8 km)
    # MVFR: Ceiling 1000-3000 ft or Vis 3-5 SM (5-8 km)
    # IFR: Ceiling 500-1000 ft or Vis 1-3 SM (1.6-5 km)
    # LIFR: Ceiling < 500 ft or Vis < 1 SM (< 1.6 km)
    if vis_km < 1.6 or clouds >= 90:
        flight_rule = "🟣 LIFR (Low Instrument Flight Rules)"
        flight_desc = "Low visibility or thick overcast ceiling. Strictly instrument procedures required."
    elif vis_km < 5.0 or clouds >= 75:
        flight_rule = "🔴 IFR (Instrument Flight Rules)"
        flight_desc = "Ceiling or visibility restricts visual flight. Instrument rating required."
    elif vis_km < 8.0 or clouds >= 50:
        flight_rule = "🟡 MVFR (Marginal Visual Flight Rules)"
        flight_desc = "Marginal visual flight conditions. VFR pilots should exercise caution."
    else:
        flight_rule = "🟢 VFR (Visual Flight Rules)"
        flight_desc = "Ceiling and visibility unrestricted; optimal for visual flight operations and flight training."

    if wind_kt > 25:
        wind_hazard = "⚠️ HIGH SURFACE WINDS: Strong gust potential and significant crosswind limitations on runway approach."
    elif wind_kt > 15:
        wind_hazard = "Moderate surface winds: Monitor crosswind components and localized mechanical turbulence."
    else:
        wind_hazard = "Light to gentle surface winds; highly favorable for approach and departure operations."

    return {
        "vis_km": vis_km,
        "vis_sm": vis_sm,
        "wind_kt": wind_kt,
        "wind_deg": wind_deg,
        "clouds": clouds,
        "pressure_hpa": pressure_hpa,
        "pressure_inhg": pressure_inhg,
        "flight_rule": flight_rule,
        "flight_desc": flight_desc,
        "wind_hazard": wind_hazard,
    }


def _compute_marine_telemetry(current, nwp_summary=None) -> dict:
    """Compute marine wind, Beaufort scale, sea state, and fishermen bulletin."""
    wind_kt = round(current.wind_speed * 1.94384, 1)
    wind_kmh = round(current.wind_speed * 3.6, 1)
    wind_deg = current.wind_deg
    vis_km = round(current.visibility / 1000.0, 1)

    if wind_kt < 1:
        bf_scale = 0
        bf_name = "Calm"
        sea_state = "Sea like a mirror"
        wave_est = "< 0.1 m"
    elif wind_kt <= 3:
        bf_scale = 1
        bf_name = "Light Air"
        sea_state = "Ripples without crests"
        wave_est = "0.1 m"
    elif wind_kt <= 6:
        bf_scale = 2
        bf_name = "Light Breeze"
        sea_state = "Small wavelets, glass-like crests"
        wave_est = "0.2 - 0.3 m"
    elif wind_kt <= 10:
        bf_scale = 3
        bf_name = "Gentle Breeze"
        sea_state = "Large wavelets, scattered whitecaps"
        wave_est = "0.6 - 1.0 m"
    elif wind_kt <= 16:
        bf_scale = 4
        bf_name = "Moderate Breeze"
        sea_state = "Small waves with frequent whitecaps"
        wave_est = "1.0 - 1.5 m"
    elif wind_kt <= 21:
        bf_scale = 5
        bf_name = "Fresh Breeze"
        sea_state = "Moderate waves, many whitecaps, chance of spray"
        wave_est = "1.8 - 2.5 m"
    elif wind_kt <= 27:
        bf_scale = 6
        bf_name = "Strong Breeze"
        sea_state = "Large waves, extensive white foam crests, spray"
        wave_est = "2.5 - 3.5 m"
    elif wind_kt <= 33:
        bf_scale = 7
        bf_name = "Near Gale"
        sea_state = "Sea heaps up, white foam blown in streaks along direction of wind"
        wave_est = "3.5 - 4.5 m"
    elif wind_kt <= 40:
        bf_scale = 8
        bf_name = "Gale"
        sea_state = "Moderately high waves of greater length, edges of crests break into spindrift"
        wave_est = "4.5 - 6.0 m"
    elif wind_kt <= 47:
        bf_scale = 9
        bf_name = "Strong Gale"
        sea_state = "High waves, dense streaks of foam, visibility affected"
        wave_est = "6.0 - 8.0 m"
    else:
        bf_scale = 10
        bf_name = "Storm / Violent"
        sea_state = "Very high waves with long overhanging crests, white tumbling sea"
        wave_est = "> 8.0 m"

    if bf_scale >= 7 or wind_kt >= 28:
        fishermen_warning = "⛔ DANGER — DO NOT VENTURE INTO SEA: Rough to very rough sea conditions, gale-force winds. Deep-sea & coastal fishermen are strictly advised to remain ashore or return to harbor immediately."
    elif bf_scale >= 5 or wind_kt >= 17:
        fishermen_warning = "⚠️ CAUTION: Small craft and country fishing boats should exercise extreme caution due to moderate to rough seas."
    else:
        fishermen_warning = "✅ SAFE TO VENTURE: Calm to moderate sea conditions. Favorable weather for fishing and coastal craft operations."

    return {
        "wind_kt": wind_kt,
        "wind_kmh": wind_kmh,
        "wind_deg": wind_deg,
        "vis_km": vis_km,
        "bf_scale": bf_scale,
        "bf_name": bf_name,
        "sea_state": sea_state,
        "wave_est": wave_est,
        "fishermen_warning": fishermen_warning,
    }


async def chat(
    message: str,
    session_id: Optional[str] = None,
    language: str = "en",
    city: Optional[str] = None,
    advisory_type: Optional[str] = "general",
) -> tuple[str, str, list[str]]:
    """
    Process a chat message and return (reply, session_id, sources).
    Uses Gemini with real-time weather context injection and specialized
    domain metrics for Agriculture, Aviation, and Marine.
    """
    # Create or retrieve session
    if not session_id:
        session_id = str(uuid.uuid4())

    if session_id not in _conversations:
        _conversations[session_id] = []

    sources = ["Google Gemini AI"]

    # Detect domain advisory mode
    active_mode = _detect_advisory_mode(message, advisory_type)

    # Try to fetch live weather context if query is location-related
    weather_context = ""
    nwp_context = ""
    advisory_context = ""

    city_candidate = city or _extract_potential_city(message)

    current = None
    nwp_summary = None

    if city_candidate:
        try:
            # 1. Fetch current weather once
            current = await weather_service.get_current_weather(city=city_candidate)
            sources.append(f"OpenWeatherMap (Current: {current.city})")

            weather_context += (
                f"\n\n[LIVE WEATHER DATA for {current.city}, {current.country}]:\n"
                f"- Condition: {current.conditions[0].description.title() if current.conditions else 'N/A'}\n"
                f"- Temperature: {current.temperature}°C (Feels like: {current.feels_like}°C)\n"
                f"- Min/Max: {current.temp_min}°C / {current.temp_max}°C\n"
                f"- Humidity: {current.humidity}%\n"
                f"- Wind Speed: {current.wind_speed} m/s ({round(current.wind_speed * 3.6, 1)} km/h, {round(current.wind_speed * 1.94384, 1)} knots)\n"
                f"- Wind Direction: {current.wind_deg}°\n"
                f"- Pressure: {current.pressure} hPa\n"
                f"- Visibility: {current.visibility / 1000:.1f} km\n"
                f"- Cloudiness: {current.clouds}%\n"
            )

            # 2. Fetch NWP/GFS using coordinates
            try:
                nwp_data = await nwp_service.get_gfs_forecast(
                    latitude=current.lat,
                    longitude=current.lon,
                )
                nwp_summary = nwp_service.summarize_gfs_forecast(nwp_data)

                nwp_context = (
                    "\n\n[NUMERICAL FORECAST DATA — NOAA GFS via Open-Meteo]:\n"
                    f"- Temperatures: {nwp_summary['temperature']}\n"
                    f"- Precipitation: {nwp_summary['precipitation']}\n"
                    f"- Wind speed: {nwp_summary['wind_speed']}\n"
                    f"- Cloud cover: {nwp_summary['cloud_cover']}\n"
                )
                sources.append("NOAA GFS via Open-Meteo")
            except Exception:
                nwp_context = ""

            # 3. Compute domain-specific advisory telemetry
            if active_mode == "agriculture" or any(w in message.lower() for w in ["agri", "farm", "crop", "spray", "pesticide", "irrigation"]):
                agri = _compute_agriculture_telemetry(current, nwp_summary)
                advisory_context += (
                    f"\n\n[SPECIAL ADVISORY TELEMETRY — AGRICULTURE / AGROMET for {current.city}]:\n"
                    f"- Target User: Farmers, Agronomists & Agricultural Planners\n"
                    f"- Spraying Feasibility Window: {agri['spray_status']} ({agri['spray_reason']})\n"
                    f"- Surface Wind: {agri['wind_kmh']} km/h\n"
                    f"- Irrigation Guidance: {agri['irrigation_advice']}\n"
                    f"- Pest & Disease Risk: {agri['pest_risk']} ({agri['pest_detail']})\n"
                    f"- Crop Thermal / Frost Condition: {agri['crop_stress']}\n"
                )
                sources.append("Agro-meteorological Telemetry Model")

            if active_mode == "aviation" or any(w in message.lower() for w in ["aviation", "flight", "pilot", "vfr", "ifr", "runway"]):
                av = _compute_aviation_telemetry(current, nwp_summary)
                advisory_context += (
                    f"\n\n[SPECIAL ADVISORY TELEMETRY — AVIATION BRIEFING for {current.city}]:\n"
                    f"- Target User: Pilots, Flight Dispatchers, UAV/Drone Operators & Airfield Ops\n"
                    f"- Flight Rules Category: {av['flight_rule']} ({av['flight_desc']})\n"
                    f"- Visibility: {av['vis_km']} km ({av['vis_sm']} Statute Miles)\n"
                    f"- Surface Wind: {av['wind_deg']}° at {av['wind_kt']} knots ({current.wind_speed} m/s)\n"
                    f"- Altimeter (QNH): {av['pressure_hpa']} hPa ({av['pressure_inhg']} inHg)\n"
                    f"- Cloud Cover: {av['clouds']}%\n"
                    f"- Runway & Wind Hazard: {av['wind_hazard']}\n"
                )
                sources.append("Aviation METAR Flight Rules Model")

            if active_mode == "marine" or any(w in message.lower() for w in ["marine", "fisherm", "sea", "ocean", "boat", "coastal", "wave"]):
                mar = _compute_marine_telemetry(current, nwp_summary)
                advisory_context += (
                    f"\n\n[SPECIAL ADVISORY TELEMETRY — MARINE & COASTAL for {current.city}]:\n"
                    f"- Target User: Fishermen, Mariners, Port Operators & Coastal Communities\n"
                    f"- Fishermen Safety Warning: {mar['fishermen_warning']}\n"
                    f"- Beaufort Scale: Force {mar['bf_scale']} — {mar['bf_name']}\n"
                    f"- Sea State: {mar['sea_state']} (Est. Wave Height: {mar['wave_est']})\n"
                    f"- Marine Wind: {mar['wind_deg']}° at {mar['wind_kt']} knots ({mar['wind_kmh']} km/h)\n"
                    f"- Sea Visibility: {mar['vis_km']} km\n"
                )
                sources.append("Marine Beaufort Sea-State Model")

            # 4. Fetch 5-day forecast when requested
            if any(word in message.lower() for word in ["forecast", "tomorrow", "week", "next days", "days"]):
                try:
                    forecast = await weather_service.get_forecast(city=city_candidate)
                    sources.append(f"OpenWeatherMap (5-Day Forecast: {forecast.city})")
                    weather_context += "\n[5-DAY FORECAST HIGHLIGHTS]:\n"
                    for item in forecast.items[::4][:6]:
                        cond = item.conditions[0].description if item.conditions else ""
                        weather_context += (
                            f"- {item.date_text}: {item.temperature}°C, {cond}, Rain prob: {int(item.pop * 100)}%\n"
                        )
                except Exception:
                    pass

        except Exception:
            # City lookup failed
            pass

    # Build Gemini history and prompt
    history = _conversations[session_id]

    current_settings = get_settings()
    if current_settings.gemini_api_key:
        genai.configure(api_key=current_settings.gemini_api_key, transport="rest")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=SYSTEM_PROMPT,
        )

        formatted_contents = []
        for turn in history[-10:]:
            formatted_contents.append({
                "role": turn["role"],
                "parts": turn["parts"],
            })

        user_content = message

        if language == "hi":
            response_language = "Hindi (हिंदी)"
        elif language == "gu":
            response_language = "Gujarati (ગુજરાતી)"
        elif re.search(r"[\u0A80-\u0AFF]", message):
            response_language = "Gujarati (ગુજરાતી)"
        elif re.search(r"[\u0900-\u097F]", message):
            response_language = "Hindi (हिंदी)"
        else:
            response_language = "English"

        language_instruction = (
            f"\n\nIMPORTANT LANGUAGE INSTRUCTION: "
            f"Respond entirely in {response_language}. "
            f"Write the full response natively in {response_language} script using friendly, accurate weather terms. "
            f"Do not reply in English when the selected language is {response_language}."
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

        if advisory_context:
            user_content += (
                f"\n{advisory_context}\n"
                "(Use the above domain advisory telemetry to structure your Special Advisory Bulletin with precise metrics, "
                "clear headings, and authoritative guidance for the target user.)"
            )

        formatted_contents.append({
            "role": "user",
            "parts": [user_content],
        })

        response = model.generate_content(formatted_contents)
        reply = response.text if response.text else "I could not generate a response. Please try asking again."

        # Save history
        _conversations[session_id].append({"role": "user", "parts": [message]})
        _conversations[session_id].append({"role": "model", "parts": [reply]})

        if len(_conversations[session_id]) > 30:
            _conversations[session_id] = _conversations[session_id][-30:]

        return reply, session_id, sources

    except Exception as e:
        error_msg = str(e)
        if "API_KEY_INVALID" in error_msg or "expired" in error_msg.lower():
            return (
                "The Gemini API key appears to be invalid or expired. Please check your API key in `backend/.env`.",
                session_id,
                sources,
            )

        # Telemetry-backed fallback if Gemini API is rate-limited or temporarily unavailable
        city_name = current.city if current else (city_candidate or "your location")
        
        if active_mode == "agriculture" and current:
            agri = _compute_agriculture_telemetry(current, nwp_summary)
            fallback = (
                f"🌾 **AGROMET ADVISORY BULLETIN — {city_name}**\n\n"
                f"• 🚜 **Spraying Window**: {agri['spray_status']}\n"
                f"  {agri['spray_reason']} (Surface Wind: {agri['wind_kmh']} km/h)\n\n"
                f"• 💧 **Irrigation Guidance**: {agri['irrigation_advice']}\n\n"
                f"• 🐛 **Pest & Disease Risk**: {agri['pest_risk']}\n"
                f"  {agri['pest_detail']} (Humidity: {current.humidity}%, Temp: {current.temperature}°C)\n\n"
                f"• 🌱 **Crop Stress & Thermal Status**: {agri['crop_stress']}\n\n"
                f"*Data: Real-time telemetry (OpenWeatherMap & Agromet Model)*"
            )
            return fallback, session_id, sources

        elif active_mode == "aviation" and current:
            av = _compute_aviation_telemetry(current, nwp_summary)
            fallback = (
                f"✈️ **AVIATION METEOROLOGICAL BRIEFING — {city_name}**\n\n"
                f"• 🛩️ **Flight Category**: {av['flight_rule']}\n"
                f"  {av['flight_desc']}\n\n"
                f"• 👁️ **Visibility & Ceiling**: {av['vis_km']} km ({av['vis_sm']} SM) · Cloud Cover: {av['clouds']}%\n\n"
                f"• 💨 **Runway Winds**: {av['wind_deg']}° at {av['wind_kt']} kt ({current.wind_speed} m/s)\n"
                f"  {av['wind_hazard']}\n\n"
                f"• 🧭 **Altimeter Setting (QNH)**: {av['pressure_hpa']} hPa ({av['pressure_inhg']} inHg)\n\n"
                f"*Data: Real-time telemetry (OpenWeatherMap & Aviation METAR Model)*"
            )
            return fallback, session_id, sources

        elif active_mode == "marine" and current:
            mar = _compute_marine_telemetry(current, nwp_summary)
            fallback = (
                f"⚓ **MARINE & COASTAL ADVISORY BULLETIN — {city_name}**\n\n"
                f"• 🎣 **Fishermen Warning**: {mar['fishermen_warning']}\n\n"
                f"• 🌊 **Sea State & Beaufort Scale**: Force {mar['bf_scale']} ({mar['bf_name']})\n"
                f"  {mar['sea_state']} (Est. Wave Height: {mar['wave_est']})\n\n"
                f"• 💨 **Marine Wind**: {mar['wind_deg']}° at {mar['wind_kt']} knots ({mar['wind_kmh']} km/h)\n\n"
                f"• 🚢 **Coastal Operations**: Sea Visibility: {mar['vis_km']} km\n\n"
                f"*Data: Real-time telemetry (OpenWeatherMap & Beaufort Marine Model)*"
            )
            return fallback, session_id, sources

        elif any(w in message.lower() for w in ["requirement", "agriculture", "aviation", "marine", "farmer", "pilot", "fisherm"]):
            fallback = (
                "### 🌐 General Weather Requirements Across Key Sectors\n\n"
                "| Sector | Target Users | Critical Weather Parameters | Key Safety & Operational Thresholds |\n"
                "|---|---|---|---|\n"
                "| 🌾 **Agriculture** | Farmers, Agronomists | Soil moisture, 3-5 day rain probability, Relative humidity, Wind speed | Spraying: Wind < 15 km/h & no rain; Frost danger: < 4°C; High pest risk: Humidity > 75% + warm temps |\n"
                "| ✈️ **Aviation** | Pilots, Airfield Ops | Flight category (VFR/IFR), Cloud ceiling, Visibility, Runway winds, QNH | VFR: Vis > 8 km & Ceiling > 3,000 ft; IFR: Vis < 5 km or Ceiling < 1,000 ft; Crosswinds & gust limits |\n"
                "| ⚓ **Marine** | Fishermen, Sailors, Ports | Beaufort scale (0-12), Sea state, Wave height, Gale/Squall alerts | Fishermen safety warning: Wind >= 22 kt or Force 6+ is dangerous; Squalls require harbor return |\n\n"
                "Select one of the advisory tabs above (**🌾 Agriculture**, **✈️ Aviation**, or **⚓ Marine**) to view a localized advisory bulletin for any city!"
            )
            return fallback, session_id, sources

        return f"WeatherGPT AI is currently processing your request. Error details: {error_msg[:120]}...", session_id, sources
