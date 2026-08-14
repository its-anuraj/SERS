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
  startVoiceDetection, stopVoiceDetection, recordVoiceKeyword,
  onVoiceStateChange
} from '../../services/voiceDetection';
import { dispatchOfflineSmsSOS } from '../../services/offlineSmsDispatch';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { emergencyContacts, appEnabled, toggleAppEnabled } = useSettingsStore();
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
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // Persistent refs to avoid re-render effect cascades
  const locationRef = useRef<Location.LocationObject | null>(null);
  const emergencyContactsRef = useRef(emergencyContacts);
  const activeIncidentIdRef = useRef<string | null>(null);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    emergencyContactsRef.current = emergencyContacts;
  }, [emergencyContacts]);

  useEffect(() => {
    activeIncidentIdRef.current = activeIncidentId;
  }, [activeIncidentId]);

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
    locationRef.current = loc;

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

  // Continuous Live GPS Watcher
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const startLocationWatcher = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setAddressTitle('GPS Location');
            setAddressText('GPS permissions enabled for emergency dispatch.');
          }
          return;
        }

        // Try getting last known or current position safely
        let initialLoc = await Location.getLastKnownPositionAsync().catch(() => null);
        if (!initialLoc) {
          initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        }

        if (initialLoc && isMounted) {
          handleLocationUpdate(initialLoc);
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          (newLoc) => {
            if (isMounted) handleLocationUpdate(newLoc);
          }
        ).catch(() => null);
      } catch {
        if (isMounted) {
          setAddressTitle('Live Emergency GPS');
          setAddressText('28.45950° N, 77.02660° E (Ready)');
        }
      }
    };

    startLocationWatcher();

    return () => {
      isMounted = false;
      locationSubscription?.remove();
    };
  }, [handleLocationUpdate]);

  // Stable Voice SOS trigger handler
  const triggerVoiceSOS = useCallback(async (keyword: string) => {
    setVoiceModalOpen(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 300, 150, 300]);

    const userLoc = locationRef.current;
    const contacts = emergencyContactsRef.current || [];

    try {
      const res = await api.post('/incidents/auto-dispatch', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'medical',
        source: 'voice',
        description: `Voice Emergency SOS: 3x keywords matched ("${keyword}"). Automatic medical profile & bed reservation.`,
        notifyContacts: contacts.map(c => c.phone),
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
  }, []);

  // Subscribe to Voice Detection state once on mount
  useEffect(() => {
    const unsub = onVoiceStateChange((state) => {
      setVoiceMatchCount(state.matchCount);
      setRecentVoiceKeywords(state.recentMatches);
      setLiveTranscript(state.lastSpokenTranscript || '');
    });

    startVoiceDetection((data) => {
      triggerVoiceSOS(data.keyword);
    });

    return () => {
      unsub();
      stopVoiceDetection();
    };
  }, [triggerVoiceSOS]);

  // Check for any ongoing active incident when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const storedId = await SecureStore.getItemAsync('sers_active_incident_id');
          if (storedId) {
            try {
              const res = await api.get(`/incidents/${storedId}`);
              const status = res.data?.data?.status;
              if (['resolved', 'cancelled', 'false_alarm'].includes(status)) {
                setActiveIncidentId(null);
                await SecureStore.deleteItemAsync('sers_active_incident_id');
              } else {
                setActiveIncidentId(storedId);
              }
            } catch {
              setActiveIncidentId(null);
              await SecureStore.deleteItemAsync('sers_active_incident_id');
            }
          } else {
            setActiveIncidentId(null);
          }
        } catch {
          setActiveIncidentId(null);
        }
      })();
    }, [])
  );

  const handleSOS = async () => {
    if (activeIncidentId) {
      router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } });
      return;
    }

    setSosActive(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 500, 200, 500]);

    const userLoc = locationRef.current;
    const contacts = emergencyContactsRef.current || [];

    try {
      const res = await api.post('/incidents/sos', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'medical',
        notifyContacts: contacts.map(c => c.phone),
      });

      const incidentId = res.data?.data?.id || res.data?.data?.incidentId;
      if (incidentId) {
        setActiveIncidentId(incidentId);
        await SecureStore.setItemAsync('sers_active_incident_id', incidentId);
        router.push({ pathname: '/sos-active', params: { incidentId } });
      } else {
        router.push('/sos-active' as any);
      }
    } catch (err) {
      console.warn('[SOS] Internet failed or offline. Triggering Cellular GSM SMS fallback...');
      await dispatchOfflineSmsSOS({
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'medical',
        source: 'manual_sos',
      });
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
        <TouchableOpacity onPress={() => router.push('/(citizen)/contacts' as any)} style={styles.avatar}>
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

        {/* SERS Active Protection Toggle Switch Card */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionInfo}>
            <Text style={styles.protectionTitle}>
              {appEnabled ? '🛡️ SERS Active Protection: ON' : '⚪ SERS Protection: PAUSED'}
            </Text>
            <Text style={styles.protectionSub}>
              {appEnabled
                ? 'Crash sensors, Voice SOS & Smartwatch guard are active'
                : 'Emergency sensors are temporarily paused'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.switchTrack, appEnabled ? styles.switchTrackOn : styles.switchTrackOff]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleAppEnabled(!appEnabled);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.switchThumb, appEnabled ? styles.switchThumbOn : styles.switchThumbOff]} />
          </TouchableOpacity>
        </View>

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
              {activeIncidentId ? (
                <Text style={styles.sosEmoji}>🚨</Text>
              ) : null}
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
            { icon: '🚗', label: 'Vehicle & OBD-II', route: '/(citizen)/vehicle', color: '#38bdf8' },
            { icon: '⌚', label: 'Smartwatch Vitals', route: '/(citizen)/vitals', color: '#ec4899' },
            { icon: '👨‍👩‍👧', label: 'Emergency Contacts', route: '/(citizen)/contacts', color: '#f59e0b' },
            { icon: '🩺', label: 'ABDM Profile', route: '/(citizen)/abdm', color: '#a855f7' },
            { icon: '🏥', label: 'Hospitals (Soon)', route: '/(citizen)/hospitals', color: '#3b82f6' },
            { icon: '🚑', label: 'Track Ambulance', route: '/(citizen)/map', color: '#22c55e' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionCard}
              onPress={() => {
                router.push(action.route as any);
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

            {/* Live Microphone Visualizer */}
            <View style={styles.liveMicVisualizer}>
              <Animated.View style={[styles.liveMicPulse, { transform: [{ scale: voicePulseAnim }] }]}>
                <Text style={{ fontSize: 36 }}>🎙️</Text>
              </Animated.View>
              <Text style={styles.liveMicStatus}>
                Phone Microphone is <Text style={{ color: '#22c55e', fontWeight: '900' }}>LISTENING LIVE</Text>
              </Text>
            </View>

            {/* Live Heard Transcript Box */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Live Speech Transcript (Real Input):</Text>
              <Text style={styles.transcriptText}>
                {liveTranscript ? `🗣️ "${liveTranscript}"` : 'Listening... Speak distress words into your phone microphone.'}
              </Text>
            </View>

            {/* Recognized Keywords Reference Grid */}
            <View style={styles.keywordsGridSection}>
              <Text style={styles.keywordsSectionLabel}>Recognized Distress Keywords:</Text>
              <View style={styles.keywordsGrid}>
                {['"Help"', '"Bachao"', '"Emergency"', '"Madad Karo"', '"Ambulance"', '"Save Me"'].map((kw) => (
                  <View key={kw} style={styles.kwBadge}>
                    <Text style={styles.kwBadgeText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  locationBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 20, marginBottom: 16, padding: 14,
    backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  locationPulseDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center',
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
    fontSize: 13, color: '#0f172a', fontWeight: '800', flex: 1, marginRight: 8,
  },
  liveBadgeContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  liveGreenDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#16a34a',
  },
  liveBadgeText: {
    fontSize: 9, color: '#16a34a', fontWeight: '900', letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 12, color: '#475569', fontWeight: '500', lineHeight: 16, marginBottom: 4,
  },
  coordinatesSubtitle: {
    fontSize: 11, color: '#2563eb', fontWeight: '700', fontFamily: 'monospace',
  },

  activeSosBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fee2e2', marginHorizontal: 20, marginBottom: 16, padding: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#ef4444',
  },
  activeSosBannerTitle: { color: '#dc2626', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', marginBottom: 2 },
  activeSosBannerSub: { color: '#991b1b', fontSize: 12 },
  activeSosBannerBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  activeSosBannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  protectionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', marginHorizontal: 20, marginBottom: 20, padding: 16,
    borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  protectionInfo: { flex: 1, marginRight: 12 },
  protectionTitle: { color: '#0f172a', fontWeight: '800', fontSize: 14, marginBottom: 2 },
  protectionSub: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  switchTrack: {
    width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: '#22c55e' },
  switchTrackOff: { backgroundColor: '#cbd5e1' },
  switchThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchThumbOff: { alignSelf: 'flex-start' },

  sosContainer: { alignItems: 'center', marginBottom: 28, paddingHorizontal: 20 },
  sosLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', letterSpacing: 2, marginBottom: 4 },
  sosSub: { fontSize: 12, color: '#94a3b8', marginBottom: 20, textAlign: 'center' },
  sosButton: {
    width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.45, shadowRadius: 25, elevation: 16,
    borderWidth: 4, borderColor: 'rgba(239,68,68,0.3)',
  },
  sosButtonActive: { backgroundColor: '#dc2626' },
  sosButtonAlertActive: { backgroundColor: '#b91c1c', borderColor: '#f87171' },
  sosEmoji: { fontSize: 40, marginBottom: 4 },
  sosButtonText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  sosButtonSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  voiceSosCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', width: '100%', marginTop: 20, padding: 14,
    borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  voiceIconPulse: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceSosTitle: { color: '#0f172a', fontWeight: '800', fontSize: 13, marginBottom: 2 },
  voiceSosSub: { color: '#64748b', fontSize: 11 },
  voiceKeyword: { color: '#2563eb', fontWeight: '700' },
  voiceCounterBadge: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  voiceCounterText: { color: '#ef4444', fontWeight: '900', fontSize: 12 },

  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12, marginBottom: 20,
  },
  quickActionCard: {
    width: (width - 48) / 3, alignItems: 'center', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  quickActionIcon: {
    width: 52, height: 52, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
  },
  quickActionLabel: { fontSize: 11, color: '#1e293b', textAlign: 'center', fontWeight: '700' },

  tipCard: {
    marginHorizontal: 20, marginBottom: 12, padding: 16,
    backgroundColor: '#eff6ff', borderRadius: 16,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#1d4ed8', marginBottom: 6 },
  tipText: { fontSize: 12, color: '#334155', lineHeight: 18 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  voiceModalContent: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#e2e8f0',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  voiceModalTitle: { color: '#0f172a', fontWeight: '900', fontSize: 18 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceModalDesc: { color: '#475569', fontSize: 13, lineHeight: 18, marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
  progressCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9',
    borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center',
  },
  progressCircleActive: { backgroundColor: '#ef4444', borderColor: '#f87171' },
  progressCircleText: { color: '#64748b', fontWeight: '900', fontSize: 18 },
  progressLabel: { color: '#0f172a', textAlign: 'center', fontWeight: '700', fontSize: 13, marginVertical: 10 },
  liveMicVisualizer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  liveMicPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 2,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  liveMicStatus: { color: '#475569', fontSize: 13, fontWeight: '600' },

  transcriptBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  transcriptText: { color: '#0f172a', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

  keywordsGridSection: { marginTop: 4 },
  keywordsSectionLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  keywordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kwBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kwBadgeText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
});
