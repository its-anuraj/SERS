"""
Hospital Matcher Router
Scores and ranks hospitals using weighted algorithm:
Score = (0.4 × Proximity) + (0.3 × Bed Availability) + (0.2 × Specialty Match) + (0.1 × Historical Quality)
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()


class HospitalInput(BaseModel):
    id: str
    distance_meters: float
    icu_beds_available: int
    er_beds_available: int
    specialties: List[str]
    historical_rating: Optional[float] = 0.8  # 0-1


class HospitalMatchRequest(BaseModel):
    latitude: float
    longitude: float
    hospitals: List[HospitalInput]
    required_specialties: List[str] = []
    emergency_type: str = "general"  # general, cardiac, trauma, burn, pediatric
    blood_group: Optional[str] = None


class ScoredHospital(BaseModel):
    id: str
    score: float
    proximity_score: float
    bed_score: float
    specialty_score: float
    history_score: float
    estimated_eta_mins: int


class HospitalMatchResponse(BaseModel):
    ranked_hospitals: List[ScoredHospital]


def calculate_proximity_score(distance_m: float, max_radius: float = 20000) -> float:
    """Inverse distance scoring — closer = higher score"""
    if distance_m <= 0:
        return 1.0
    return max(0.0, 1.0 - (distance_m / max_radius))


def calculate_bed_score(icu_available: int, er_available: int) -> float:
    """Score based on available beds"""
    total = icu_available + er_available
    if total == 0:
        return 0.05  # Still reachable but very low score
    return min(1.0, total / 20.0)  # Normalize: 20+ beds = 1.0


def calculate_specialty_score(hospital_specialties: List[str], required: List[str]) -> float:
    """Match required specialties against hospital capabilities"""
    if not required:
        return 0.8  # Neutral if no specific specialty needed
    
    hospital_lower = {s.lower() for s in hospital_specialties}
    required_lower = [r.lower() for r in required]
    
    # Check emergency type synonyms
    synonyms = {
        'cardiac': ['cardiology', 'cardiac', 'heart'],
        'trauma': ['trauma', 'emergency medicine', 'surgery'],
        'pediatric': ['pediatrics', 'nicu', 'children'],
        'neuro': ['neurology', 'neurosurgery', 'neuro'],
    }
    
    matched = 0
    for req in required_lower:
        expanded = synonyms.get(req, [req])
        if any(e in hospital_lower for e in expanded):
            matched += 1
    
    return matched / len(required_lower) if required_lower else 0.8


def estimate_eta(distance_m: float) -> int:
    """Rough ETA estimate: ambulance avg 40km/h in city"""
    speed_ms = 40 * 1000 / 3600  # 11.1 m/s
    eta_seconds = distance_m / speed_ms
    return max(1, round(eta_seconds / 60))


@router.post("", response_model=HospitalMatchResponse)
def match_hospital(request: HospitalMatchRequest):
    """
    Score and rank hospitals for an incident.
    """
    scored = []

    for hospital in request.hospitals:
        prox = calculate_proximity_score(hospital.distance_meters)
        beds = calculate_bed_score(hospital.icu_beds_available, hospital.er_beds_available)
        spec = calculate_specialty_score(hospital.specialties, request.required_specialties)
        hist = hospital.historical_rating

        # Weighted score formula
        score = (0.4 * prox) + (0.3 * beds) + (0.2 * spec) + (0.1 * hist)

        scored.append(ScoredHospital(
            id=hospital.id,
            score=round(score, 4),
            proximity_score=round(prox, 4),
            bed_score=round(beds, 4),
            specialty_score=round(spec, 4),
            history_score=round(hist, 4),
            estimated_eta_mins=estimate_eta(hospital.distance_meters),
        ))

    scored.sort(key=lambda h: h.score, reverse=True)
    return HospitalMatchResponse(ranked_hospitals=scored)
