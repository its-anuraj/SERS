/**
 * SERS — Anti-False-Dispatch Protocol (AFDP v2 Engine)
 * 6-Layer Multi-Sensor Verification & Integrity Matrix
 * Combines Accelerometer, Barometer Airbag Pulse, Vehicle OBD-II CAN-bus,
 * Audio Acoustic ML, Smartwatch Vitals, and Post-Impact GPS Motion Filters.
 */

const logger = require('../config/logger');

/**
 * Calculate Crash Confidence Score (C) in [0.0, 1.0] with 6-Layer Multi-Sensor Verification Matrix
 */
const calculateCrashConfidence = (telemetry = {}) => {
    const {
        maxMagnitude = 0,               // Layer 1: Accelerometer G-Force (m/s²)
        barometerPressureSpikeHpa = 0,  // Layer 2: Barometer Airbag Cabin Pressure Pulse (+hPa)
        obdAirbagDeployed = false,      // Layer 3: Vehicle OBD-II Airbag PID status
        obdRpmStall = false,            // Layer 3: Vehicle OBD-II Engine Stall (RPM -> 0)
        preImpactSpeedKmh = 0,
        postImpactSpeedKmh = 0,         // Layer 6: Post-impact vehicle movement
        speedDropKmh = 0,
        _bluetoothConnected = true,
        audioCrashScore = 0.5,          // Layer 4: Acoustic ML Score
        smartwatchBpm = null,           // Layer 5: Smartwatch Heart Rate (BPM)
        isStationaryPostImpact = true,  // Layer 5: Victim immobility
        isHotspotLocation = false,
    } = telemetry;

    // Base confidence score
    let confidence = 0.50;
    const verificationMatrix = {};

    // ── LAYER 1: Smartphone Accelerometer & Impact G-Force ─────────────────
    if (maxMagnitude > 35) {
        confidence += 0.25;
        verificationMatrix.layer1_impact = 'EXTREME_IMPACT';
    } else if (maxMagnitude > 24.5) {
        confidence += 0.15;
        verificationMatrix.layer1_impact = 'MODERATE_IMPACT';
    } else {
        verificationMatrix.layer1_impact = 'LOW_IMPACT';
    }

    // ── LAYER 2: Smartphone Barometer Cabin Pressure Pulse (Airbag Deployment Spike) ──
    // Airbag deployment creates a sudden 10 - 35 hPa cabin pressure shockwave within 50ms
    if (barometerPressureSpikeHpa >= 15) {
        confidence += 0.40; // Indisputable physical proof of Airbag gas expansion
        verificationMatrix.layer2_barometerAirbagPulse = `AIRBAG_PRESSURE_SPIKE (+${barometerPressureSpikeHpa} hPa)`;
    } else if (barometerPressureSpikeHpa >= 8) {
        confidence += 0.20;
        verificationMatrix.layer2_barometerAirbagPulse = `MODERATE_CABIN_PULSE (+${barometerPressureSpikeHpa} hPa)`;
    } else {
        verificationMatrix.layer2_barometerAirbagPulse = 'NORMAL_PRESSURE';
    }

    // ── LAYER 3: Vehicle OBD-II / CAN-Bus Telemetry ──────────────────────────
    if (obdAirbagDeployed) {
        confidence += 0.45; // Direct ECU Airbag signal
        verificationMatrix.layer3_obdAirbag = 'OBD_AIRBAG_DEPLOYED';
    }
    if (obdRpmStall) {
        confidence += 0.15; // Engine stalled upon collision impact
        verificationMatrix.layer3_obdEngine = 'ENGINE_STALLED_0_RPM';
    }

    // ── LAYER 4: Audio Acoustic Machine Learning ─────────────────────────────
    if (audioCrashScore >= 0.80) {
        confidence += 0.20;
        verificationMatrix.layer4_audioAcoustic = `GLASS_METAL_CRUNCH (${(audioCrashScore * 100).toFixed(0)}%)`;
    } else if (audioCrashScore < 0.25) {
        confidence -= 0.15;
        verificationMatrix.layer4_audioAcoustic = 'NO_CRASH_SOUND';
    }

    // ── LAYER 5: Smartwatch Vitals & Victim Immobility ─────────────────────
    if (smartwatchBpm !== null) {
        if (smartwatchBpm >= 140 || smartwatchBpm <= 45) {
            confidence += 0.20; // Acute physiological distress / trauma
            verificationMatrix.layer5_vitals = `CARDIAC_DISTRESS (${smartwatchBpm} BPM)`;
        } else {
            verificationMatrix.layer5_vitals = `STABLE (${smartwatchBpm} BPM)`;
        }
    }
    if (isStationaryPostImpact) {
        confidence += 0.10;
        verificationMatrix.layer5_immobility = 'VICTIM_INCAPACITATED';
    }

    // ── LAYER 6: Post-Impact GPS Speed & Phone-Drop Filter ─────────────────
    // If device continues moving at > 20 km/h post-impact, phone fell off dashboard inside moving car
    if (postImpactSpeedKmh > 20) {
        confidence -= 0.65;
        verificationMatrix.layer6_carFloorDropFilter = 'CAR_FLOOR_DROP_DETECTED (Vehicle still moving)';
        logger.info('AFDP v2 Filter: Car-floor drop detected — Vehicle speed post-impact > 20 km/h');
    }

    if (preImpactSpeedKmh > 40 && speedDropKmh < 5 && postImpactSpeedKmh > 20) {
        confidence -= 0.30;
        verificationMatrix.layer6_freeFlyPhoneDrop = 'FREE_FLY_PHONE_DROP (No pre-impact braking)';
    }

    // Pre-impact braking credit
    if (speedDropKmh > 30) {
        confidence += 0.25;
        verificationMatrix.layer6_braking = `HARD_BRAKING (-${speedDropKmh} km/h)`;
    }

    // Hotspot geofence context
    if (isHotspotLocation) {
        confidence += 0.10;
        verificationMatrix.hotspotContext = 'HIGH_ACCIDENT_HOTSPOT';
    }

    // Clamp score to [0.0, 1.0]
    confidence = Math.max(0.0, Math.min(1.0, confidence));

    // Determine Action Tier
    let tier = 'AUTO_CANCELLED';
    let requiresVerification = false;

    if (confidence >= 0.75) {
        tier = 'INSTANT_DISPATCH';
        requiresVerification = false;
    } else if (confidence >= 0.40) {
        tier = 'STAGE_1_STANDBY';
        requiresVerification = true;
    } else {
        tier = 'AUTO_CANCELLED';
        requiresVerification = false;
    }

    const result = {
        confidenceScore: parseFloat(confidence.toFixed(4)),
        tier,
        requiresVerification,
        airbagConfirmed: obdAirbagDeployed || barometerPressureSpikeHpa >= 15,
        verificationMatrix,
        filtersApplied: {
            carFloorDropPrevented: postImpactSpeedKmh > 20,
            barometerAirbagDetected: barometerPressureSpikeHpa >= 15,
            obdAirbagTriggered: obdAirbagDeployed,
            audioImpactMatch: audioCrashScore >= 0.80,
            smartwatchTraumaAlert: smartwatchBpm !== null && (smartwatchBpm >= 140 || smartwatchBpm <= 45),
        },
    };

    logger.info('AFDP v2 6-Layer Confidence Calculated', result);
    return result;
};

module.exports = { calculateCrashConfidence };
