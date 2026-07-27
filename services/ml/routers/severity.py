"""Severity Classifier Router — Phase 3: YOLOv8 image-based classification"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
import random

router = APIRouter()

class SeverityResponse(BaseModel):
    severity_label: str   # minor / moderate / critical
    severity_score: float # 0-10
    estimated_casualties: int
    confidence: float
    recommended_ambulances: int

@router.post("", response_model=SeverityResponse)
async def classify_severity(image: UploadFile = File(...)):
    """
    Classify accident severity from responder photo.
    Phase 1: Mock response
    Phase 3: YOLOv8 fine-tuned on accident images
    """
    # Read file to confirm upload works
    await image.read()

    # Mock response — Phase 3 replaces with real model
    score = round(random.uniform(3.0, 8.5), 1)
    if score >= 7:
        label, casualties, ambs = "critical", random.randint(2, 5), 3
    elif score >= 4:
        label, casualties, ambs = "moderate", random.randint(1, 3), 2
    else:
        label, casualties, ambs = "minor", 1, 1

    return SeverityResponse(
        severity_label=label,
        severity_score=score,
        estimated_casualties=casualties,
        confidence=round(random.uniform(0.75, 0.95), 3),
        recommended_ambulances=ambs,
    )
