/**
 * Crash Detection Service
 * Monitors accelerometer + gyroscope with high-threshold impact heuristics.
 * Real vehicular crash impact: > 65 m/s² (> 6.5g) with severe angular jerk.
 * Prevents false positives from ordinary hand movement, walking, or emulator handling.
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

const LOCATION_TRACKING_TASK = 'SERS_LOCATION_TRACKING';
const WINDOW_SIZE = 30; // ~3 seconds at 10Hz
const CRASH_THRESHOLD = 0.90; // High confidence required

let sensorBuffer: any[] = [];
let isCrashCooldown = false; // Prevent multiple triggers
let onCrashDetected: ((probability: number) => void) | null = null;

/**
 * Start crash detection loop
 */
export const startCrashDetection = (onCrash: (probability: number) => void) => {
  onCrashDetected = onCrash;

  try {
    Accelerometer.setUpdateInterval(200); // 5Hz sampling to save battery
    Gyroscope.setUpdateInterval(200);

    let accelData = { x: 0, y: 0, z: 0 };
    let gyroData = { pitch: 0, roll: 0, yaw: 0 };

    const accelSub = Accelerometer.addListener((data) => { accelData = data; });
    const gyroSub = Gyroscope.addListener((data) => {
      gyroData = { pitch: data.x * 57.3, roll: data.y * 57.3, yaw: data.z * 57.3 };
    });

    // Process buffer
    const interval = setInterval(async () => {
      const reading = {
        timestamp_ms: Date.now(),
        accel_x: (accelData.x || 0) * 9.81,  // Convert g to m/s²
        accel_y: (accelData.y || 0) * 9.81,
        accel_z: (accelData.z || 0) * 9.81,
        gyro_pitch: gyroData.pitch || 0,
        gyro_roll: gyroData.roll || 0,
        gyro_yaw: gyroData.yaw || 0,
      };

      sensorBuffer.push(reading);
      if (sensorBuffer.length > WINDOW_SIZE) sensorBuffer.shift();

      if (sensorBuffer.length < 15) return;

      // Real vehicle collision requires extreme G-force impact (> 65 m/s² / ~6.6g)
      const maxAccelMag = Math.max(...sensorBuffer.map(r =>
        Math.sqrt((r.accel_x || 0) ** 2 + (r.accel_y || 0) ** 2 + (r.accel_z || 0) ** 2)
      ));

      const maxGyroMag = Math.max(...sensorBuffer.map(r =>
        Math.sqrt((r.gyro_pitch || 0) ** 2 + (r.gyro_roll || 0) ** 2 + (r.gyro_yaw || 0) ** 2)
      ));

      // Dual-condition: High G-Force (> 65 m/s²) + High rotational impact (> 300 deg/s)
      if (maxAccelMag > 65 && maxGyroMag > 300 && !isCrashCooldown) {
        analyzeForCrash([...sensorBuffer]);
      }
    }, 200);

    return () => {
      clearInterval(interval);
      accelSub.remove();
      gyroSub.remove();
    };
  } catch (err) {
    console.warn('Crash sensors not available on this device', err);
    return () => {};
  }
};

const analyzeForCrash = async (readings: any[]) => {
  if (isCrashCooldown) return;

  try {
    const response = await api.post('/ml/crash-detection', {
      device_id: 'mobile',
      readings: readings.slice(-15),
    });

    const { crash_probability, is_crash } = response.data || {};

    if (is_crash && crash_probability >= CRASH_THRESHOLD) {
      isCrashCooldown = true;
      console.log(`[CrashDetection] 🚨 Verified vehicular collision detected (Confidence: ${crash_probability})`);
      onCrashDetected?.(crash_probability);
      setTimeout(() => { isCrashCooldown = false; }, 5 * 60 * 1000);
    }
  } catch {
    // Only trigger on definitive extreme impact (> 80 m/s² / ~8g)
    const maxMag = Math.max(...readings.map((r: any) =>
      Math.sqrt((r.accel_x || 0) ** 2 + (r.accel_y || 0) ** 2 + (r.accel_z || 0) ** 2)
    ));
    if (maxMag > 80 && !isCrashCooldown) {
      isCrashCooldown = true;
      console.log('[CrashDetection] Extreme collision threshold exceeded.');
      onCrashDetected?.(0.95);
      setTimeout(() => { isCrashCooldown = false; }, 5 * 60 * 1000);
    }
  }
};

/**
 * Background location tracking task
 */
export const startLocationTracking = async (ambulanceId: string) => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return;

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: 'SERS Active',
      notificationBody: 'Location sharing for emergency response',
      notificationColor: '#ef4444',
    },
  });
};

const offlineLocationQueue: any[] = [];

const flushOfflineQueue = async (ambulanceId: string) => {
  if (!offlineLocationQueue.length) return;
  const queueToFlush = [...offlineLocationQueue];
  offlineLocationQueue.length = 0;

  for (const item of queueToFlush) {
    try {
      await api.post(`/ambulances/${ambulanceId}/location`, item, {
        headers: { 'x-skip-db': 'true' },
      });
    } catch {
      offlineLocationQueue.push(item);
      break;
    }
  }
};

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) return;
  const [location] = data.locations;
  if (!location) return;

  const updatePayload = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    heading: location.coords.heading || 0,
    speedKmh: location.coords.speed ? location.coords.speed * 3.6 : 0,
    timestamp: Date.now(),
  };

  try {
    const ambulanceId = await SecureStore.getItemAsync('ambulance_id');
    if (!ambulanceId) return;

    await flushOfflineQueue(ambulanceId);

    await api.post(`/ambulances/${ambulanceId}/location`, updatePayload, {
      headers: { 'x-skip-db': 'true' },
    });
  } catch {
    if (offlineLocationQueue.length < 50) {
      offlineLocationQueue.push(updatePayload);
    }
  }
});

export const stopLocationTracking = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }
};
