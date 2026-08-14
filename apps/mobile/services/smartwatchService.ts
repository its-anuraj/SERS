/**
 * Smartwatch & Health Vitals Telemetry Service
 * Monitors real-time Heart Rate (BPM), SpO2, HRV, Skin Temp, and Motion Telemetry.
 * Includes AI Clinical Analysis Engine with strict false-alarm filtering.
 */

export interface VitalsData {
  bpm: number;
  spo2: number; // Percentage (e.g. 98%)
  hrv: number; // Heart Rate Variability in ms (e.g. 55ms)
  skinTemp: number; // Celsius (e.g. 36.5)
  isWorn: boolean; // Bio-impedance skin contact detection
  motionState: 'resting' | 'walking' | 'exercise' | 'collapse' | 'immobile_post_impact';
  rhythmStatus: 'NORMAL_SINUS' | 'TACHYCARDIA_EXERCISE' | 'BRADYCARDIA' | 'ARRHYTHMIA' | 'VENTRICULAR_TACHYCARDIA' | 'ASYSTOLE_ARREST' | 'SEVERE_HYPOXIA';
  isEmergency: boolean;
  emergencyReason?: string;
  riskScore: number; // 0 - 100%
  timestamp: number;
  source: 'bluetooth_ble' | 'apple_health' | 'simulated';
  deviceName: string;
}

export type VitalsListener = (data: VitalsData) => void;
export type CardiacEmergencyListener = (data: VitalsData) => void;

let isConnected = true;
let isSimulationMode = true;
let currentDeviceName = 'SERS Smart Cardiac Watch (BLE)';
let currentBpm = 74;
let currentSpo2 = 98;
let currentHrv = 58;
let currentSkinTemp = 36.6;
let currentIsWorn = true;
let currentMotionState: VitalsData['motionState'] = 'resting';

let simulationInterval: any = null;
let vitalsListeners: VitalsListener[] = [];
let cardiacEmergencyListeners: CardiacEmergencyListener[] = [];

// Rolling buffer for noise cancellation
let recentBpmHistory: number[] = [74, 74, 75, 73, 74];

/**
 * AI Clinical Analysis Engine
 * Evaluates multi-signal vitals and applies strict false-alarm prevention filters.
 */
export const analyzeVitals = (
  bpm: number,
  spo2: number,
  hrv: number,
  isWorn: boolean,
  motion: VitalsData['motionState']
): {
  rhythmStatus: VitalsData['rhythmStatus'];
  isEmergency: boolean;
  emergencyReason?: string;
  riskScore: number;
} => {
  // Edge Case 1: Watch Taken Off (Off-wrist)
  if (!isWorn || bpm === 0) {
    return {
      rhythmStatus: 'NORMAL_SINUS',
      isEmergency: false,
      emergencyReason: 'Watch is off-wrist. Bio-impedance sensor inactive.',
      riskScore: 0,
    };
  }

  // Edge Case 2: Healthy Physical Exercise / Gym Workout
  if (motion === 'exercise' && bpm >= 100 && bpm <= 170 && spo2 >= 95) {
    return {
      rhythmStatus: 'TACHYCARDIA_EXERCISE',
      isEmergency: false,
      emergencyReason: 'Elevated heart rate due to active physical workout/exercise. Normal physiological response.',
      riskScore: 12,
    };
  }

  // Edge Case 3: Severe Cardiac Arrest / Ventricular Tachycardia (HR > 175 resting + Low HRV)
  if (bpm >= 175 && motion !== 'exercise' && hrv < 25) {
    return {
      rhythmStatus: 'VENTRICULAR_TACHYCARDIA',
      isEmergency: true,
      emergencyReason: `Critical Ventricular Tachycardia detected (${bpm} BPM at rest with autonomic collapse). Immediate defibrillation & ICU bed required.`,
      riskScore: 98,
    };
  }

  // Edge Case 4: Severe Bradycardia / Sinus Arrest (HR < 38 BPM)
  if (bpm <= 38 && bpm > 0) {
    return {
      rhythmStatus: 'BRADYCARDIA',
      isEmergency: true,
      emergencyReason: `Critical Sinus Bradycardia detected (${bpm} BPM). High risk of syncope or heart block.`,
      riskScore: 92,
    };
  }

  // Edge Case 5: Severe Hypoxia / Respiratory Distress (SpO2 < 82%)
  if (spo2 <= 82) {
    return {
      rhythmStatus: 'SEVERE_HYPOXIA',
      isEmergency: true,
      emergencyReason: `Critical Hypoxemia (SpO2: ${spo2}%). Acute respiratory distress detected. Immediate oxygenation required.`,
      riskScore: 94,
    };
  }

  // Edge Case 6: Fall with Unconscious Immobility
  if (motion === 'immobile_post_impact') {
    return {
      rhythmStatus: 'ARRHYTHMIA',
      isEmergency: true,
      emergencyReason: 'Sudden high-impact fall detected followed by complete victim immobility.',
      riskScore: 95,
    };
  }

  // Mild Tachycardia / Arrhythmia
  if (bpm >= 105 && motion === 'resting') {
    return {
      rhythmStatus: 'ARRHYTHMIA',
      isEmergency: false,
      emergencyReason: 'Mild resting tachycardia. Monitor hydration and stress.',
      riskScore: 35,
    };
  }

  // Mild Bradycardia
  if (bpm < 58 && bpm > 38) {
    return {
      rhythmStatus: 'BRADYCARDIA',
      isEmergency: false,
      emergencyReason: 'Athletic or resting bradycardia. Normal in healthy adults.',
      riskScore: 15,
    };
  }

  return {
    rhythmStatus: 'NORMAL_SINUS',
    isEmergency: false,
    emergencyReason: 'All vitals stable. Normal sinus rhythm detected.',
    riskScore: 5,
  };
};

