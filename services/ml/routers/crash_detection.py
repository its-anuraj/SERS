"""
Crash Detection Router
Accepts accelerometer + gyroscope data, returns crash probability
Phase 1: Rule-based heuristic stub
Phase 3: LSTM/CNN TFLite model
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()


class SensorReading(BaseModel):
    timestamp_ms: int
    accel_x: float   # m/s²
    accel_y: float
    accel_z: float
    gyro_pitch: float  # deg/s
    gyro_roll: float
    gyro_yaw: float
    speed_kmh: Optional[float] = 0.0


class CrashDetectionRequest(BaseModel):
    device_id: str
    readings: List[SensorReading]  # Last N readings (typically 2-5 seconds)


class CrashDetectionResponse(BaseModel):
    crash_probability: float    # 0.0 - 1.0
    is_crash: bool
    confidence: float
    detected_pattern: str       # 'sudden_stop', 'rollover', 'freefall', 'none'
    trigger_threshold: float = 0.85


@router.post("", response_model=CrashDetectionResponse)
def detect_crash(request: CrashDetectionRequest):
    """
    Analyze sensor readings for crash detection.
    
    Phase 1 (current): Rule-based heuristic using physics thresholds
    Phase 3: Replace with trained LSTM/CNN TFLite model

    Crash indicators:
    - Sudden deceleration > 3g (29.4 m/s²)
    - Combined acceleration magnitude spike
    - Rollover: high pitch/roll rates
    - Freefall: near-zero g-force then impact
    """
    if not request.readings:
        return CrashDetectionResponse(
            crash_probability=0.0, is_crash=False,
            confidence=0.0, detected_pattern='none'
        )

    # Calculate acceleration magnitude for each reading
    magnitudes = []
    for r in request.readings:
        mag = math.sqrt(r.accel_x**2 + r.accel_y**2 + r.accel_z**2)
        magnitudes.append(mag)

    max_magnitude = max(magnitudes)
    avg_magnitude = sum(magnitudes) / len(magnitudes)

    # Gyroscope analysis
    max_rotation = max(
        max(abs(r.gyro_pitch) + abs(r.gyro_roll) + abs(r.gyro_yaw) for r in request.readings),
        0.1
    )

    crash_probability = 0.0
    pattern = 'none'

    # Sudden impact (> 2.5g = 24.5 m/s²)
    if max_magnitude > 24.5:
        crash_probability = min(0.5 + (max_magnitude - 24.5) / 30.0, 0.95)
        pattern = 'sudden_stop'

    # Rollover detection (high rotation + lateral acceleration)
    if max_rotation > 180 and max_magnitude > 15:
        rollover_prob = min(0.6 + max_rotation / 500.0, 0.95)
        if rollover_prob > crash_probability:
            crash_probability = rollover_prob
            pattern = 'rollover'

    # Freefall: g-force drops to near-zero then spikes
    if len(magnitudes) >= 3:
        min_mag = min(magnitudes)
        if min_mag < 3.0 and max_magnitude > 20.0:
            freefall_prob = 0.80
            if freefall_prob > crash_probability:
                crash_probability = freefall_prob
                pattern = 'freefall'

    threshold = 0.85
    is_crash = crash_probability >= threshold

    return CrashDetectionResponse(
        crash_probability=round(crash_probability, 4),
        is_crash=is_crash,
        confidence=round(min(crash_probability + 0.05, 1.0), 4),
        detected_pattern=pattern,
        trigger_threshold=threshold,
    )
