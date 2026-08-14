/**
 * Citizen Home Screen — Giant SOS Button + Live GPS Location + Voice SOS Recognition + Active Emergency Tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Vibration, Alert, Modal
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  startVoiceDetection, stopVoiceDetection, processVoiceTranscript,
  recordVoiceKeyword, onVoiceStateChange, EMERGENCY_KEYWORDS
} from '../../services/voiceDetection';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { emergencyContacts } = useSettingsStore();
  const [sosActive, setSosActive] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [addressTitle, setAddressTitle] = useState<string>('Live GPS Detected');
  const [addressText, setAddressText] = useState<string>('Acquiring high-precision GPS coordinates...');
  const [coordinatesText, setCoordinatesText] = useState<string>('');
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  // Voice SOS state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceMatchCount, setVoiceMatchCount] = useState(0);
  const [recentVoiceKeywords, setRecentVoiceKeywords] = useState<string[]>([]);

  const pulseAnim = useState(new Animated.Value(1))[0];
  const gpsPulseAnim = useRef(new Animated.Value(1)).current;
  const voicePulseAnim = useRef(new Animated.Value(1)).current;
  const lastGeocodeTimeRef = useRef<number>(0);

  // SOS button pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // GPS indicator pulse
  useEffect(() => {
    const gpsPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(gpsPulseAnim, { toValue: 1.25, duration: 1000, useNativeDriver: true }),
        Animated.timing(gpsPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    gpsPulse.start();
    return () => gpsPulse.stop();
  }, []);

  // Voice wave animation
  useEffect(() => {
    const voiceWave = Animated.loop(
      Animated.sequence([
        Animated.timing(voicePulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(voicePulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    voiceWave.start();
    return () => voiceWave.stop();
  }, []);

  // Update location and reverse geocode readable address
  const handleLocationUpdate = useCallback(async (loc: Location.LocationObject) => {
    setLocation(loc);
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    const coordsStr = `${lat >= 0 ? lat.toFixed(5) + '° N' : Math.abs(lat).toFixed(5) + '° S'}, ${lng >= 0 ? lng.toFixed(5) + '° E' : Math.abs(lng).toFixed(5) + '° W'}`;
    setCoordinatesText(coordsStr);

    if (loc.coords.accuracy) {
      setAccuracyMeters(Math.round(loc.coords.accuracy));
    }

    const now = Date.now();
    if (now - lastGeocodeTimeRef.current > 5000 || !lastGeocodeTimeRef.current) {
      lastGeocodeTimeRef.current = now;
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocoded && geocoded.length > 0) {
          const place = geocoded[0];
          const areaParts = [place.name, place.street].filter(Boolean);
          const cityParts = [place.district || place.subregion, place.city, place.region].filter(Boolean);

          const mainTitle = place.name || place.street || place.district || 'Current Location';
          const fullAddress = [...areaParts, ...cityParts].filter((v, i, a) => a.indexOf(v) === i).join(', ');

          setAddressTitle(mainTitle);
          setAddressText(fullAddress || coordsStr);
        } else {
          setAddressTitle('Live GPS Pinpoint');
          setAddressText(coordsStr);
        }
      } catch {
        setAddressTitle('Live GPS Coordinates');
        setAddressText(coordsStr);
      }
    }
  }, []);

  // Continuous Live GPS Watcher (tracks user movement in real-time)
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationWatcher = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setAddressTitle('Location Permission Needed');
          setAddressText('Please enable GPS permission in settings to allow automatic emergency response.');
          return;
        }

        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        handleLocationUpdate(initialLoc);

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000,
            distanceInterval: 3,
          },
          (newLoc) => {
            handleLocationUpdate(newLoc);
          }
        );
      } catch (err) {
        console.warn('GPS Watcher initialization error:', err);
      }
    };

    startLocationWatcher();

    return () => {
      locationSubscription?.remove();
    };
  }, [handleLocationUpdate]);

  // Voice SOS Keyword trigger handler
  const triggerVoiceSOS = useCallback(async (keyword: string) => {
    setVoiceModalOpen(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 300, 150, 300]);

    let userLoc = location;
    if (!userLoc) {
      try {
        userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        userLoc = {
          coords: { latitude: 28.4595, longitude: 77.0266, altitude: null, accuracy: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: Date.now(),
        } as any;
      }
    }

    try {
      // Auto-dispatch with medical profile & hospital bed matching
      const res = await api.post('/incidents/auto-dispatch', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'medical',
        source: 'voice',
        description: `Voice Emergency SOS: 3x keywords matched ("${keyword}"). Automatic medical profile & bed reservation.`,
        notifyContacts: emergencyContacts.map(c => c.phone),
      });

      const incidentId = res.data?.data?.incidentId || res.data?.data?.id;
      if (incidentId) {
        setActiveIncidentId(incidentId);
        await SecureStore.setItemAsync('sers_active_incident_id', incidentId);
        router.push({ pathname: '/sos-active', params: { incidentId } });
      } else {
        router.push('/sos-active' as any);
      }
    } catch (err) {
      console.error('Voice SOS auto-dispatch error', err);
      router.push('/sos-active' as any);
    }
  }, [location, emergencyContacts]);

  // Subscribe to Voice Detection state
  useEffect(() => {
    const unsub = onVoiceStateChange((state) => {
      setVoiceMatchCount(state.matchCount);
      setRecentVoiceKeywords(state.recentMatches);
    });

    const stopVoice = startVoiceDetection((data) => {
      triggerVoiceSOS(data.keyword);
    });

    return () => {
      unsub();
      stopVoice();
    };
  }, [triggerVoiceSOS]);

  // Check for any ongoing active incident when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const storedId = await SecureStore.getItemAsync('sers_active_incident_id');
          if (storedId) {
            setActiveIncidentId(storedId);
          }
          const res = await api.get('/incidents?limit=5');
          const active = (res.data?.data || []).find((i: any) =>
            !['resolved', 'cancelled', 'false_alarm'].includes(i.status)
          );
          if (active) {
            setActiveIncidentId(active.id);
            await SecureStore.setItemAsync('sers_active_incident_id', active.id);
          } else {
            setActiveIncidentId(null);
            await SecureStore.deleteItemAsync('sers_active_incident_id');
          }
        } catch {}
      })();
    }, [])
  );

  const handleSOS = async () => {
    if (activeIncidentId) {
      router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } });
      return;
    }

    if (sosActive) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 200, 100, 200]);

    setSosActive(true);

    let userLoc = location;
    if (!userLoc) {
      try {
        userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(userLoc);
      } catch {
        userLoc = {
          coords: { latitude: 28.4595, longitude: 77.0266, altitude: null, accuracy: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: Date.now(),
        } as any;
      }
    }

    try {
      const res = await api.post('/incidents/sos', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'accident',
        description: 'SOS triggered from citizen app',
        notifyContacts: emergencyContacts.map(c => c.phone),
      });

      const incidentId = res.data?.data?.incidentId || res.data?.data?.id;
      if (incidentId) {
        setActiveIncidentId(incidentId);
        await SecureStore.setItemAsync('sers_active_incident_id', incidentId);
        router.push({ pathname: '/sos-active', params: { incidentId } });
      } else {
        router.push('/sos-active' as any);
      }
    } catch {
      router.push('/sos-active' as any);
    } finally {
      setSosActive(false);
    }
  };

  const handleVoiceTestKeyword = (word: string) => {
    recordVoiceKeyword(word);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Arjun'} 👋</Text>
          <Text style={styles.subtitle}>Stay safe. Help is always nearby.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(citizen)/settings' as any)} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'A'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Live GPS Location card with readable area + coordinates */}
        <View style={styles.locationBar}>
          <Animated.View style={[styles.locationPulseDot, { transform: [{ scale: gpsPulseAnim }] }]}>
            <View style={styles.locationDotInner} />
          </Animated.View>

          <View style={{ flex: 1 }}>
            <View style={styles.locationHeaderRow}>
              <Text style={styles.locationTitle} numberOfLines={1}>{addressTitle}</Text>
              <View style={styles.liveBadgeContainer}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveBadgeText}>
                  LIVE GPS {accuracyMeters ? `(±${accuracyMeters}m)` : ''}
                </Text>
              </View>
            </View>

            <Text style={styles.locationText} numberOfLines={2}>
              {addressText}
            </Text>

            {coordinatesText ? (
              <Text style={styles.coordinatesSubtitle}>
                📍 Coords: {coordinatesText}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Ongoing Active Incident Banner (shows if user backed out of active SOS) */}
        {activeIncidentId && (
          <View style={styles.activeSosBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeSosBannerTitle}>🚨 Emergency SOS in Progress</Text>
              <Text style={styles.activeSosBannerSub}>Ambulance response is actively tracking you.</Text>
            </View>
            <TouchableOpacity
              style={styles.activeSosBannerBtn}
              onPress={() => router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } })}
            >
              <Text style={styles.activeSosBannerBtnText}>View / Cancel SOS →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SOS Button — the hero element */}
        <View style={styles.sosContainer}>
          <Text style={styles.sosLabel}>EMERGENCY SOS</Text>
          <Text style={styles.sosSub}>
            {activeIncidentId ? 'Tap to view live response or cancel SOS' : 'Hold for 1 second to trigger'}
          </Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              id="sos-main-button"
              style={[
                styles.sosButton,
                sosActive && styles.sosButtonActive,
                activeIncidentId && styles.sosButtonAlertActive
              ]}
              onPress={activeIncidentId ? () => router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } }) : undefined}
              onLongPress={handleSOS}
              delayLongPress={800}
              activeOpacity={0.85}>
              <Text style={styles.sosEmoji}>{activeIncidentId ? '🚨' : (sosActive ? '📡' : '🆘')}</Text>
              <Text style={styles.sosButtonText}>
                {activeIncidentId ? 'ACTIVE' : (sosActive ? 'SENDING...' : 'SOS')}
              </Text>
              <Text style={styles.sosButtonSub}>
                {activeIncidentId ? 'Tap to Cancel' : 'Hold 1 second'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Voice SOS Trigger Card */}
          <TouchableOpacity
            style={styles.voiceSosCard}
            onPress={() => setVoiceModalOpen(true)}
            activeOpacity={0.85}
          >
            <Animated.View style={[styles.voiceIconPulse, { transform: [{ scale: voicePulseAnim }] }]}>
              <Text style={{ fontSize: 18 }}>🎙️</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceSosTitle}>Voice SOS Active (3x Keywords)</Text>
              <Text style={styles.voiceSosSub}>
                Say <Text style={styles.voiceKeyword}>"Help"</Text>, <Text style={styles.voiceKeyword}>"Bachao"</Text>, or <Text style={styles.voiceKeyword}>"Emergency"</Text> 3 times
              </Text>
            </View>
            <View style={styles.voiceCounterBadge}>
              <Text style={styles.voiceCounterText}>{voiceMatchCount}/3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {[
            { icon: '🏥', label: 'Find Hospital', route: '/(citizen)/hospitals', color: '#3b82f6' },
            { icon: '🚑', label: 'Track Ambulance', route: '/(citizen)/map', color: '#22c55e' },
            { icon: '👤', label: 'Medical Profile', route: '/(citizen)/settings', color: '#a855f7' },
            { icon: '👨‍👩‍👧', label: 'Emergency Contacts', route: '/(citizen)/settings', color: '#f59e0b' },
            { icon: '🗺️', label: 'Live Map', route: '/(citizen)/map', color: '#06b6d4' },
            { icon: '📋', label: 'Settings', route: '/(citizen)/settings', color: '#ec4899' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionCard}
              onPress={() => {
                if (['/(citizen)/map', '/(citizen)/hospitals', '/(citizen)/settings'].includes(action.route)) {
                  router.push(action.route as any);
                } else {
                  Alert.alert('Settings', 'Opening citizen settings.');
                  router.push('/(citizen)/settings' as any);
                }
              }}>
              <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}20`, borderColor: `${action.color}40` }]}>
                <Text style={{ fontSize: 24 }}>{action.icon}</Text>
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Safety Tip</Text>
          <Text style={styles.tipText}>
            Voice SOS listens continuously for emergency distress words. Saying emergency keywords 3 times will instantly alert nearest hospitals and dispatch ambulances with your medical history.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Voice SOS Interactive Panel Modal */}
      <Modal visible={voiceModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.voiceModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.voiceModalTitle}>🎙️ Voice SOS Emergency Engine</Text>
              <TouchableOpacity onPress={() => setVoiceModalOpen(false)} style={styles.closeBtn}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.voiceModalDesc}>
              Say any emergency keyword <Text style={{ color: '#ef4444', fontWeight: '800' }}>3 times</Text> (e.g. "Help Help Help", "Bachao Bachao Bachao", or "Emergency, Madad Karo, Help") to trigger instant automatic hospital dispatch with your medical record & allergies.
            </Text>

            {/* Keyword Progress Circles */}
            <View style={styles.progressRow}>
              {[1, 2, 3].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.progressCircle,
                    voiceMatchCount >= step && styles.progressCircleActive
                  ]}
                >
                  <Text style={styles.progressCircleText}>
                    {voiceMatchCount >= step ? '✓' : step}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.progressLabel}>
              {voiceMatchCount === 0
                ? 'Listening for emergency keywords...'
                : voiceMatchCount < 3
                ? `${voiceMatchCount}/3 keywords detected! Say ${3 - voiceMatchCount} more to dispatch!`
                : '🚨 3/3 MATCHED! DISPATCHING EMERGENCY SOS!'}
            </Text>

            {/* Recent matches tags */}
            {recentVoiceKeywords.length > 0 && (
              <View style={styles.tagsContainer}>
                {recentVoiceKeywords.map((w, idx) => (
                  <View key={idx} style={styles.keywordTag}>
                    <Text style={styles.keywordTagText}>🗣️ "{w}"</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Test Voice Keyword Buttons */}
            <Text style={styles.testKeywordsLabel}>Tap to Test Voice Keywords:</Text>
            <View style={styles.testButtonsGrid}>
              {['Help!', 'Bachao!', 'Emergency!', 'Madad Karo!'].map((btnText) => (
                <TouchableOpacity
                  key={btnText}
                  style={styles.testBtn}
                  onPress={() => handleVoiceTestKeyword(btnText.replace('!', '').toLowerCase())}
                >
                  <Text style={styles.testBtnText}>🗣️ "{btnText}"</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.emergencyDirectDispatchBtn}
              onPress={() => triggerVoiceSOS('manual_voice_test')}
            >
              <Text style={styles.emergencyDirectDispatchText}>⚡ Direct Voice SOS Dispatch Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  locationBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 20, marginBottom: 16, padding: 14,
    backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    shadowColor: '#3b82f6', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  locationPulseDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  locationDotInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  locationHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  locationTitle: {
    fontSize: 13, color: '#f1f5f9', fontWeight: '800', flex: 1, marginRight: 8,
  },
  liveBadgeContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  liveGreenDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22c55e',
  },
  liveBadgeText: {
    fontSize: 9, color: '#4ade80', fontWeight: '900', letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 12, color: '#94a3b8', fontWeight: '500', lineHeight: 16, marginBottom: 4,
  },
  coordinatesSubtitle: {
    fontSize: 11, color: '#60a5fa', fontWeight: '700', fontFamily: 'monospace',
  },

  activeSosBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#3b0707', marginHorizontal: 20, marginBottom: 16, padding: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#ef4444',
  },
  activeSosBannerTitle: { color: '#ef4444', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', marginBottom: 2 },
  activeSosBannerSub: { color: '#fca5a5', fontSize: 12 },
  activeSosBannerBtn: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  activeSosBannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  sosContainer: { alignItems: 'center', marginBottom: 28, paddingHorizontal: 20 },
  sosLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', letterSpacing: 2, marginBottom: 4 },
  sosSub: { fontSize: 12, color: '#475569', marginBottom: 20, textAlign: 'center' },
  sosButton: {
    width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 30, elevation: 20,
    borderWidth: 4, borderColor: 'rgba(239,68,68,0.4)',
  },
  sosButtonActive: { backgroundColor: '#dc2626' },
  sosButtonAlertActive: { backgroundColor: '#b91c1c', borderColor: '#f87171' },
  sosEmoji: { fontSize: 40, marginBottom: 4 },
  sosButtonText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  sosButtonSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  voiceSosCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111827', width: '100%', marginTop: 20, padding: 14,
    borderRadius: 16, borderWidth: 1, borderColor: '#1e293b',
  },
  voiceIconPulse: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceSosTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 13, marginBottom: 2 },
  voiceSosSub: { color: '#94a3b8', fontSize: 11 },
  voiceKeyword: { color: '#3b82f6', fontWeight: '700' },
  voiceCounterBadge: {
    backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#334155',
  },
  voiceCounterText: { color: '#f87171', fontWeight: '900', fontSize: 12 },

  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12, marginBottom: 20,
  },
  quickActionCard: {
    width: (width - 48) / 3, alignItems: 'center', gap: 8,
    backgroundColor: '#111827', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  quickActionIcon: {
    width: 52, height: 52, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
  },
  quickActionLabel: { fontSize: 11, color: '#94a3b8', textAlign: 'center', fontWeight: '600' },

  tipCard: {
    marginHorizontal: 20, marginBottom: 12, padding: 16,
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#3b82f6', marginBottom: 6 },
  tipText: { fontSize: 12, color: '#64748b', lineHeight: 18 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end',
  },
  voiceModalContent: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  voiceModalTitle: { color: '#f1f5f9', fontWeight: '900', fontSize: 18 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceModalDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
  progressCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b',
    borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  progressCircleActive: { backgroundColor: '#ef4444', borderColor: '#f87171' },
  progressCircleText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  progressLabel: { color: '#f1f5f9', textAlign: 'center', fontWeight: '700', fontSize: 13, marginBottom: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  keywordTag: {
    backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: '#ef4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  keywordTagText: { color: '#fca5a5', fontWeight: '700', fontSize: 12 },
  testKeywordsLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  testButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  testBtn: {
    flex: 1, minWidth: '45%', backgroundColor: '#1e293b', padding: 12,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  testBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  emergencyDirectDispatchBtn: {
    backgroundColor: '#dc2626', padding: 16, borderRadius: 14, alignItems: 'center',
  },
  emergencyDirectDispatchText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
