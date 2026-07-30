/**
 * SERS — AFDP v2 & Telemetry Unit Test Suite (V-Model SDLC)
 */

const { calculateCrashConfidence } = require('../src/services/afdp.service');

describe('AFDP v2 Multi-Sensor Verification Engine', () => {
    test('1. Major Collision with Airbag Deployment & Barometer Pulse -> INSTANT DISPATCH', () => {
        const result = calculateCrashConfidence({
            maxMagnitude: 36.2,
            barometerPressureSpikeHpa: 28, // Airbag pressure pulse (+28 hPa)
            obdAirbagDeployed: true,
            obdRpmStall: true,
            preImpactSpeedKmh: 80,
            postImpactSpeedKmh: 0,
            speedDropKmh: 80,
            audioCrashScore: 0.95,
        });

        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
        expect(result.tier).toBe('INSTANT_DISPATCH');
        expect(result.airbagConfirmed).toBe(true);
        expect(result.filtersApplied.barometerAirbagDetected).toBe(true);
        expect(result.filtersApplied.obdAirbagTriggered).toBe(true);
    });

    test('2. Car-Floor Phone Drop (High G-force, but car keeps driving at 65 km/h) -> AUTO CANCELLED', () => {
        const result = calculateCrashConfidence({
            maxMagnitude: 28.5,
            barometerPressureSpikeHpa: 0,
            obdAirbagDeployed: false,
            obdRpmStall: false,
            preImpactSpeedKmh: 65,
            postImpactSpeedKmh: 65, // Device moving at 65 km/h post-impact -> Phone drop on floor!
            speedDropKmh: 0,
            audioCrashScore: 0.15,
        });

        expect(result.confidenceScore).toBeLessThan(0.40);
        expect(result.tier).toBe('AUTO_CANCELLED');
        expect(result.filtersApplied.carFloorDropPrevented).toBe(true);
    });

    test('3. Smartwatch Cardiac Trauma Alert -> High Confidence Credit', () => {
        const result = calculateCrashConfidence({
            maxMagnitude: 30.0,
            smartwatchBpm: 165, // Critical Tachycardia
            isStationaryPostImpact: true,
            audioCrashScore: 0.85,
        });

        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
        expect(result.filtersApplied.smartwatchTraumaAlert).toBe(true);
    });
});
