'use client';

import React, { useState, useEffect } from 'react';

export interface VitalsPayload {
  bpm: number;
  pulseStatus: string;
  isEmergency: boolean;
  source: string;
}

interface SmartwatchWidgetProps {
  onVitalsUpdate?: (vitals: VitalsPayload) => void;
  onCardiacEmergency?: (vitals: VitalsPayload) => void;
}

export default function SmartwatchWidget({ onVitalsUpdate, onCardiacEmergency }: SmartwatchWidgetProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [bpm, setBpm] = useState<number>(72);
  const [pulseStatus, setPulseStatus] = useState<string>('NORMAL');
  const [deviceOwner, setDeviceOwner] = useState<string>('Smartwatch');

  // Pulse status classifier
  const updateBpm = (newBpm: number, source: string) => {
    setBpm(newBpm);
    let status = 'NORMAL';
    let isEmergency = false;

    if (newBpm >= 150) {
      status = 'CRITICAL_TACHYCARDIA';
      isEmergency = true;
    } else if (newBpm <= 40) {
      status = 'CRITICAL_BRADYCARDIA';
      isEmergency = true;
    } else if (newBpm >= 101) {
      status = 'TACHYCARDIA';
    } else if (newBpm <= 59) {
      status = 'BRADYCARDIA';
    }

    setPulseStatus(status);

    const payload: VitalsPayload = {
      bpm: newBpm,
      pulseStatus: status,
      isEmergency,
      source,
    };

    onVitalsUpdate?.(payload);
    if (isEmergency) {
      onCardiacEmergency?.(payload);
    }
  };

  // Web Bluetooth GATT Scanner for Heart Rate Monitors (Service 0x180D)
  const connectBluetoothSmartwatch = async () => {
    try {
      if (!navigator.bluetooth) {
        alert('Web Bluetooth is not supported in this browser. Switching to Smartwatch Simulator mode!');
        toggleSimulation(true);
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });

      setDeviceOwner(device.name || 'Smartwatch');
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('heart_rate');
      const characteristic = await service?.getCharacteristic('heart_rate_measurement');

      await characteristic?.startNotifications();
      characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const flags = value.getUint8(0);
        const is16Bit = flags & 0x01;
        let heartRate: number;
        if (is16Bit) {
          heartRate = value.getUint16(1, true);
        } else {
          heartRate = value.getUint8(1);
        }
        updateBpm(heartRate, 'bluetooth_watch');
      });

      setIsConnected(true);
      setIsSimulating(false);
    } catch (err: any) {
      console.warn('Bluetooth connection error or cancelled:', err);
      // Fallback to simulator mode for user testing
      toggleSimulation(true);
    }
  };

  // Smartwatch Simulator loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setBpm((prev) => {
          const delta = Math.floor(Math.random() * 5) - 2;
          const next = Math.max(45, Math.min(190, prev + delta));
          updateBpm(next, 'simulated');
          return next;
        });
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  const toggleSimulation = (enable?: boolean) => {
    const nextState = enable !== undefined ? enable : !isSimulating;
    setIsSimulating(nextState);
    setIsConnected(nextState);
    setDeviceOwner(nextState ? 'Smartwatch (Simulator)' : 'Smartwatch');
    if (nextState) {
      updateBpm(74, 'simulated');
    }
  };

  const triggerSpikeTest = (spikeBpm: number) => {
    updateBpm(spikeBpm, 'simulated');
  };

  const getStatusBadgeClass = () => {
    switch (pulseStatus) {
      case 'CRITICAL_TACHYCARDIA':
      case 'CRITICAL_BRADYCARDIA':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'TACHYCARDIA':
      case 'BRADYCARDIA':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-400'}`}>
            <i className={`fa-solid fa-heart-pulse text-xl ${isConnected ? 'animate-bounce' : ''}`}></i>
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Smartwatch Health Sync
              {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
            </h3>
            <p className="text-xs text-slate-400">{deviceOwner}</p>
          </div>
        </div>

        <button
          onClick={isConnected ? () => { setIsConnected(false); setIsSimulating(false); } : connectBluetoothSmartwatch}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isConnected
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-900/30'
          }`}
        >
          {isConnected ? 'Disconnect Watch' : 'Pair Smartwatch'}
        </button>
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Live Pulse Rate</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tracking-tight">{bpm}</span>
                <span className="text-sm font-semibold text-slate-400">BPM</span>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass()}`}>
                {pulseStatus.replace('_', ' ')}
              </span>
              <div className="text-[11px] text-slate-500 mt-1">GATT HR Service (0x180D)</div>
            </div>
          </div>

          {/* Cardiac Simulation Controls for Testing */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Test Emergency Triggers</span>
              <span className="text-[11px] text-slate-500">Simulator Mode</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => triggerSpikeTest(75)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Normal (75)
              </button>
              <button
                onClick={() => triggerSpikeTest(165)}
                className="flex-1 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-800/60 rounded-lg text-xs font-medium transition"
              >
                High Spike (165)
              </button>
              <button
                onClick={() => triggerSpikeTest(35)}
                className="flex-1 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-400 border border-amber-800/60 rounded-lg text-xs font-medium transition"
              >
                Low Drop (35)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 mb-3">
            Pair your Smartwatch or Fitness Band to enable continuous heartbeat monitoring & automatic cardiac emergency detection.
          </p>
          <button
            onClick={() => toggleSimulation(true)}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-4"
          >
            Or start Smartwatch Simulator mode
          </button>
        </div>
      )}
    </div>
  );
}
