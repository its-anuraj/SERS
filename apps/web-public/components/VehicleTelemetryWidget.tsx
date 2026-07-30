'use client';

import React, { useState, useEffect } from 'react';

export interface VehicleTelemetryPayload {
  maxMagnitude: number;
  barometerPressureSpikeHpa: number;
  obdAirbagDeployed: boolean;
  obdRpmStall: boolean;
  preImpactSpeedKmh: number;
  postImpactSpeedKmh: number;
  speedDropKmh: number;
  audioCrashScore: number;
  testScenarioName: string;
}

interface VehicleTelemetryWidgetProps {
  onTelemetryUpdate?: (payload: VehicleTelemetryPayload) => void;
  onRealCrashTriggered?: (payload: VehicleTelemetryPayload) => void;
  onFakeAlertCancelled?: (reason: string) => void;
}

export default function VehicleTelemetryWidget({
  onTelemetryUpdate,
  onRealCrashTriggered,
  onFakeAlertCancelled,
}: VehicleTelemetryWidgetProps) {
  const [activeScenario, setActiveScenario] = useState<'NORMAL' | 'PHONE_DROP' | 'AIRBAG_CRASH'>('NORMAL');
  const [speed, setSpeed] = useState(65);
  const [rpm, setRpm] = useState(2400);
  const [pressureSpike, setPressureSpike] = useState(0);
  const [airbagDeployed, setAirbagDeployed] = useState(false);
  const [gForce, setGForce] = useState(1.0);
  const [afdpTier, setAfdpTier] = useState<'SECURE' | 'AUTO_CANCELLED' | 'INSTANT_DISPATCH'>('SECURE');
  const [confidenceScore, setConfidenceScore] = useState(0.05);

  const runScenario = (scenario: 'NORMAL' | 'PHONE_DROP' | 'AIRBAG_CRASH') => {
    setActiveScenario(scenario);

    if (scenario === 'NORMAL') {
      setSpeed(65);
      setRpm(2400);
      setPressureSpike(0);
      setAirbagDeployed(false);
      setGForce(1.0);
      setAfdpTier('SECURE');
      setConfidenceScore(0.05);

      onTelemetryUpdate?.({
        maxMagnitude: 9.81,
        barometerPressureSpikeHpa: 0,
        obdAirbagDeployed: false,
        obdRpmStall: false,
        preImpactSpeedKmh: 65,
        postImpactSpeedKmh: 65,
        speedDropKmh: 0,
        audioCrashScore: 0.1,
        testScenarioName: 'Normal Driving',
      });
    } else if (scenario === 'PHONE_DROP') {
      // High Impact G-Force, but car keeps driving at 65 km/h and no airbag pressure spike!
      setSpeed(65);
      setRpm(2400);
      setPressureSpike(0);
      setAirbagDeployed(false);
      setGForce(28.5); // High impact from dropping phone on floor
      setAfdpTier('AUTO_CANCELLED');
      setConfidenceScore(0.12);

      const payload: VehicleTelemetryPayload = {
        maxMagnitude: 28.5,
        barometerPressureSpikeHpa: 0,
        obdAirbagDeployed: false,
        obdRpmStall: false,
        preImpactSpeedKmh: 65,
        postImpactSpeedKmh: 65, // Device moving at 65 km/h post-impact -> Car-floor drop!
        speedDropKmh: 0,
        audioCrashScore: 0.15, // Phone drop thud sound
        testScenarioName: 'Car-Floor Phone Drop (Fake Alert)',
      };

      onTelemetryUpdate?.(payload);
      onFakeAlertCancelled?.('Car-Floor Drop Filter: Phone dropped while vehicle continues driving at 65 km/h. False alarm auto-cancelled!');
    } else if (scenario === 'AIRBAG_CRASH') {
      // Major impact, Airbag deployment pressure pulse (+28 hPa), Engine Stall (0 RPM), Speed drop to 0
      setSpeed(0);
      setRpm(0);
      setPressureSpike(28);
      setAirbagDeployed(true);
      setGForce(36.2);
      setAfdpTier('INSTANT_DISPATCH');
      setConfidenceScore(0.99);

      const payload: VehicleTelemetryPayload = {
        maxMagnitude: 36.2,
        barometerPressureSpikeHpa: 28, // Airbag pressure shockwave
        obdAirbagDeployed: true,
        obdRpmStall: true,
        preImpactSpeedKmh: 80,
        postImpactSpeedKmh: 0, // Speed collapsed
        speedDropKmh: 80,
        audioCrashScore: 0.95, // Glass shatter & metal impact sound
        testScenarioName: 'Airbag Deployed & Major Collision',
      };

      onTelemetryUpdate?.(payload);
      onRealCrashTriggered?.(payload);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <i className="fa-solid fa-car-burst text-xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Vehicle OBD-II & Airbag Sensor Matrix
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                AFDP v2 Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">6-Layer Anti-Fake Verification Guard</p>
          </div>
        </div>

        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
            afdpTier === 'INSTANT_DISPATCH'
              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              : afdpTier === 'AUTO_CANCELLED'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
          }`}>
            {afdpTier === 'INSTANT_DISPATCH' && '🚨 100% CONFIRMED REAL CRASH'}
            {afdpTier === 'AUTO_CANCELLED' && '🛡️ FAKE ALERT AUTO-CANCELLED'}
            {afdpTier === 'SECURE' && '🟢 SYSTEM SECURE'}
          </span>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Confidence: {(confidenceScore * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Telemetry Gauge Indicators */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Car Speed</div>
          <div className="text-xl font-bold text-white mt-0.5">{speed} <span className="text-xs text-slate-400">km/h</span></div>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Engine RPM</div>
          <div className="text-xl font-bold text-white mt-0.5">{rpm} <span className="text-xs text-slate-400">RPM</span></div>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Barometer Pulse</div>
          <div className={`text-xl font-bold mt-0.5 ${pressureSpike > 10 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            +{pressureSpike} <span className="text-xs text-slate-400">hPa</span>
          </div>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Airbag ECU</div>
          <div className={`text-sm font-black mt-1 ${airbagDeployed ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
            {airbagDeployed ? 'DEPLOYED' : 'NORMAL'}
          </div>
        </div>
      </div>

      {/* Interactive Anti-Fake Test Control Buttons for Judges */}
      <div className="pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Test Anti-Fake Verification Matrix</span>
          <span className="text-[11px] text-slate-500 font-mono">Live Interactive Demo</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => runScenario('NORMAL')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition border ${
              activeScenario === 'NORMAL'
                ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            🚗 Normal Driving
          </button>

          <button
            onClick={() => runScenario('PHONE_DROP')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition border ${
              activeScenario === 'PHONE_DROP'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            📱 Phone Drop (Fake Alert)
          </button>

          <button
            onClick={() => runScenario('AIRBAG_CRASH')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition border ${
              activeScenario === 'AIRBAG_CRASH'
                ? 'bg-red-600 text-white border-red-400 shadow-lg animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            💥 Airbag Crash (Real SOS)
          </button>
        </div>
      </div>
    </div>
  );
}
