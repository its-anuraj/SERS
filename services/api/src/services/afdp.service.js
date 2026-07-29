/**
 * SERS — Anti-False-Dispatch Protocol (AFDP) Engine
 * Evaluates multi-sensor telemetry, post-impact motion, audio ML score,
 * and Bluetooth status to produce a confidence score C in [0.0, 1.0].
 */

const logger = require('../config/logger');

/**
 * Calculate Crash Confidence Score (C)
 * 
 * Rules:
 * - Post-impact speed > 20 km/h: Car floor drop filter (-0.60)
 * - Bluetooth paired device disconnected: Phone drop filter (-0.50)
 * - Hard pre-impact deceleration drop (>30 km/h): Real braking (+0.40)
 * - Audio ML crash signature detected: Metal/glass impact sound (+0.35)
 * - High initial g-force magnitude (>35 m/s^2): Physical impact (+0.25)
 */
const calculateCrashConfidence = (telemetry = {}) => {
    const {
        maxMagnitude = 0,
        preImpactSpeedKmh = 0,
        postImpactSpeedKmh = 0,
        speedDropKmh = 0,
        bluetoothConnected = true,
        audioCrashScore = 0.5,
        aiSeverityScore = 5,
        isStationaryPostImpact = true,
        isHotspotLocation = false,
    } = telemetry;

    // Base score from initial impact magnitude
    let confidence = 0.50;

    if (maxMagnitude > 35) {
        confidence += 0.25;
    } else if (maxMagnitude > 24.5) {
        confidence += 0.15;
    }

    // 1. Pre-impact speed drop (Real crash involves hard braking)
    if (speedDropKmh > 30) {
        confidence += 0.30;
    } else if (speedDropKmh > 15) {
        confidence += 0.15;
    } else if (preImpactSpeedKmh > 40 && speedDropKmh < 5) {
        // High speed free-fly phone drop (no brake prior to impact)
        confidence -= 0.25;
    }

    // 2. Post-impact motion check (Car-floor filter)
    // If device continues moving at > 20 km/h post impact, phone fell inside moving vehicle
    if (postImpactSpeedKmh > 20) {
        confidence -= 0.60;
        logger.info('AFDP Filter: Car-floor drop detected (post-impact speed > 20 km/h)');
    }

    // 3. Bluetooth Proximity Handshake (Wearable / Helmet disconnect)
    if (!bluetoothConnected) {
        confidence -= 0.40;
        logger.info('AFDP Filter: Bluetooth wearable disconnected (rider moved away)');
    }

    // 4. Audio ML Crash Signature
    if (audioCrashScore >= 0.8) {
        confidence += 0.20;
    } else if (audioCrashScore < 0.3) {
        confidence -= 0.15;
    }

    // 5. Geofence Hotspot Context
    if (isHotspotLocation) {
        confidence += 0.10;
    }

    // Clamp score to [0.0, 1.0]
    confidence = Math.max(0.0, Math.min(1.0, confidence));

    // Determine Action Tier
    let tier = 'AUTO_CANCELLED';
    let requiresVerification = false;

    if (confidence >= 0.80) {
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
        filtersApplied: {
            carFloorDrop: postImpactSpeedKmh > 20,
            phoneDrop: !bluetoothConnected || (preImpactSpeedKmh > 40 && speedDropKmh < 5),
            hardBrakingDetected: speedDropKmh > 15,
            highImpactMagnitude: maxMagnitude > 24.5,
        },
    };

    logger.info('AFDP Confidence Calculated', result);
    return result;
};

module.exports = { calculateCrashConfidence };
