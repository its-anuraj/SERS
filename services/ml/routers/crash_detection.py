"""
Crash Detection Router
Accepts accelerometer + gyroscope data, returns crash probability
Phase 1: Rule-based heuristic stub
Phase 3: LSTM/CNN TFLite model
"""

from fastapi import APIRouter  # type: ignore # pyright: ignore # noqa
from pydantic import BaseModel  # type: ignore # pyright: ignore # noqa
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
    detected_pattern: str       # 'sudden_stop', 'rollover', 'freefall', 'phone_drop_filtered', 'none'
    requires_human_confirmation: bool = False
    trigger_threshold: float = 0.80


@router.post("", response_model=CrashDetectionResponse)
def detect_crash(request: CrashDetectionRequest):
    """
    Analyze sensor readings for crash detection with edge-case noise filtering.
    
    Filters:
    - Speed drop delta check (sudden deceleration from motion)
    - Phone drop filter (high instantaneous spike while stationary or without rotation/speed loss)
    - Human confirmation threshold for borderline probability (0.40 - 0.79)
    """
    if not request.readings:
        return CrashDetectionResponse(
            crash_probability=0.0, is_crash=False,
            confidence=0.0, detected_pattern='none',
            requires_human_confirmation=False
        )

    # Calculate acceleration magnitude for each reading
    magnitudes = []
    speeds = [r.speed_kmh or 0.0 for r in request.readings]
    for r in request.readings:
        mag = math.sqrt(r.accel_x**2 + r.accel_y**2 + r.accel_z**2)
        magnitudes.append(mag)

    max_magnitude = max(magnitudes)
    avg_magnitude = sum(magnitudes) / len(magnitudes)
    
    initial_speed = speeds[0] if speeds else 0.0
    final_speed = speeds[-1] if speeds else 0.0
    speed_drop = max(0.0, initial_speed - final_speed)

    # Gyroscope analysis
    max_rotation = max(
        max(abs(r.gyro_pitch) + abs(r.gyro_roll) + abs(r.gyro_yaw) for r in request.readings),
        0.1
    )

    crash_probability = 0.0
    pattern = 'none'

    # Sudden impact (> 24.5 m/s² ~= 2.5g)
    if max_magnitude > 24.5:
        crash_probability = min(0.5 + (max_magnitude - 24.5) / 30.0, 0.95)
        pattern = 'sudden_stop'

        # Speed drop reinforcement
        if initial_speed > 20.0 and speed_drop > 15.0:
            crash_probability = min(crash_probability + 0.15, 0.98)

        # Phone drop filter: stationary phone dropping on floor (speed ~0, high magnitude spike, short duration)
        high_spikes = sum(1 for m in magnitudes if m > 24.5)
        if initial_speed < 5.0 and high_spikes <= 2 and max_rotation < 90.0:
            crash_probability = max(0.15, crash_probability - 0.50)
            pattern = 'phone_drop_filtered'

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
            if freefall_prob > crash_probability and pattern != 'phone_drop_filtered':
                crash_probability = freefall_prob
                pattern = 'freefall'

    threshold = 0.80
    is_crash = crash_probability >= threshold
    requires_human_review = 0.40 <= crash_probability < threshold

    return CrashDetectionResponse(
        crash_probability=round(crash_probability, 4),
        is_crash=is_crash,
        confidence=round(min(crash_probability + 0.05, 1.0), 4),
        detected_pattern=pattern,
        requires_human_confirmation=requires_human_review,
        trigger_threshold=threshold,
    )

