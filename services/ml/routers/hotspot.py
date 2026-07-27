"""Hotspot Prediction Router"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import datetime, random

router = APIRouter()

class HotspotResponse(BaseModel):
    latitude: float
    longitude: float
    radius_meters: int
    risk_score: float
    risk_label: str
    predicted_for_hour: Optional[int] = None

@router.get("", response_model=List[HotspotResponse])
def get_hotspots(lat: float = 12.9716, lng: float = 77.5946, radius_km: float = 20.0):
    """
    Return predicted accident hotspots near a location.
    Phase 1: Static seed data near Bengaluru
    Phase 3: XGBoost/Random Forest model trained on historical incident data
    """
    hour = datetime.datetime.now().hour
    # Seed hotspots (Bengaluru major junctions)
    base_spots = [
        {"lat": 12.9716, "lng": 77.5946, "risk": 0.85, "label": "critical"},  # MG Road
        {"lat": 12.9352, "lng": 77.6245, "risk": 0.72, "label": "high"},       # Koramangala
        {"lat": 12.9783, "lng": 77.6408, "risk": 0.65, "label": "high"},       # Indiranagar
        {"lat": 12.9567, "lng": 77.6484, "risk": 0.60, "label": "medium"},     # HAL
        {"lat": 12.8814, "lng": 77.5977, "risk": 0.55, "label": "medium"},     # Bannerghatta
        {"lat": 12.9011, "lng": 77.5889, "risk": 0.45, "label": "medium"},     # JP Nagar
        {"lat": 12.9890, "lng": 77.5978, "risk": 0.35, "label": "low"},        # Cunningham
        {"lat": 13.0297, "lng": 77.5548, "risk": 0.40, "label": "low"},        # Hebbal
    ]
    # Boost risk during peak hours
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        for s in base_spots:
            s["risk"] = min(1.0, s["risk"] * 1.25)
            if s["risk"] >= 0.85: s["label"] = "critical"
            elif s["risk"] >= 0.65: s["label"] = "high"

    return [HotspotResponse(
        latitude=s["lat"], longitude=s["lng"],
        radius_meters=500, risk_score=round(s["risk"], 4),
        risk_label=s["label"], predicted_for_hour=hour
    ) for s in base_spots]
