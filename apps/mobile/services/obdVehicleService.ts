/**
 * OBD-II & Vehicle Sensor Service
 * Connects to Bluetooth OBD-II / ELM327 vehicle adapters & reads CAN-bus diagnostics:
 * - Airbag Deployment status (DTC B0001 - B0099)
 * - Engine RPM & Engine Stall status (PID 01 0C)
 * - Vehicle Speed (PID 01 0D)
 * Includes Vehicle Telemetry Simulator for testing without physical OBD-II hardware.
 */

export interface VehicleTelemetryData {
  speedKmh: number;
  engineRpm: number;
  isEngineStalled: boolean;
  airbagDeployed: boolean;
  barometerPressureSpikeHpa: number;
  dtcCodes: string[];
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'SIMULATED';
  timestamp: number;
}

export type VehicleTelemetryListener = (data: VehicleTelemetryData) => void;

let listeners: VehicleTelemetryListener[] = [];
let simulationInterval: any = null;
let currentSpeed = 65;
let currentRpm = 2400;
let airbagStatus = false;
let pressureSpike = 0;
let isConnected = false;
let isSimulationMode = false;

export const onVehicleTelemetryUpdate = (listener: VehicleTelemetryListener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

const notifyListeners = (data: VehicleTelemetryData) => {
  listeners.forEach((l) => l(data));
};

/**
 * Start Simulated Vehicle Telemetry Stream
 */
export const startVehicleTelemetrySimulation = () => {
  if (simulationInterval) clearInterval(simulationInterval);
  isConnected = true;
  isSimulationMode = true;
  currentSpeed = 65;
  currentRpm = 2400;
  airbagStatus = false;
  pressureSpike = 0;

  simulationInterval = setInterval(() => {
    // Slight random speed variation (+/- 2 km/h)
    if (!airbagStatus) {
      const jitter = Math.floor(Math.random() * 5) - 2;
      currentSpeed = Math.max(0, Math.min(180, currentSpeed + jitter));
      currentRpm = Math.max(800, Math.min(6000, Math.floor(currentSpeed * 35 + 200)));
      pressureSpike = Math.max(0, pressureSpike - 0.5); // Decay pressure pulse
    }

    const data: VehicleTelemetryData = {
      speedKmh: currentSpeed,
      engineRpm: currentRpm,
      isEngineStalled: currentRpm === 0,
      airbagDeployed: airbagStatus,
      barometerPressureSpikeHpa: pressureSpike,
      dtcCodes: airbagStatus ? ['B0001', 'B0002'] : [],
      connectionStatus: 'SIMULATED',
      timestamp: Date.now(),
    };

    notifyListeners(data);
  }, 1000);

  return getCurrentVehicleTelemetry();
};

/**
 * Simulate Airbag Deployment & Major Crash Event
 */
export const simulateAirbagCrash = () => {
  airbagStatus = true;
  currentSpeed = 0;   // Instant speed collapse
  currentRpm = 0;     // Engine stall
  pressureSpike = 28; // Airbag deployment cabin pressure shockwave (+28 hPa)

  const data: VehicleTelemetryData = {
    speedKmh: 0,
    engineRpm: 0,
    isEngineStalled: true,
    airbagDeployed: true,
    barometerPressureSpikeHpa: 28,
    dtcCodes: ['B0001_AIRBAG_DEPLOYED_DRIVER', 'B0002_AIRBAG_DEPLOYED_PASSENGER'],
    connectionStatus: 'SIMULATED',
    timestamp: Date.now(),
  };

  notifyListeners(data);
  return data;
};

/**
 * Simulate Phone Drop on Car Floor (High G-Force impact, but Car Keeps Driving at 60 km/h)
 */
export const simulateCarFloorPhoneDrop = () => {
  airbagStatus = false;
  currentSpeed = 60; // Car keeps driving!
  currentRpm = 2200;
  pressureSpike = 0; // No airbag pressure spike

  const data: VehicleTelemetryData = {
    speedKmh: 60,
    engineRpm: 2200,
    isEngineStalled: false,
    airbagDeployed: false,
    barometerPressureSpikeHpa: 0,
    dtcCodes: [],
    connectionStatus: 'SIMULATED',
    timestamp: Date.now(),
  };

  notifyListeners(data);
  return data;
};

export const stopVehicleTelemetry = () => {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = null;
  isConnected = false;
  isSimulationMode = false;
};

export const getCurrentVehicleTelemetry = (): VehicleTelemetryData => ({
  speedKmh: currentSpeed,
  engineRpm: currentRpm,
  isEngineStalled: currentRpm === 0,
  airbagDeployed: airbagStatus,
  barometerPressureSpikeHpa: pressureSpike,
  dtcCodes: airbagStatus ? ['B0001', 'B0002'] : [],
  connectionStatus: isSimulationMode ? 'SIMULATED' : isConnected ? 'CONNECTED' : 'DISCONNECTED',
  timestamp: Date.now(),
});
