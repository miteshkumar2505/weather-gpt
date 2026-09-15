from typing import Any


def _maximum(values: list[Any]):
    numbers = [
        value for value in values
        if isinstance(value, (int, float))
    ]

    return max(numbers) if numbers else None


def detect_gfs_alert(
    summary: dict,
    city: str | None = None
) -> dict:
    """
    Detects forecast-based alerts from NOAA GFS data
    received through Open-Meteo.

    These are WeatherGPT forecast alerts,
    not official IMD warnings.
    """

    precipitation = summary.get("precipitation", [])
    wind_speed = summary.get("wind_speed", [])
    temperature = summary.get("temperature", [])

    maximum_rain = _maximum(precipitation)
    maximum_wind = _maximum(wind_speed)
    maximum_temperature = _maximum(temperature)

    alerts = []

    # Rainfall thresholds: mm/hour
    if maximum_rain is not None:
        if maximum_rain >= 15:
            alerts.append({
                "type": "extreme_rain",
                "severity": "red",
                "title": "Extremely Heavy Rainfall Alert",
                "message": (
                    f"Forecast rainfall may reach "
                    f"{maximum_rain} mm/hour."
                )
            })

        elif maximum_rain >= 7.5:
            alerts.append({
                "type": "heavy_rain",
                "severity": "orange",
                "title": "Heavy Rainfall Alert",
                "message": (
                    f"Heavy rainfall is possible. "
                    f"Forecast maximum: {maximum_rain} mm/hour."
                )
            })

        elif maximum_rain >= 2.5:
            alerts.append({
                "type": "rain",
                "severity": "yellow",
                "title": "Rainfall Alert",
                "message": (
                    f"Rain is possible. "
                    f"Forecast maximum: {maximum_rain} mm/hour."
                )
            })

    # Wind thresholds: km/hour
    if maximum_wind is not None:
        if maximum_wind >= 60:
            alerts.append({
                "type": "strong_wind",
                "severity": "red",
                "title": "Very Strong Wind Alert",
                "message": (
                    f"Very strong winds may occur, "
                    f"up to {maximum_wind} km/h."
                )
            })

        elif maximum_wind >= 40:
            alerts.append({
                "type": "strong_wind",
                "severity": "orange",
                "title": "Strong Wind Alert",
                "message": (
                    f"Strong winds are possible, "
                    f"up to {maximum_wind} km/h."
                )
            })

        elif maximum_wind >= 25:
            alerts.append({
                "type": "wind",
                "severity": "yellow",
                "title": "Wind Alert",
                "message": (
                    f"Moderate to strong winds are possible, "
                    f"up to {maximum_wind} km/h."
                )
            })

    # Temperature thresholds: Celsius
    if maximum_temperature is not None:
        if maximum_temperature >= 45:
            alerts.append({
                "type": "extreme_heat",
                "severity": "red",
                "title": "Extreme Heat Alert",
                "message": (
                    f"Forecast temperature may reach "
                    f"{maximum_temperature}°C."
                )
            })

        elif maximum_temperature >= 40:
            alerts.append({
                "type": "heat",
                "severity": "orange",
                "title": "Heat Alert",
                "message": (
                    f"High temperature is possible, "
                    f"up to {maximum_temperature}°C."
                )
            })

        elif maximum_temperature >= 35:
            alerts.append({
                "type": "heat",
                "severity": "yellow",
                "title": "Warm Weather Alert",
                "message": (
                    f"Forecast temperature may reach "
                    f"{maximum_temperature}°C."
                )
            })

    severity_order = {
        "green": 0,
        "yellow": 1,
        "orange": 2,
        "red": 3
    }

    highest_severity = "green"

    if alerts:
        highest_severity = max(
            alerts,
            key=lambda alert: severity_order[alert["severity"]]
        )["severity"]

    return {
        "has_alert": len(alerts) > 0,
        "location": city,
        "highest_severity": highest_severity,
        "alerts": alerts,
        "source": "NOAA GFS via Open-Meteo",
        "official": False,
        "disclaimer": (
            "This is a forecast-based WeatherGPT alert. "
            "It is not an official IMD warning."
        )
    }