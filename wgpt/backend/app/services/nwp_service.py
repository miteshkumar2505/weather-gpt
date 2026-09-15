import httpx


async def get_gfs_forecast(latitude: float, longitude: float):
    """
    Fetch forecast data from the NOAA GFS model through Open-Meteo.
    """

    url = "https://api.open-meteo.com/v1/gfs"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "pressure_msl,"
            "cloud_cover"
        ),
        "forecast_days": 3,
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()

def summarize_gfs_forecast(data: dict) -> dict:
    hourly = data.get("hourly", {})

    return {
        "times": hourly.get("time", [])[:24],
        "temperature": hourly.get("temperature_2m", [])[:24],
        "precipitation": hourly.get("precipitation", [])[:24],
        "wind_speed": hourly.get("wind_speed_10m", [])[:24],
        "cloud_cover": hourly.get("cloud_cover", [])[:24],
    }