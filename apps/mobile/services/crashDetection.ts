/**
 * Crash Detection Service
 * Runs in background, monitors accelerometer + gyroscope
 * Sends data to ML service for crash probability
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

const CRASH_DETECTION_TASK = 'SERS_CRASH_DETECTION';
const LOCATION_TRACKING_TASK = 'SERS_LOCATION_TRACKING';
const WINDOW_SIZE = 30; // ~3 seconds at 10Hz
const CRASH_THRESHOLD = 0.85;

let sensorBuffer: any[] = [];
let isCrashCooldown = false; // Prevent multiple triggers
let onCrashDetected: ((probability: number) => void) | null = null;

/**
 * Start crash detection loop
 */
export const startCrashDetection = (onCrash: (probability: number) => void) => {
  onCrashDetected = onCrash;

  Accelerometer.setUpdateInterval(100); // 10Hz
  Gyroscope.setUpdateInterval(100);

  let accelData = { x: 0, y: 0, z: 0 };
  let gyroData = { pitch: 0, roll: 0, yaw: 0 };

  Accelerometer.addListener((data) => { accelData = data; });
  Gyroscope.addListener((data) => {
    gyroData = { pitch: data.x * 57.3, roll: data.y * 57.3, yaw: data.z * 57.3 };
  });

  // Process buffer every 100ms
  const interval = setInterval(async () => {
    const reading = {
      timestamp_ms: Date.now(),
      accel_x: accelData.x * 9.81,  // Convert g to m/s²
      accel_y: accelData.y * 9.81,
      accel_z: accelData.z * 9.81,
      gyro_pitch: gyroData.pitch,
      gyro_roll: gyroData.roll,
      gyro_yaw: gyroData.yaw,
    };

    sensorBuffer.push(reading);
    if (sensorBuffer.length > WINDOW_SIZE) sensorBuffer.shift();

    // Only run analysis when buffer is full
    if (sensorBuffer.length < 10) return;

    // Quick local heuristic (before sending to ML service)
    const maxMag = Math.max(...sensorBuffer.map(r =>
      Math.sqrt(r.accel_x ** 2 + r.accel_y ** 2 + r.accel_z ** 2)
    ));

    if (maxMag > 20 && !isCrashCooldown) {
      // Potential crash — send to ML service for confirmation
      analyzeForCrash([...sensorBuffer]);
    }
  }, 100);

  return () => {
    clearInterval(interval);
    Accelerometer.removeAllListeners();
    Gyroscope.removeAllListeners();
  };
};

// Offline location buffer queue
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
      // Re-queue if network still failing
      offlineLocationQueue.push(item);
      break;
    }
  }
};

const analyzeForCrash = async (readings: any[]) => {
  if (isCrashCooldown) return;

  try {
    const response = await api.post('/ml/crash-detection', {  // proxy through main API
      device_id: 'mobile',
      readings: readings.slice(-15), // Last 1.5 seconds
    });

    const { crash_probability, is_crash } = response.data;

    if (is_crash && crash_probability >= CRASH_THRESHOLD) {
      isCrashCooldown = true;
      onCrashDetected?.(crash_probability);
      // Reset cooldown after 5 minutes
      setTimeout(() => { isCrashCooldown = false; }, 5 * 60 * 1000);
    }
  } catch (error) {
    // ML service unavailable — fallback to local heuristic evaluation
    console.warn('ML crash detection unavailable, using local heuristic fallback');
    const maxMag = Math.max(...readings.map((r: any) =>
      Math.sqrt((r.accel_x || 0) ** 2 + (r.accel_y || 0) ** 2 + (r.accel_z || 0) ** 2)
    ));
    if (maxMag > 24.5 && !isCrashCooldown) {
      isCrashCooldown = true;
      onCrashDetected?.(0.85);
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
    timeInterval: 5000,   // 5 seconds
    distanceInterval: 10, // 10 meters
    foregroundService: {
      notificationTitle: 'SERS Active',
      notificationBody: 'Location sharing for emergency response',
      notificationColor: '#ef4444',
    },
  });
};

// Task handler — runs when background location fires
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

    // Flush buffered offline items first
    await flushOfflineQueue(ambulanceId);

    await api.post(`/ambulances/${ambulanceId}/location`, updatePayload, {
      headers: { 'x-skip-db': 'true' },
    });
  } catch (err) {
    // Buffer update in memory offline queue (max 50 points)
    if (offlineLocationQueue.length < 50) {
      offlineLocationQueue.push(updatePayload);
    }
    console.warn('Location update buffered offline:', offlineLocationQueue.length);
  }
});

export const stopLocationTracking = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }
};
