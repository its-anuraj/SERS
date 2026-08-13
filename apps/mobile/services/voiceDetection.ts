/**
 * Voice Detection Service (Mock)
 * Simulates listening for specific keywords: "help", "emergency", "bachao", "maddat kro".
 * In a production app, this would use react-native-voice or a native module
 * with a lightweight wake-word engine (like Porcupine) to save battery.
 */

const KEYWORDS = ['help', 'emergency', 'bachao', 'maddat kro'];
let isListening = false;
let detectionInterval: NodeJS.Timeout | null = null;
let keywordMatchCount = 0;

export const startVoiceDetection = (onTrigger: () => void) => {
  if (isListening) return () => {};
  isListening = true;
  keywordMatchCount = 0;

  console.log('[VoiceDetection] Started listening for keywords:', KEYWORDS.join(', '));

  // Simulate background listening
  // Randomly trigger a match sequence for testing purposes
  detectionInterval = setInterval(() => {
    // 2% chance every 10 seconds to simulate a user shouting for help
    if (Math.random() < 0.02) {
      console.log('[VoiceDetection] ⚠️ Heard keyword!');
      keywordMatchCount++;

      // Require 3 matches before triggering the SOS
      if (keywordMatchCount >= 3) {
        console.log('[VoiceDetection] 🚨 Trigger threshold reached! Initiating SOS.');
        onTrigger();
        keywordMatchCount = 0; // Reset after trigger
      }
    }
  }, 10000);

  return stopVoiceDetection;
};

export const stopVoiceDetection = () => {
  if (!isListening) return;
  isListening = false;
  if (detectionInterval) clearInterval(detectionInterval);
  console.log('[VoiceDetection] Stopped listening.');
};
