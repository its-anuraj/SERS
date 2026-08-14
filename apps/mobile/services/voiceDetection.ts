/**
 * Voice Detection Service
 * Real-time voice emergency keyword detection.
 * Listens for emergency keywords: "help", "emergency", "bachao", "maddad karo", "madad", "ambulance", "save me".
 * Requires 3 consecutive matches (either repeating the same keyword 3x or 3 selected emergency words)
 * to automatically trigger instant Voice Emergency SOS.
 */

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
}

let isListening = false;
let keywordMatches: { word: string; timestamp: number }[] = [];
let triggerCallback: ((data: { keyword: string; count: number }) => void) | null = null;
let stateChangeListeners: ((state: VoiceDetectionState) => void)[] = [];

export const onVoiceStateChange = (listener: (state: VoiceDetectionState) => void) => {
  stateChangeListeners.push(listener);
  return () => {
    stateChangeListeners = stateChangeListeners.filter((l) => l !== listener);
  };
};

const notifyState = () => {
  const state: VoiceDetectionState = {
    isListening,
    matchCount: keywordMatches.length,
    recentMatches: keywordMatches.map((m) => m.word),
    lastMatchTime: keywordMatches.length > 0 ? keywordMatches[keywordMatches.length - 1].timestamp : null,
  };
  stateChangeListeners.forEach((l) => l(state));
};

/**
 * Process incoming voice transcript text
 * Checks if transcript contains any emergency keywords and triggers when 3 matches are reached within 15 seconds.
 */
export const processVoiceTranscript = (transcript: string): boolean => {
  if (!isListening || !transcript) return false;

  const normalized = transcript.toLowerCase().trim();
  const now = Date.now();

  // Prune matches older than 15 seconds (rolling detection window)
  keywordMatches = keywordMatches.filter((m) => now - m.timestamp < 15000);

  // Check which keyword matched
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      keywordMatches.push({ word: keyword, timestamp: now });
      console.log(`[VoiceDetection] 🗣️ Emergency keyword detected: "${keyword}" (Count: ${keywordMatches.length}/3)`);

      notifyState();

      if (keywordMatches.length >= 3) {
        console.log(`[VoiceDetection] 🚨 3 emergency keywords detected! Triggering Voice SOS.`);
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
 * Directly record an emergency keyword match (e.g. from speech recognizer or quick voice test)
 */
export const recordVoiceKeyword = (keyword: string) => {
  return processVoiceTranscript(keyword);
};

/**
 * Start Voice Detection Loop
 */
export const startVoiceDetection = (onTrigger: (data: { keyword: string; count: number }) => void) => {
  triggerCallback = onTrigger;
  isListening = true;
  keywordMatches = [];

  console.log('[VoiceDetection] Voice monitoring active. Keywords:', EMERGENCY_KEYWORDS.join(', '));
  notifyState();

  return stopVoiceDetection;
};

/**
 * Stop Voice Detection
 */
export const stopVoiceDetection = () => {
  isListening = false;
  keywordMatches = [];
  console.log('[VoiceDetection] Voice monitoring stopped.');
  notifyState();
};

export const getVoiceDetectionState = (): VoiceDetectionState => ({
  isListening,
  matchCount: keywordMatches.length,
  recentMatches: keywordMatches.map((m) => m.word),
  lastMatchTime: keywordMatches.length > 0 ? keywordMatches[keywordMatches.length - 1].timestamp : null,
});
