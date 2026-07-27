"""
Route Optimizer Router
Phase 1: Haversine-based ETA + simple waypoint
Phase 3: Google OR-Tools integration
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()


class Coordinate(BaseModel):
    lat: float
    lng: float


class RouteOptimizeRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    waypoints: List[Coordinate] = []
    avoid_areas: List[Coordinate] = []  # Blocked roads etc.


class RouteOptimizeResponse(BaseModel):
    distance_meters: float
    eta_minutes: int
    route_points: List[Coordinate]
    traffic_factor: float = 1.0


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in meters"""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))


@router.post("", response_model=RouteOptimizeResponse)
def optimize_route(request: RouteOptimizeRequest):
    """
    Calculate optimal ambulance route.
    Phase 1: Direct haversine + city speed assumption
    Phase 3: OR-Tools + live traffic API integration
    """
    # Calculate total distance
    total_distance = haversine_distance(
        request.origin.lat, request.origin.lng,
        request.destination.lat, request.destination.lng
    )

    # Add waypoint distances
    if request.waypoints:
        prev = request.origin
        for wp in request.waypoints:
            total_distance += haversine_distance(prev.lat, prev.lng, wp.lat, wp.lng)
            prev = wp
        total_distance += haversine_distance(prev.lat, prev.lng, request.destination.lat, request.destination.lng)

    # Traffic factor (simplified — Phase 3 will use real traffic API)
    import datetime
    hour = datetime.datetime.now().hour
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        traffic_factor = 1.4  # Peak hours
    elif 23 <= hour or hour <= 5:
        traffic_factor = 0.8  # Night
    else:
        traffic_factor = 1.1

    # Ambulance speed: 40 km/h city average (with siren corridor bonus)
    speed_ms = (40 * 1000 / 3600) / traffic_factor
    eta_seconds = total_distance / speed_ms
    eta_minutes = max(1, round(eta_seconds / 60))

    # Generate intermediate route points (linear interpolation for now)
    route_points = [request.origin]
    steps = min(10, max(2, int(total_distance / 500)))
    for i in range(1, steps):
        t = i / steps
        route_points.append(Coordinate(
            lat=request.origin.lat + t * (request.destination.lat - request.origin.lat),
            lng=request.origin.lng + t * (request.destination.lng - request.origin.lng),
        ))
    route_points.append(request.destination)

    return RouteOptimizeResponse(
        distance_meters=round(total_distance, 1),
        eta_minutes=eta_minutes,
        route_points=route_points,
        traffic_factor=traffic_factor,
    )
