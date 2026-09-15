"""
WeatherGPT — Alerts Router

Endpoints for forecast-based weather alerts.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.nwp_service import (
    get_gfs_forecast,
    summarize_gfs_forecast,
)
from app.services.alert_service import detect_gfs_alert


router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"],
)


@router.get("")
async def get_alerts(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    city: Optional[str] = Query(
        default=None,
        description="City name"
    ),
):
    """
    Detect forecast-based weather alerts using NOAA GFS
    data received through Open-Meteo.

    These are not official IMD warnings.
    """

    try:
        forecast_data = await get_gfs_forecast(
            latitude=lat,
            longitude=lon,
        )

        forecast_summary = summarize_gfs_forecast(
            forecast_data
        )

        return detect_gfs_alert(
            summary=forecast_summary,
            city=city,
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch forecast alerts: {error}",
        )
        
