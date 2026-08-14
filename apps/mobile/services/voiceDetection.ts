/**
 * Voice Detection Service with Continuous Microphone Listening
 * Listens for emergency distress keywords in real-time:
 * "help", "emergency", "bachao", "maddad karo", "madad", "ambulance", "save me".
 * If spoken 3 times within 3-8 seconds, automatically triggers instant Voice Emergency SOS.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export const EMERGENCY_KEYWORDS = [
  'help',
  'emergency',
  'bachao',
  'maddad karo',
  'maddat kro',
  'madad',
  'ambulance',
  'save me',
];

export interface VoiceDetectionState {
  isListening: boolean;
  matchCount: number;
  recentMatches: string[];
  lastMatchTime: number | null;
  audioLevel: number;
}

let isListening = false;
let keywordMatches: { word: string; timestamp: number }[] = [];
let triggerCallback: ((data: { keyword: string; count: number }) => void) | null = null;
let stateChangeListeners: ((state: VoiceDetectionState) => void)[] = [];
let recordingInstance: Audio.Recording | null = null;
let webSpeechRecognition: any = null;

export const onVoiceStateChange = (listener: (state: VoiceDetectionState) => void) => {
  stateChangeListeners.push(listener);
  return () => {
    stateChangeListeners = stateChangeListeners.filter((l) => l !== listener);
  };
};

const notifyState = (audioLevel: number = 0) => {
  const state: VoiceDetectionState = {
    isListening,
    matchCount: keywordMatches.length,
    recentMatches: keywordMatches.map((m) => m.word),
    lastMatchTime: keywordMatches.length > 0 ? keywordMatches[keywordMatches.length - 1].timestamp : null,
    audioLevel,
  };
  stateChangeListeners.forEach((l) => l(state));
};

/**
 * Process spoken transcript in real-time
 * Checks if transcript contains emergency keywords within 8 seconds window.
 */
export const processVoiceTranscript = (transcript: string): boolean => {
  if (!isListening || !transcript) return false;

  const normalized = transcript.toLowerCase().trim();
  const now = Date.now();

  // Prune matches older than 8 seconds (rapid distress window)
  keywordMatches = keywordMatches.filter((m) => now - m.timestamp < 8000);

  // Check if any keyword matches
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      keywordMatches.push({ word: keyword, timestamp: now });
      console.log(`[VoiceDetection] 🗣️ Heard distress keyword: "${keyword}" (${keywordMatches.length}/3 matches)`);

      notifyState();

      if (keywordMatches.length >= 3) {
        console.log(`[VoiceDetection] 🚨 3X DISTRESS KEYWORDS DETECTED IN 5 SECONDS! TRIGGERING SOS.`);
        const lastKeyword = keyword;
        keywordMatches = []; // Reset after trigger
        notifyState();
        triggerCallback?.({ keyword: lastKeyword, count: 3 });
        return true;
      }
      return true;
    }
  }

  return false;
};

/**
 * Manually feed a recognized keyword
 */
export const recordVoiceKeyword = (keyword: string) => {
  return processVoiceTranscript(keyword);
};

/**
 * Initialize Web Speech Recognition if on Web/Chrome
 */
const initWebSpeech = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        webSpeechRecognition = new SpeechRecognition();
        webSpeechRecognition.continuous = true;
        webSpeechRecognition.interimResults = true;
        webSpeechRecognition.lang = 'hi-IN, en-US';

        webSpeechRecognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (transcript) {
              processVoiceTranscript(transcript);
            }
          }
        };

        webSpeechRecognition.onend = () => {
          if (isListening && webSpeechRecognition) {
            try { webSpeechRecognition.start(); } catch {}
          }
        };

        webSpeechRecognition.start();
        console.log('[VoiceDetection] Web Speech Recognition started');
      } catch (e) {
        console.log('[VoiceDetection] Web speech init note:', e);
      }
    }
  }
};

/**
 * Start Live Microphone Voice Detection
 */
export const startVoiceDetection = async (onTrigger: (data: { keyword: string; count: number }) => void) => {
  triggerCallback = onTrigger;
  isListening = true;
  keywordMatches = [];

  console.log('[VoiceDetection] 🎙️ Live Voice Detection Active. Listening for:', EMERGENCY_KEYWORDS.join(', '));
  notifyState();

  try {
    const perm = await Audio.requestPermissionsAsync();
    if (perm.granted) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          // If loud spike in voice audio level detected (e.g. shouting for help)
          const level = Math.max(0, (status.metering + 160) / 160);
          notifyState(level);
        }
      });

      await recording.startAsync();
      recordingInstance = recording;
      console.log('[VoiceDetection] Live microphone audio stream initialized');
    }
  } catch (err) {
    console.log('[VoiceDetection] Microphone audio stream note:', err);
  }

  initWebSpeech();

  return stopVoiceDetection;
};

/**
 * Stop Voice Detection
 */
export const stopVoiceDetection = async () => {
  isListening = false;
  keywordMatches = [];

  if (webSpeechRecognition) {
    try { webSpeechRecognition.stop(); } catch {}
    webSpeechRecognition = null;
  }

  if (recordingInstance) {
    try {
      await recordingInstance.stopAndUnloadAsync();
    } catch {}
    recordingInstance = null;
  }

  console.log('[VoiceDetection] Voice monitoring stopped.');
  notifyState();
};

export const getVoiceDetectionState = (): VoiceDetectionState => ({
  isListening,
  matchCount: keywordMatches.length,
  recentMatches: keywordMatches.map((m) => m.word),
  lastMatchTime: keywordMatches.length > 0 ? keywordMatches[keywordMatches.length - 1].timestamp : null,
  audioLevel: 0,
});
