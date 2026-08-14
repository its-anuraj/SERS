/**
 * Emergency Siren & Loud Ringtone Alert Service
 * Plays high-priority loud siren audio (even in silent mode) + continuous vibration loop.
 */

import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let soundObject: Audio.Sound | null = null;
let isPlaying = false;
let vibrationInterval: any = null;

/**
 * Initializes and plays loud emergency siren tone in a loop.
 * Configures device audio session to bypass silent mode switches.
 */
export const startEmergencySiren = async () => {
  if (isPlaying) return;
  isPlaying = true;

  try {
    // Configure audio mode to bypass silent mode and ducking
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // Load and loop emergency alert sound from high-priority tone
    // We use a high-pitched siren tone URI or bundled synthesized sound
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );

    soundObject = sound;
    await sound.playAsync();
  } catch (err: any) {
    console.warn('[SirenAlarm] Sound playback failed, relying on vibration:', err.message);
  }

  // Intense repeating vibration pattern: [wait 0ms, vibrate 800ms, pause 300ms, vibrate 800ms, pause 300ms, vibrate 1200ms]
  try {
    Vibration.vibrate([0, 800, 300, 800, 300, 1200], true);
    if (!vibrationInterval) {
      vibrationInterval = setInterval(() => {
        if (isPlaying) {
          Vibration.vibrate([0, 800, 300, 800, 300, 1200], true);
        }
      }, 3500);
    }
  } catch {}
};

/**
 * Stops the emergency siren sound and vibration immediately.
 */
export const stopEmergencySiren = async () => {
  isPlaying = false;
  try {
    Vibration.cancel();
    if (vibrationInterval) {
      clearInterval(vibrationInterval);
      vibrationInterval = null;
    }
  } catch {}

  try {
    if (soundObject) {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
    }
  } catch (err: any) {
    console.warn('[SirenAlarm] Error stopping sound:', err.message);
    soundObject = null;
  }
};
