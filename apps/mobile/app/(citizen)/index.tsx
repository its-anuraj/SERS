/**
 * Citizen Home Screen — Giant SOS Button + Continuous Live GPS Location & Active Emergency Tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Vibration, Alert
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

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

  const pulseAnim = useState(new Animated.Value(1))[0];
  const gpsPulseAnim = useRef(new Animated.Value(1)).current;
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

    // Throttle reverse geocoding to once every 5 seconds to prevent rate limits
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

        // Get immediate initial position
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        handleLocationUpdate(initialLoc);

        // Start continuous live tracking subscription
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000,   // Updates every 3 seconds
            distanceInterval: 3,  // Or every 3 meters moved
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
    // If an incident is already in progress, take user back to tracking & cancellation screen
    if (activeIncidentId) {
      router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } });
      return;
    }

    if (sosActive) {
      return;
    }

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

          <Text style={styles.sosNote}>
            Or say <Text style={styles.voiceKeyword}>"Help"</Text> or{' '}
            <Text style={styles.voiceKeyword}>"Emergency"</Text> (Voice SOS)
          </Text>
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
            Enable <Text style={styles.tipHighlight}>Auto Crash Detection</Text> in settings.
            SERS will automatically detect accidents and call for help — even if you're unconscious.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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

  sosContainer: { alignItems: 'center', marginBottom: 32, paddingHorizontal: 20 },
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
  sosNote: { color: '#64748b', fontSize: 13, marginTop: 24, textAlign: 'center' },
  voiceKeyword: { color: '#3b82f6', fontWeight: '800' },

  masterSwitchContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111827', marginHorizontal: 20, marginTop: 4, marginBottom: 16,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b'
  },
  masterSwitchTitle: { color: '#f1f5f9', fontWeight: '700', fontSize: 16 },
  masterSwitchSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

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
  tipHighlight: { color: '#f1f5f9', fontWeight: '600' },
});
