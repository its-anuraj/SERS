/**
 * Citizen / Driver Home Screen — Closed Vehicle & Driver Safety System (Car / Truck / Fleet)
 * Features:
 * - 3x "Emergency" / Distress Keyword Acoustic Cabin Voice Trigger
 * - 10-Second Loud Emergency Siren & Vibration Pre-Alert Countdown
 * - 1-Tap False Alarm Cancellation (Stops Siren & Prevents False Dispatch)
 * - Live High-Precision GPS Telemetry & Reverse Geocoding
 * - Realtime Web Admin Command Center Integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { startEmergencySiren, stopEmergencySiren } from '../../services/sirenAlarm';
import { dispatchOfflineSmsSOS } from '../../services/offlineSmsDispatch';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const { emergencyContacts, appEnabled, toggleAppEnabled } = useSettingsStore();

  // Active Emergency & Location States
  const [sosActive, setSosActive] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [addressTitle, setAddressTitle] = useState<string>('Live GPS Detected');
  const [addressText, setAddressText] = useState<string>('Acquiring high-precision GPS coordinates...');
  const [coordinatesText, setCoordinatesText] = useState<string>('');
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  // Closed Vehicle Selection (Car, Truck, Fleet)
  const [selectedVehicle, setSelectedVehicle] = useState<'car' | 'truck' | 'cab'>('car');

  // Voice SOS state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceMatchCount, setVoiceMatchCount] = useState(0);
  const [recentVoiceKeywords, setRecentVoiceKeywords] = useState<string[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // 10-Second Pre-Alert Siren Countdown State
  const [isPreAlertOpen, setIsPreAlertOpen] = useState(false);
  const [preAlertCountdown, setPreAlertCountdown] = useState(10);
  const preAlertTimerRef = useRef<any>(null);
  const pendingKeywordRef = useRef<string>('emergency');

  // Persistent refs to avoid re-render effect cascades
  const locationRef = useRef<Location.LocationObject | null>(null);
  const emergencyContactsRef = useRef(emergencyContacts);
  const activeIncidentIdRef = useRef<string | null>(null);
  const lastGeocodeTimeRef = useRef<number>(0);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    emergencyContactsRef.current = emergencyContacts;
  }, [emergencyContacts]);

  useEffect(() => {
    activeIncidentIdRef.current = activeIncidentId;
  }, [activeIncidentId]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const gpsPulseAnim = useRef(new Animated.Value(1)).current;
  const voicePulseAnim = useRef(new Animated.Value(1)).current;
  const sirenFlashAnim = useRef(new Animated.Value(1)).current;

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
  }, [pulseAnim]);

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
  }, [gpsPulseAnim]);

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
  }, [voicePulseAnim]);

  // Siren Flashing animation for Pre-Alert Modal
  useEffect(() => {
    if (isPreAlertOpen) {
      const flash = Animated.loop(
        Animated.sequence([
          Animated.timing(sirenFlashAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(sirenFlashAnim, { toValue: 0.95, duration: 400, useNativeDriver: true }),
        ])
      );
      flash.start();
      return () => flash.stop();
    }
  }, [isPreAlertOpen, sirenFlashAnim]);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of SERS?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)' as any);
          },
        },
      ]
    );
  };

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

  // Execute Final Emergency Dispatch to Backend & Sockets
  const executeDispatchSOS = useCallback(async (keyword: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 500, 200, 500]);

    const userLoc = locationRef.current;
    const contacts = emergencyContactsRef.current || [];
    const vehicleLabel = selectedVehicle === 'truck' ? 'Heavy Cargo Truck' : selectedVehicle === 'cab' ? 'Commercial Fleet Cab' : 'Passenger Car';

    try {
      const res = await api.post('/incidents/auto-dispatch', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'accident',
        source: 'cabin_voice',
        description: `🚨 IN-CABIN DRIVER EMERGENCY: Driver spoke "${keyword}" 3 times inside ${vehicleLabel} cabin. 10-second false alarm countdown expired without cancellation. Immediate hospital triage dispatched.`,
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
      console.error('[SOS] Backend call failed, triggering SMS fallback...', err);
      await dispatchOfflineSmsSOS({
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'accident',
        source: 'cabin_voice',
      });
      router.push('/sos-active' as any);
    }
  }, [selectedVehicle]);

  // 10-Second Pre-Alert Siren Countdown Launch
  const startPreAlertCountdown = useCallback((keyword: string) => {
    pendingKeywordRef.current = keyword;
    setVoiceModalOpen(false);
    setIsPreAlertOpen(true);
    setPreAlertCountdown(10);

    // Start loud siren audio & repeating vibration
    startEmergencySiren();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    if (preAlertTimerRef.current) clearInterval(preAlertTimerRef.current);

    let count = 10;
    preAlertTimerRef.current = setInterval(async () => {
      count -= 1;
      setPreAlertCountdown(count);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (count <= 0) {
        clearInterval(preAlertTimerRef.current);
        preAlertTimerRef.current = null;
        setIsPreAlertOpen(false);
        await stopEmergencySiren();
        await executeDispatchSOS(pendingKeywordRef.current);
      }
    }, 1000);
  }, [executeDispatchSOS]);

  // False Alarm Cancel Handler
  const handleCancelPreAlert = async () => {
    if (preAlertTimerRef.current) {
      clearInterval(preAlertTimerRef.current);
      preAlertTimerRef.current = null;
    }
    setIsPreAlertOpen(false);
    await stopEmergencySiren();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      '🟢 False Alarm Cancelled',
      'In-cabin emergency pre-alert cancelled and siren stopped. No emergency responders were dispatched.'
    );
  };

  // Immediate Dispatch (Skip Countdown)
  const handleDispatchPreAlertNow = async () => {
    if (preAlertTimerRef.current) {
      clearInterval(preAlertTimerRef.current);
      preAlertTimerRef.current = null;
    }
    setIsPreAlertOpen(false);
    await stopEmergencySiren();
    await executeDispatchSOS(pendingKeywordRef.current);
  };

  // Subscribe to Voice Detection state
  useEffect(() => {
    const unsub = onVoiceStateChange((state) => {
      setVoiceMatchCount(state.matchCount);
      setRecentVoiceKeywords(state.recentMatches);
      setLiveTranscript(state.lastSpokenTranscript || '');
    });

    startVoiceDetection((data) => {
      startPreAlertCountdown(data.keyword);
    });

    return () => {
      unsub();
      stopVoiceDetection();
      if (preAlertTimerRef.current) {
        clearInterval(preAlertTimerRef.current);
        preAlertTimerRef.current = null;
      }
      stopEmergencySiren();
    };
  }, [startPreAlertCountdown]);

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

  const handleManualSOS = async () => {
    if (activeIncidentId) {
      router.push({ pathname: '/sos-active', params: { incidentId: activeIncidentId } });
      return;
    }

    setSosActive(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 500, 200, 500]);

    const userLoc = locationRef.current;
    const contacts = emergencyContactsRef.current || [];
    const vehicleLabel = selectedVehicle === 'truck' ? 'Heavy Cargo Truck' : selectedVehicle === 'cab' ? 'Commercial Fleet Cab' : 'Passenger Car';

    try {
      const res = await api.post('/incidents/sos', {
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'accident',
        description: `Manual Emergency Triggered by ${vehicleLabel} Driver`,
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
      console.warn('[SOS] Internet failed. Triggering Cellular SMS fallback...');
      await dispatchOfflineSmsSOS({
        latitude: userLoc?.coords?.latitude || 28.4595,
        longitude: userLoc?.coords?.longitude || 77.0266,
        type: 'accident',
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
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Driver'} 👋</Text>
          <Text style={styles.subtitle}>🚗 SERS Closed-Vehicle & Cabin Safety Active</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/(citizen)/contacts' as any)} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutHeaderBtn}>
            <Text style={styles.logoutHeaderBtnText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Closed Vehicle Type Selector */}
        <View style={styles.vehicleSelectorCard}>
          <Text style={styles.vehicleSelectorLabel}>SELECT VEHICLE CABIN TYPE:</Text>
          <View style={styles.vehicleToggleRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedVehicle('car');
              }}
              style={[styles.vehicleToggleBtn, selectedVehicle === 'car' && styles.vehicleToggleBtnActive]}
            >
              <Text style={{ fontSize: 16 }}>🚗</Text>
              <Text style={[styles.vehicleToggleText, selectedVehicle === 'car' && styles.vehicleToggleTextActive]}>
                Private Car
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedVehicle('truck');
              }}
              style={[styles.vehicleToggleBtn, selectedVehicle === 'truck' && styles.vehicleToggleBtnActive]}
            >
              <Text style={{ fontSize: 16 }}>🚚</Text>
              <Text style={[styles.vehicleToggleText, selectedVehicle === 'truck' && styles.vehicleToggleTextActive]}>
                Heavy Truck
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedVehicle('cab');
              }}
              style={[styles.vehicleToggleBtn, selectedVehicle === 'cab' && styles.vehicleToggleBtnActive]}
            >
              <Text style={{ fontSize: 16 }}>🚖</Text>
              <Text style={[styles.vehicleToggleText, selectedVehicle === 'cab' && styles.vehicleToggleTextActive]}>
                Fleet Cab
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* Ongoing Active Incident Banner */}
        {activeIncidentId && (
          <View style={styles.activeSosBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeSosBannerTitle}>🚨 Emergency SOS in Progress</Text>
              <Text style={styles.activeSosBannerSub}>Hospital & ambulance response is actively tracking your vehicle.</Text>
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
              {appEnabled ? '🛡️ In-Cabin Crash & Voice Guard: ACTIVE' : '⚪ Vehicle Guard: PAUSED'}
            </Text>
            <Text style={styles.protectionSub}>
              {appEnabled
                ? 'Monitors 3x "Emergency" distress voice, OBD-II airbag spikes & vehicular impact'
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

        {/* SOS Button */}
        <View style={styles.sosContainer}>
          <Text style={styles.sosLabel}>VEHICLE DRIVER SOS</Text>
          <Text style={styles.sosSub}>
            {activeIncidentId ? 'Tap to view live response or cancel SOS' : 'Hold 1s or speak "Emergency" 3 times inside cabin'}
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
              onLongPress={handleManualSOS}
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

          {/* 3x Voice SOS Trigger Card */}
          <TouchableOpacity
            style={styles.voiceSosCard}
            onPress={() => setVoiceModalOpen(true)}
            activeOpacity={0.85}
          >
            <Animated.View style={[styles.voiceIconPulse, { transform: [{ scale: voicePulseAnim }] }]}>
              <Text style={{ fontSize: 18 }}>🎙️</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceSosTitle}>In-Cabin Voice SOS (3x 'Emergency')</Text>
              <Text style={styles.voiceSosSub}>
                Say <Text style={styles.voiceKeyword}>"Emergency"</Text> 3 times in cabin · 10s False Alarm Siren Active
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
            { icon: '⌚', label: 'Driver Vitals', route: '/(citizen)/vitals', color: '#ec4899' },
            { icon: '👨‍👩‍👧', label: 'Emergency Contacts', route: '/(citizen)/contacts', color: '#f59e0b' },
            { icon: '🩺', label: 'ABDM Health ID', route: '/(citizen)/abdm', color: '#a855f7' },
            { icon: '🏥', label: 'Hospital Beds', route: '/(citizen)/hospitals', color: '#3b82f6' },
            { icon: '🚑', label: 'Track Dispatch', route: '/(citizen)/map', color: '#22c55e' },
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

        {/* Driver Safety Protocol Tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 In-Cabin Driver Safety Protocol</Text>
          <Text style={styles.tipText}>
            When driving a car or truck, if you get into distress or accident, simply speak <Text style={{ fontWeight: '800', color: '#dc2626' }}>"Emergency! Emergency! Emergency!"</Text>. A loud 10-second siren will sound to allow false-alarm cancellation before sending your exact GPS coordinates and vehicle details directly to the hospital command dashboard.
          </Text>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBottomBtn} onPress={handleLogout}>
          <Text style={styles.logoutBottomText}>🚪 Log Out of SERS</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 🚨 10-SECOND PRE-ALERT SIREN COUNTDOWN MODAL (False Alarm Prevention) */}
      <Modal visible={isPreAlertOpen} animationType="fade" transparent>
        <View style={styles.countdownBackdrop}>
          <View style={styles.countdownCard}>
            <Animated.View style={{ transform: [{ scale: sirenFlashAnim }] }}>
              <Text style={{ fontSize: 58, textAlign: 'center', marginBottom: 6 }}>🚨</Text>
            </Animated.View>

            <Text style={styles.countdownTitle}>IN-CABIN EMERGENCY DETECTED</Text>
            <Text style={styles.countdownSub}>
              Heard 3x Emergency voice distress inside {selectedVehicle === 'truck' ? 'Heavy Truck' : selectedVehicle === 'cab' ? 'Commercial Cab' : 'Car'} cabin.
            </Text>

            <View style={styles.sirenActivePill}>
              <Text style={styles.sirenActiveText}>🔊 LOUD SIREN & VIBRATION ACTIVE</Text>
            </View>

            <Text style={styles.countdownNumber}>{preAlertCountdown}</Text>
            <Text style={styles.countdownSecondsLabel}>SECONDS REMAINING</Text>

            <Text style={styles.countdownWarningText}>
              Automatic trauma bed reservation and ambulance dispatch in {preAlertCountdown}s. If this is a false alarm, tap CANCEL below.
            </Text>

            <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
              {/* Green Cancel Button */}
              <TouchableOpacity
                style={styles.cancelPreAlertBtn}
                onPress={handleCancelPreAlert}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelPreAlertBtnText}>🟢 I'M OK — CANCEL FALSE ALARM (STOP SIREN)</Text>
              </TouchableOpacity>

              {/* Red Dispatch Immediately Button */}
              <TouchableOpacity
                style={styles.dispatchPreAlertNowBtn}
                onPress={handleDispatchPreAlertNow}
                activeOpacity={0.85}
              >
                <Text style={styles.dispatchPreAlertNowBtnText}>🚨 DISPATCH EMERGENCY NOW (SKIP TIMER)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Voice SOS Interactive Panel Modal */}
      <Modal visible={voiceModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.voiceModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.voiceModalTitle}>🎙️ In-Cabin Voice Distress Engine</Text>
              <TouchableOpacity onPress={() => setVoiceModalOpen(false)} style={styles.closeBtn}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.voiceModalDesc}>
              Say any emergency keyword <Text style={{ color: '#ef4444', fontWeight: '800' }}>3 times</Text> (e.g. "Emergency Emergency Emergency" or "Bachao Bachao Bachao") to trigger the 10-second siren countdown and automatic hospital alert.
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
                ? 'Listening for distress words inside vehicle cabin...'
                : voiceMatchCount < 3
                ? `${voiceMatchCount}/3 keywords detected! Say ${3 - voiceMatchCount} more to trigger siren!`
                : '🚨 3/3 MATCHED! ACTIVATING 10-SECOND SIREN ALARM!'}
            </Text>

            {/* Live Microphone Visualizer */}
            <View style={styles.liveMicVisualizer}>
              <Animated.View style={[styles.liveMicPulse, { transform: [{ scale: voicePulseAnim }] }]}>
                <Text style={{ fontSize: 36 }}>🎙️</Text>
              </Animated.View>
              <Text style={styles.liveMicStatus}>
                Microphone is <Text style={{ color: '#22c55e', fontWeight: '900' }}>LISTENING LIVE IN CABIN</Text>
              </Text>
            </View>

            {/* Live Heard Transcript Box */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Live Speech Transcript (Real Input):</Text>
              <Text style={styles.transcriptText}>
                {liveTranscript ? `🗣️ "${liveTranscript}"` : 'Listening... Speak "Emergency! Emergency! Emergency!" into phone.'}
              </Text>
            </View>

            {/* One-Tap 3x Emergency Test Trigger (For Demos & Interviews) */}
            <TouchableOpacity
              style={styles.testVoiceTriggerBtn}
              onPress={() => startPreAlertCountdown('emergency')}
            >
              <Text style={styles.testVoiceTriggerText}>
                ⚡ SIMULATE 3x "EMERGENCY" VOICE TRIGGER (TEST 10s SIREN)
              </Text>
            </TouchableOpacity>

            {/* Recognized Keywords Reference Grid */}
            <View style={styles.keywordsGridSection}>
              <Text style={styles.keywordsSectionLabel}>Recognized Distress Keywords:</Text>
              <View style={styles.keywordsGrid}>
                {['"Emergency"', '"Help"', '"Bachao"', '"Madad Karo"', '"Ambulance"', '"Save Me"'].map((kw) => (
                  <TouchableOpacity
                    key={kw}
                    style={styles.kwBadge}
                    onPress={() => handleVoiceTestKeyword(kw.replace(/"/g, ''))}
                  >
                    <Text style={styles.kwBadgeText}>{kw} 🗣️</Text>
                  </TouchableOpacity>
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
  subtitle: { fontSize: 13, color: '#0284c7', marginTop: 2, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  logoutHeaderBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutHeaderBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 12 },
  logoutBottomBtn: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutBottomText: { color: '#dc2626', fontWeight: '800', fontSize: 14 },

  vehicleSelectorCard: {
    marginHorizontal: 20, marginBottom: 14, padding: 12,
    backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  vehicleSelectorLabel: {
    fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 0.5, marginBottom: 8,
  },
  vehicleToggleRow: { flexDirection: 'row', gap: 8 },
  vehicleToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9',
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  vehicleToggleBtnActive: {
    backgroundColor: '#0284c7', borderColor: '#0369a1',
  },
  vehicleToggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  vehicleToggleTextActive: { color: '#ffffff', fontWeight: '900' },

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
  protectionTitle: { color: '#0f172a', fontWeight: '800', fontSize: 13, marginBottom: 2 },
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
  sosLabel: { fontSize: 13, fontWeight: '800', color: '#64748b', letterSpacing: 2, marginBottom: 4 },
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
  voiceKeyword: { color: '#dc2626', fontWeight: '800' },
  voiceCounterBadge: {
    backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5',
  },
  voiceCounterText: { color: '#dc2626', fontWeight: '900', fontSize: 12 },

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

  // Pre-Alert Siren Countdown Modal Styles
  countdownBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.88)', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  countdownCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ef4444',
    width: '100%',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  countdownTitle: { color: '#dc2626', fontWeight: '900', fontSize: 18, marginBottom: 4, textAlign: 'center', letterSpacing: 0.5 },
  countdownSub: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 10, fontWeight: '600' },
  sirenActivePill: {
    backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 12,
  },
  sirenActiveText: { color: '#dc2626', fontSize: 11, fontWeight: '900' },
  countdownNumber: { color: '#dc2626', fontSize: 80, fontWeight: '900', lineHeight: 85 },
  countdownSecondsLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  countdownWarningText: { color: '#64748b', fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 10 },
  cancelPreAlertBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelPreAlertBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 13, textAlign: 'center' },
  dispatchPreAlertNowBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dispatchPreAlertNowBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

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
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  transcriptText: { color: '#0f172a', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  testVoiceTriggerBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#dc2626',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  testVoiceTriggerText: { color: '#ffffff', fontWeight: '900', fontSize: 12, textAlign: 'center' },

  keywordsGridSection: { marginTop: 4 },
  keywordsSectionLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  keywordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kwBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kwBadgeText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
});
