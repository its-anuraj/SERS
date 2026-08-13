// Polyfill Web DOM APIs missing in Native Hermes JS Runtime
if (typeof global !== 'undefined') {
  if (typeof (global as any).DOMRectReadOnly === 'undefined') {
    class DOMRectReadOnlyPolyfill {
      x = 0; y = 0; width = 0; height = 0; top = 0; right = 0; bottom = 0; left = 0;
      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.top = y; this.right = x + width; this.bottom = y + height; this.left = x;
      }
      toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left }; }
      static fromRect(r?: any) { return new DOMRectReadOnlyPolyfill(r?.x, r?.y, r?.width, r?.height); }
    }
    (global as any).DOMRectReadOnly = DOMRectReadOnlyPolyfill;
  }
  if (typeof (global as any).DOMRect === 'undefined') {
    (global as any).DOMRect = (global as any).DOMRectReadOnly;
  }
  if (typeof (global as any).ResizeObserver === 'undefined') {
    (global as any).ResizeObserver = class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

/**
 * SERS Mobile — Root Layout (Expo Router)
 * Handles auth state, crash detection init, and navigation
 */

import { useEffect, useState, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { startCrashDetection } from '../services/crashDetection';
import { connectSocket } from '../services/socket';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const { loadSession, isLoading, isAuthenticated, user } = useAuthStore();
  const [crashWarning, setCrashWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const crashCancelRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Role-based redirect
    if (user.role === 'responder') {
      router.replace('/(responder)');
    } else {
      router.replace('/(citizen)');
    }

    // Start crash detection for all users
    const stopCrash = startCrashDetection((probability) => {
      handleCrashDetected(probability);
    });

    // Connect socket
    connectSocket();

    return () => { stopCrash(); };
  }, [isAuthenticated]);

  const handleCrashDetected = (probability: number) => {
    setCrashWarning(true);
    let count = 10;
    setCountdown(count);

    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        setCrashWarning(false);
        triggerSOSFromCrash();
      }
    }, 1000);

    crashCancelRef.current = timer;
  };

  const cancelCrashSOS = () => {
    if (crashCancelRef.current) clearInterval(crashCancelRef.current);
    setCrashWarning(false);
  };

  const triggerSOSFromCrash = async () => {
    // Navigate to SOS active screen
    router.push('/sos-active?source=crash_detection');
  };

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>🆘 SERS</Text>
        <Text style={styles.splashSub}>Smart Emergency Response</Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0e1a' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/index" options={{ headerShown: false }} />
        <Stack.Screen name="(citizen)/index" options={{ headerShown: false }} />
        <Stack.Screen name="(citizen)/hospitals" options={{ headerShown: false }} />
        <Stack.Screen name="(citizen)/map" options={{ headerShown: false }} />
        <Stack.Screen name="(responder)/index" options={{ headerShown: false }} />
        <Stack.Screen name="(responder)/scene-camera" options={{ headerShown: false }} />
        <Stack.Screen name="sos-active" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      </Stack>

      {/* Crash detection overlay */}
      {crashWarning && (
        <View style={styles.crashOverlay}>
          <View style={styles.crashCard}>
            <Text style={styles.crashEmoji}>🚨</Text>
            <Text style={styles.crashTitle}>Accident Detected</Text>
            <Text style={styles.crashDesc}>
              AI has detected a possible crash. Emergency help will be dispatched in:
            </Text>
            <Text style={styles.crashCountdown}>{countdown}</Text>
            <Text style={styles.crashSub}>seconds</Text>
            <View style={styles.crashButtons}>
              <View
                style={styles.cancelButton}
                onTouchEnd={cancelCrashSOS}>
                <Text style={styles.cancelText}>I'm OK — Cancel</Text>
              </View>
              <View
                style={styles.sendNowButton}
                onTouchEnd={triggerSOSFromCrash}>
                <Text style={styles.sendNowText}>Send Help NOW</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#0a0e1a',
    alignItems: 'center', justifyContent: 'center',
  },
  splashTitle: { fontSize: 48, fontWeight: '900', color: '#ef4444', marginBottom: 8 },
  splashSub: { fontSize: 16, color: '#94a3b8' },

  crashOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  crashCard: {
    backgroundColor: '#1a2235', borderRadius: 24, padding: 32, margin: 20,
    alignItems: 'center', borderWidth: 2, borderColor: '#ef4444',
    shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 20,
  },
  crashEmoji: { fontSize: 56, marginBottom: 16 },
  crashTitle: { fontSize: 24, fontWeight: '900', color: '#ef4444', marginBottom: 8 },
  crashDesc: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  crashCountdown: { fontSize: 80, fontWeight: '900', color: '#ef4444' },
  crashSub: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  crashButtons: { width: '100%', gap: 12 },
  cancelButton: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  cancelText: { color: '#94a3b8', fontWeight: '600', fontSize: 16 },
  sendNowButton: {
    backgroundColor: '#ef4444', borderRadius: 16, padding: 16,
    alignItems: 'center', shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 12,
  },
  sendNowText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
