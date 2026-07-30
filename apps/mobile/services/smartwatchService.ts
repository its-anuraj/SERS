/**
 * Smartwatch Service — Heart Rate (BPM) & Pulse Monitoring
 * Connects to Bluetooth Low Energy (BLE) Smartwatches via standard Heart Rate GATT Service (0x180D)
 * Includes Smartwatch Simulator for testing without physical hardware.
 */

export interface HeartRateData {
  bpm: number;
  pulseStatus: 'NORMAL' | 'TACHYCARDIA' | 'BRADYCARDIA' | 'CRITICAL_TACHYCARDIA' | 'CRITICAL_BRADYCARDIA';
  isEmergency: boolean;
  timestamp: number;
  source: 'bluetooth_watch' | 'simulated';
}

export type HeartRateListener = (data: HeartRateData) => void;
export type EmergencyTriggerListener = (data: HeartRateData) => void;

let isConnected = false;
let simulationInterval: any = null;
let currentBpm = 72;
let listeners: HeartRateListener[] = [];
let emergencyListeners: EmergencyTriggerListener[] = [];
let isSimulationMode = false;

/**
 * Classify Heart Rate status
 */
export const classifyPulse = (bpm: number): HeartRateData['pulseStatus'] => {
  if (bpm >= 150) return 'CRITICAL_TACHYCARDIA';
  if (bpm <= 40) return 'CRITICAL_BRADYCARDIA';
  if (bpm >= 101) return 'TACHYCARDIA';
  if (bpm <= 59) return 'BRADYCARDIA';
  return 'NORMAL';
};

/**
 * Subscribe to live heart rate updates
 */
export const onHeartRateUpdate = (listener: HeartRateListener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

/**
 * Subscribe to automated cardiac emergency triggers
 */
export const onCardiacEmergencyTrigger = (listener: EmergencyTriggerListener) => {
  emergencyListeners.push(listener);
  return () => {
    emergencyListeners = emergencyListeners.filter((l) => l !== listener);
  };
};

const notifyListeners = (data: HeartRateData) => {
  listeners.forEach((l) => l(data));
  if (data.isEmergency) {
    emergencyListeners.forEach((el) => el(data));
  }
};

/**
 * Start Simulated Smartwatch Heart Rate stream (for testing)
 */
export const startSimulatedSmartwatch = (initialBpm: number = 75) => {
  if (simulationInterval) clearInterval(simulationInterval);
  isConnected = true;
  isSimulationMode = true;
  currentBpm = initialBpm;

  simulationInterval = setInterval(() => {
    // Add slight random fluctuation (+/- 2 BPM)
    const jitter = Math.floor(Math.random() * 5) - 2;
    currentBpm = Math.max(35, Math.min(220, currentBpm + jitter));

    const status = classifyPulse(currentBpm);
    const isEmergency = status === 'CRITICAL_TACHYCARDIA' || status === 'CRITICAL_BRADYCARDIA';

    const data: HeartRateData = {
      bpm: currentBpm,
      pulseStatus: status,
      isEmergency,
      timestamp: Date.now(),
      source: 'simulated',
    };

    notifyListeners(data);
  }, 1000);

  return dataForCurrentBpm();
};

/**
 * Set target BPM in simulator mode (e.g. trigger sudden spike to 165 BPM to test Cardiac SOS)
 */
export const setSimulatedBpm = (targetBpm: number) => {
  currentBpm = targetBpm;
  const status = classifyPulse(currentBpm);
  const isEmergency = status === 'CRITICAL_TACHYCARDIA' || status === 'CRITICAL_BRADYCARDIA';

  const data: HeartRateData = {
    bpm: currentBpm,
    pulseStatus: status,
    isEmergency,
    timestamp: Date.now(),
    source: 'simulated',
  };

  notifyListeners(data);
  return data;
};

/**
 * Stop Smartwatch Monitoring
 */
export const stopSmartwatch = () => {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = null;
  isConnected = false;
  isSimulationMode = false;
};

export const getSmartwatchState = () => ({
  isConnected,
  isSimulationMode,
  currentBpm,
});

const dataForCurrentBpm = (): HeartRateData => {
  const status = classifyPulse(currentBpm);
  return {
    bpm: currentBpm,
    pulseStatus: status,
    isEmergency: status === 'CRITICAL_TACHYCARDIA' || status === 'CRITICAL_BRADYCARDIA',
    timestamp: Date.now(),
    source: isSimulationMode ? 'simulated' : 'bluetooth_watch',
  };
};
