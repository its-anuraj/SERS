/**
 * Citizen Home Screen — Giant SOS Button + Live Location & Active Emergency Tracking
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Vibration, Alert, Switch
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
  const { appEnabled, toggleAppEnabled, emergencyContacts } = useSettingsStore();
  const [sosActive, setSosActive] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [addressText, setAddressText] = useState<string>('Detecting your GPS location...');
  const pulseAnim = useState(new Animated.Value(1))[0];

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

  // Fetch location & readable address on mount
  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);

        try {
          const geocoded = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocoded && geocoded.length > 0) {
            const place = geocoded[0];
            const parts = [place.name, place.street, place.district || place.subregion, place.city].filter(Boolean);
            setAddressText(parts.join(', ') || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          } else {
            setAddressText(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          }
        } catch {
          setAddressText(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
        }
      } else {
        setAddressText('Location permission not granted');
      }
    } catch {
      setAddressText('GPS tracking active');
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

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

    if (sosActive || !appEnabled) {
      if (!appEnabled) Alert.alert('App Disabled', 'Please enable SERS in Settings to use SOS.');
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
        {/* Location bar */}
        <View style={styles.locationBar}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationTitle}>Your Live Emergency Location</Text>
            <Text style={styles.locationText} numberOfLines={1}>{addressText}</Text>
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

        {/* Master Switch */}
        <View style={styles.masterSwitchContainer}>
          <View>
            <Text style={styles.masterSwitchTitle}>SERS Protection</Text>
            <Text style={styles.masterSwitchSub}>{appEnabled ? 'Sensors Active' : 'Sensors Disabled'}</Text>
          </View>
          <Switch
            value={appEnabled}
            onValueChange={toggleAppEnabled}
            trackColor={{ false: '#334155', true: '#ef4444' }}
            thumbColor="#fff"
          />
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 16, padding: 14,
    backgroundColor: '#1a2235', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  locationIcon: { fontSize: 18 },
  locationTitle: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationText: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },

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
