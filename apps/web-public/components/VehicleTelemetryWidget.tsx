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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <i className="fa-solid fa-car-burst text-xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Vehicle OBD-II & Airbag Matrix
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-300 font-mono font-semibold">
                  AFDP v2 Engine
                </span>
              </h3>
              <p className="text-xs text-slate-500">6-Layer Anti-Fake Verification Guard</p>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
              afdpTier === 'INSTANT_DISPATCH'
                ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                : afdpTier === 'AUTO_CANCELLED'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-blue-100 text-blue-800 border-blue-300'
            }`}>
              {afdpTier === 'INSTANT_DISPATCH' && '🚨 100% CONFIRMED REAL CRASH'}
              {afdpTier === 'AUTO_CANCELLED' && '🛡️ FAKE ALERT AUTO-CANCELLED'}
              {afdpTier === 'SECURE' && '🟢 SYSTEM SECURE'}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              Confidence: {(confidenceScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Telemetry Gauge Indicators — Clean 2-column Grid with zero text overlap */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center overflow-hidden">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">Vehicle Speed</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{speed} <span className="text-xs text-slate-500 font-normal">km/h</span></div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center overflow-hidden">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">Engine Speed</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{rpm} <span className="text-xs text-slate-500 font-normal">RPM</span></div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center overflow-hidden">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">Air Pulse</div>
            <div className={`text-xl font-black mt-0.5 ${pressureSpike > 10 ? 'text-red-600 animate-pulse' : 'text-emerald-700'}`}>
              +{pressureSpike} <span className="text-xs text-slate-500 font-normal">hPa</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center overflow-hidden">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">Airbag Status</div>
            <div className={`text-sm font-black mt-1 ${airbagDeployed ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
              {airbagDeployed ? 'DEPLOYED' : 'NORMAL'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Anti-Fake Test Control Buttons */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Test Anti-Fake Verification Matrix</span>
          <span className="text-[11px] text-slate-500 font-mono">Live Demo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => runScenario('NORMAL')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeScenario === 'NORMAL'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            🚗 Normal Driving
          </button>

          <button
            onClick={() => runScenario('PHONE_DROP')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeScenario === 'PHONE_DROP'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            📱 Phone Drop (Fake)
          </button>

          <button
            onClick={() => runScenario('AIRBAG_CRASH')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeScenario === 'AIRBAG_CRASH'
                ? 'bg-red-600 text-white border-red-700 shadow-md animate-pulse'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            💥 Airbag Crash (Real)
          </button>
        </div>
      </div>
    </div>
  );
}
