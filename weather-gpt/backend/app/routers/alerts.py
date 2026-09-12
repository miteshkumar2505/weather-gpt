"""
WeatherGPT — Alerts Router
Endpoints for weather alerts and warnings.
"""

from fastapi import APIRouter, HTTPException, Query
from app.schemas import AlertsResponse
from app.services import weather_service

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=AlertsResponse)
async def get_alerts(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """
    Get active weather alerts for a location.
    Returns color-coded severity: Red (take action), Orange (be prepared), Yellow (stay updated).
    """
    try:
        return await weather_service.get_alerts(lat=lat, lon=lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")
