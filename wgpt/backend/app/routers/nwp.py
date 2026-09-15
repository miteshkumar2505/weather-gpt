from fastapi import APIRouter, Query
from app.services.nwp_service import (
    get_gfs_forecast,
    summarize_gfs_forecast,
)

router = APIRouter(prefix="/nwp", tags=["NWP"])


@router.get("/gfs")
async def gfs_forecast(
    latitude: float = Query(...),
    longitude: float = Query(...)
):
    data = await get_gfs_forecast(latitude, longitude)

    return summarize_gfs_forecast(data)