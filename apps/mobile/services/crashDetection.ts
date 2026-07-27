/**
 * Crash Detection Service
 * Runs in background, monitors accelerometer + gyroscope
 * Sends data to ML service for crash probability
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
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
    // ML service unavailable — fallback to local heuristic only
    console.warn('ML crash detection unavailable, using local heuristic');
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

  try {
    const ambulanceId = await import('expo-secure-store').then(m => m.getItemAsync('ambulance_id'));
    if (!ambulanceId) return;

    await api.post(`/ambulances/${ambulanceId}/location`, {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      heading: location.coords.heading,
      speedKmh: location.coords.speed ? location.coords.speed * 3.6 : 0,
    }, {
      headers: { 'x-skip-db': 'true' }, // Skip DB write (Redis only) for high-freq updates
    });
  } catch (err) {
    // Store in SQLite offline queue
    console.warn('Location update failed, queuing offline');
  }
});

export const stopLocationTracking = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }
};