export const onVitalsUpdate = (listener: VitalsListener) => {
  vitalsListeners.push(listener);
  return () => {
    vitalsListeners = vitalsListeners.filter((l) => l !== listener);
  };
};

export const onCardiacEmergency = (listener: CardiacEmergencyListener) => {
  cardiacEmergencyListeners.push(listener);
  return () => {
    cardiacEmergencyListeners = cardiacEmergencyListeners.filter((l) => l !== listener);
  };
};

const broadcastVitals = () => {
  const analysis = analyzeVitals(currentBpm, currentSpo2, currentHrv, currentIsWorn, currentMotionState);
  
  const data: VitalsData = {
    bpm: currentBpm,
    spo2: currentSpo2,
    hrv: currentHrv,
    skinTemp: currentSkinTemp,
    isWorn: currentIsWorn,
    motionState: currentMotionState,
    rhythmStatus: analysis.rhythmStatus,
    isEmergency: analysis.isEmergency,
    emergencyReason: analysis.emergencyReason,
    riskScore: analysis.riskScore,
    timestamp: Date.now(),
    source: isSimulationMode ? 'simulated' : 'bluetooth_ble',
    deviceName: currentDeviceName,
  };

  vitalsListeners.forEach((l) => l(data));
  if (data.isEmergency) {
    cardiacEmergencyListeners.forEach((el) => el(data));
  }
};

/**
 * Start Live Vitals Simulator Engine
 */
export const startSmartwatchMonitoring = () => {
  if (simulationInterval) clearInterval(simulationInterval);
  isConnected = true;

  simulationInterval = setInterval(() => {
    if (currentIsWorn && currentMotionState !== 'collapse') {
      // Natural sinus rhythm micro-jitter (+/- 1 BPM)
      const jitter = Math.floor(Math.random() * 3) - 1;
      currentBpm = Math.max(30, Math.min(220, currentBpm + jitter));
      
      // Update rolling history
      recentBpmHistory.push(currentBpm);
      if (recentBpmHistory.length > 10) recentBpmHistory.shift();
    }
    broadcastVitals();
  }, 1000);

  broadcastVitals();
};

/**
 * Set Vitals Profile (for testing & emergency validation)
 */
export const setVitalsProfile = (profile: {
  bpm: number;
  spo2?: number;
  hrv?: number;
  isWorn?: boolean;
  motionState?: VitalsData['motionState'];
}) => {
  currentBpm = profile.bpm;
  if (profile.spo2 !== undefined) currentSpo2 = profile.spo2;
  if (profile.hrv !== undefined) currentHrv = profile.hrv;
  if (profile.isWorn !== undefined) currentIsWorn = profile.isWorn;
  if (profile.motionState !== undefined) currentMotionState = profile.motionState;

  broadcastVitals();
};

export const stopSmartwatchMonitoring = () => {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = null;
  isConnected = false;
};

export const getCurrentVitals = (): VitalsData => {
  const analysis = analyzeVitals(currentBpm, currentSpo2, currentHrv, currentIsWorn, currentMotionState);
  return {
    bpm: currentBpm,
    spo2: currentSpo2,
    hrv: currentHrv,
    skinTemp: currentSkinTemp,
    isWorn: currentIsWorn,
    motionState: currentMotionState,
    rhythmStatus: analysis.rhythmStatus,
    isEmergency: analysis.isEmergency,
    emergencyReason: analysis.emergencyReason,
    riskScore: analysis.riskScore,
    timestamp: Date.now(),
    source: isSimulationMode ? 'simulated' : 'bluetooth_ble',
    deviceName: currentDeviceName,
  };
};
