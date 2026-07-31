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
      if (!(navigator as any).bluetooth) {
        alert('Web Bluetooth is not supported in this browser. Switching to Smartwatch Simulator mode!');
        toggleSimulation(true);
        return;
      }

      const device = await (navigator as any).bluetooth.requestDevice({
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              <i className={`fa-solid fa-heart-pulse text-xl ${isConnected ? 'animate-bounce' : ''}`}></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Smartwatch Health Sync
                {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
              </h3>
              <p className="text-xs text-slate-500">{deviceOwner}</p>
            </div>
          </div>

          <button
            onClick={isConnected ? () => { setIsConnected(false); setIsSimulating(false); } : connectBluetoothSmartwatch}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isConnected
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'
            }`}
          >
            {isConnected ? 'Disconnect Watch' : 'Pair Smartwatch'}
          </button>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Live Pulse Rate</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">{bpm}</span>
                  <span className="text-sm font-semibold text-slate-500">BPM</span>
                </div>
              </div>

              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                  pulseStatus.includes('CRITICAL') ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' :
                  pulseStatus.includes('TACHYCARDIA') ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  {pulseStatus.replace('_', ' ')}
                </span>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">GATT HR Service (0x180D)</div>
              </div>
            </div>

            {/* Cardiac Simulation Controls for Testing */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Test Emergency Triggers</span>
                <span className="text-[11px] text-slate-500 font-mono">Simulator Active</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => triggerSpikeTest(75)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Normal (75)
                </button>

                <button
                  onClick={() => triggerSpikeTest(165)}
                  className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition"
                >
                  High (165)
                </button>

                <button
                  onClick={() => triggerSpikeTest(35)}
                  className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition"
                >
                  Low (35)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-center space-y-3 my-auto">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Pair your Smartwatch or Fitness Band to enable continuous heartbeat monitoring & automatic cardiac emergency detection.
            </p>
            <button
              onClick={() => toggleSimulation(true)}
              className="text-xs font-bold text-red-600 hover:text-red-700 underline"
            >
              Or start Smartwatch Simulator mode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
