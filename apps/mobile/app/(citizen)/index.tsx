/**
 * Citizen Home Screen — Giant SOS Button + Quick Actions
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Vibration, Alert, Switch
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

const { width } = Dimensions.get('window');
export default function HomeScreen() {
  const { user } = useAuthStore();
  const { appEnabled, toggleAppEnabled, emergencyContacts } = useSettingsStore();
  const [sosActive, setSosActive] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [activeIncident, setActiveIncident] = useState<any>(null);
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

  // Get location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc);
      }
    })();
  }, []);

  const handleSOS = async () => {
    if (sosActive || !appEnabled) {
      if (!appEnabled) Alert.alert('App Disabled', 'Please enable SERS in Settings to use SOS.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 200, 100, 200]);

    setSosActive(true);

    // Auto-dial 112 if supported
    Linking.openURL('tel:112').catch(() => console.log('Dialer note: 112 simulation'));

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
      setSosActive(false);
      if (incidentId) {
        router.push({ pathname: '/sos-active', params: { incidentId } });
      } else {
        router.push('/sos-active' as any);
      }
    } catch (error: any) {
      setSosActive(false);
      // Even if network drops, open SOS Active screen to allow user to view/cancel local emergency
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
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Stay safe. Help is always nearby.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(citizen)/settings' as any)} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || '?'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Location bar */}
        <View style={styles.locationBar}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {location
              ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
              : 'Getting your location...'}
          </Text>
        </View>

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
          <Text style={styles.sosSub}>Hold for 1 second to trigger</Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              id="sos-main-button"
              style={[styles.sosButton, sosActive && styles.sosButtonActive]}
              onLongPress={handleSOS}
              delayLongPress={1000}
              activeOpacity={0.85}>
              <Text style={styles.sosEmoji}>{sosActive ? '📡' : '🆘'}</Text>
              <Text style={styles.sosButtonText}>{sosActive ? 'SENDING...' : 'SOS'}</Text>
              <Text style={styles.sosButtonSub}>Hold 1 second</Text>
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
            { icon: '🚑', label: 'Track Ambulance', route: '/track', color: '#22c55e' },
            { icon: '👤', label: 'Medical Profile', route: '/medical-profile', color: '#a855f7' },
            { icon: '👨‍👩‍👧', label: 'Emergency Contacts', route: '/(citizen)/settings', color: '#f59e0b' },
            { icon: '🗺️', label: 'Live Map', route: '/(citizen)/map', color: '#06b6d4' },
            { icon: '📋', label: 'My Incidents', route: '/history', color: '#ec4899' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionCard}
              onPress={() => {
                if (['/(citizen)/map', '/(citizen)/hospitals', '/(citizen)/settings'].includes(action.route)) {
                  router.push(action.route as any);
                } else {
                  Alert.alert('Coming Soon', 'This feature is currently in development.');
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

        {/* Hotspot warning */}
        <View style={styles.hotspotCard}>
          <Text style={styles.hotspotTitle}>⚠️ High Risk Area Nearby</Text>
          <Text style={styles.hotspotText}>
            MG Road junction shows elevated accident risk this evening. Drive carefully.
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 24, padding: 12,
    backgroundColor: '#1a2235', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  locationIcon: { fontSize: 14 },
  locationText: { fontSize: 12, color: '#64748b', flex: 1 },

  sosContainer: { alignItems: 'center', marginBottom: 32, paddingHorizontal: 20 },
  sosLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', letterSpacing: 2, marginBottom: 4 },
  sosSub: { fontSize: 12, color: '#475569', marginBottom: 20 },
  sosButton: {
    width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 30, elevation: 20,
    borderWidth: 4, borderColor: 'rgba(239,68,68,0.4)',
  },
  sosButtonActive: { backgroundColor: '#dc2626' },
  sosEmoji: { fontSize: 40, marginBottom: 4 },
  sosButtonText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  sosButtonSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sosNote: { color: '#64748b', fontSize: 13, marginTop: 24, textAlign: 'center' },
  voiceKeyword: { color: '#3b82f6', fontWeight: '800' },

  masterSwitchContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111827', marginHorizontal: 20, marginTop: 10, marginBottom: 15,
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

  hotspotCard: {
    marginHorizontal: 20, marginBottom: 12, padding: 16,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  hotspotTitle: { fontSize: 13, fontWeight: '700', color: '#f59e0b', marginBottom: 6 },
  hotspotText: { fontSize: 12, color: '#64748b', lineHeight: 18 },
});
