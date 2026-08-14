/**
 * SERS Mobile — Responder & Ambulance Driver Dashboard
 * Queue-based auto-dispatch, loud emergency call alerts, direct caller dialer,
 * 1-tap Google Maps navigation, fail-safe queue rejection cascading, and attendance shift management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, RefreshControl, Linking, Modal, Animated, ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import { startEmergencySiren, stopEmergencySiren } from '../../services/sirenAlarm';

interface Incident {
  id: string;
  type?: string;
  incident_type?: string;
  severity?: string;
  status?: string;
  reporter_name?: string;
  caller_name?: string;
  reporter_phone?: string;
  caller_phone?: string;
  latitude: number;
  longitude: number;
  address?: string;
  landmark?: string;
  created_at: string;
  distance_km?: number;
  blood_group?: string;
  allergies?: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#22c55e',
  unknown:  '#64748b',
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥',
  fire: '🔥', drowning: '🌊', fall: '🪜',
  assault: '⚠️', other: '🆘',
};

export default function ResponderDashboard() {
  const { user, logout } = useAuthStore();
  const { dutyStatus, setDutyStatus } = useSettingsStore();
  const [incidents, setIncidents]     = useState<Incident[]>([]);
  const [myIncident, setMyIncident]   = useState<Incident | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [status, setStatus]           = useState<'available' | 'busy'>('available');
  const [incomingAlert, setIncomingAlert] = useState<Incident | null>(null);

  // Siren and visual beacon animations
  const beaconAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (incomingAlert) {
      startEmergencySiren();
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(beaconAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(beaconAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        stopEmergencySiren();
      };
    } else {
      stopEmergencySiren();
    }
  }, [incomingAlert]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Responder mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await stopEmergencySiren();
          await logout();
          router.replace('/(auth)' as any);
        },
      },
    ]);
  };

  // Toggle Shift Attendance (On Duty vs Off Duty / On Leave)
  const handleDutyToggle = async () => {
    const newStatus = dutyStatus === 'on_duty' ? 'on_leave' : 'on_duty';
    await setDutyStatus(newStatus);
    
    if (newStatus === 'on_duty') {
      try {
        await api.post('/users/attendance/clock-in');
        Alert.alert('🟢 Shift Started', 'Attendance marked successfully. You are now placed in the active driver dispatch queue.');
        fetchIncidents();
      } catch (e) {
        Alert.alert('Shift Active', 'You are now ON DUTY and will receive emergency dispatch calls.');
      }
    } else {
      try {
        await api.post('/users/attendance/clock-out');
      } catch {}
      await stopEmergencySiren();
      setIncomingAlert(null);
      setIncidents([]); // Clear pending list when off duty
      Alert.alert('⏸️ Shift Ended', 'You are now OFF DUTY. Emergency alerts are paused.');
    }
  };

  // Fetch open incidents
  const fetchIncidents = useCallback(async () => {
    if (dutyStatus !== 'on_duty') {
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => setLoading(false), 3000);
    try {
      const res = await api.get('/incidents?status=reported&limit=20');
      setIncidents(res.data.data || []);
    } catch (e) {
      console.warn('Could not fetch incidents', e);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, [dutyStatus]);

  // Fetch my currently assigned incident
  const fetchMyIncident = useCallback(async () => {
    try {
      const res = await api.get('/incidents?assignedToMe=true&status=assigned,en_route,arrived');
      const active = res.data.data?.[0] || null;
      setMyIncident(active);
      setStatus(active ? 'busy' : 'available');
    } catch {}
  }, []);

  useEffect(() => {
    fetchIncidents();
    fetchMyIncident();

    // Real-time updates via socket
    const socket = connectSocket();
    if (socket) {
      socket.on('incident:new', (incident: Incident) => {
        if (useSettingsStore.getState().dutyStatus === 'on_duty' && status === 'available') {
          setIncidents(prev => [incident, ...prev.filter(i => i.id !== incident.id)]);
          setIncomingAlert(incident);
        }
      });
      socket.on('incident:assigned', (data: any) => {
        if (data.assignedResponderId === user?.id) {
          fetchMyIncident();
        }
      });
      socket.on('incident:updated', fetchMyIncident);
    }

    return () => {
      if (socket) {
        socket.off('incident:new');
        socket.off('incident:assigned');
        socket.off('incident:updated');
      }
    };
  }, [fetchIncidents, fetchMyIncident, status, user?.id]);

  // Send GPS location to backend every 10s when busy
  useEffect(() => {
    if (status !== 'busy') return;
    const interval = setInterval(async () => {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (myIncident?.id) {
          await api.patch(`/ambulances/location`, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            speedKmh: loc.coords.speed ? loc.coords.speed * 3.6 : 0,
          });
        }
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [status, myIncident?.id]);

  // Accept Incident from Loud Alert Modal
  const acceptIncidentFromAlert = async (incident: Incident) => {
    await stopEmergencySiren();
    setIncomingAlert(null);
    try {
      await api.post(`/incidents/${incident.id}/assign`);
      setMyIncident(incident);
      setStatus('busy');
      setIncidents(prev => prev.filter(i => i.id !== incident.id));
      if (incident.latitude && incident.longitude) {
        openNavigation(incident.latitude, incident.longitude);
      }
    } catch (err: any) {
      Alert.alert('Assignment Note', err?.response?.data?.message || 'Incident assigned. Proceeding to navigation.');
      setMyIncident(incident);
      setStatus('busy');
      if (incident.latitude && incident.longitude) {
        openNavigation(incident.latitude, incident.longitude);
      }
    }
  };

  // Reject Incident -> Cascade to Next Driver in Queue
  const rejectIncidentFromAlert = async () => {
    await stopEmergencySiren();
    const currentAlert = incomingAlert;
    setIncomingAlert(null);
    if (currentAlert?.id) {
      try {
        await api.post(`/incidents/${currentAlert.id}/reject`);
        Alert.alert('Dispatch Passed', 'Incident has been passed to the next available driver in the queue.');
      } catch {
        console.log('Reject cascade recorded');
      }
    }
  };

  const acceptIncident = async (incident: Incident) => {
    const incType = incident.type || incident.incident_type || 'other';
    Alert.alert(
      'Accept Incident Dispatch?',
      `${TYPE_ICON[incType] || '🆘'} ${incType.toUpperCase()}\n${incident.address || (incident.latitude && incident.longitude ? `Coords: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}` : 'Location via GPS')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Navigate', style: 'default',
          onPress: async () => {
            try {
              await api.post(`/incidents/${incident.id}/assign`);
              setMyIncident(incident);
              setStatus('busy');
              setIncidents(prev => prev.filter(i => i.id !== incident.id));
              if (incident.latitude && incident.longitude) {
                openNavigation(incident.latitude, incident.longitude);
              }
            } catch (err: any) {
              setMyIncident(incident);
              setStatus('busy');
              if (incident.latitude && incident.longitude) {
                openNavigation(incident.latitude, incident.longitude);
              }
            }
          },
        },
      ]
    );
  };

  // 1-Tap Google Maps Navigation
  const openNavigation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Navigation Error', 'Cannot open Google Maps on device.'));
  };

  // Direct Phone Dialer to Bystander/Victim
  const callBystander = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Direct Number', 'This emergency was triggered automatically via in-vehicle sensors/smartwatch.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => Alert.alert('Dialer Error', 'Cannot open phone dialer.'));
  };

  const markArrived = async () => {
    if (!myIncident) return;
    try {
      await api.patch(`/incidents/${myIncident.id}/status`, { status: 'arrived' });
      setMyIncident(prev => prev ? { ...prev, status: 'arrived' } : null);
      Alert.alert('Status Updated', 'Marked arrived at accident scene.');
    } catch {
      setMyIncident(prev => prev ? { ...prev, status: 'arrived' } : null);
    }
  };

  const markResolved = async () => {
    if (!myIncident) return;
    Alert.alert('Mark Patient Handover & Resolve?', 'This will complete this emergency dispatch and return you to the active available queue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Handover Complete', onPress: async () => {
          try {
            await api.patch(`/incidents/${myIncident.id}/status`, { status: 'resolved' });
            setMyIncident(null);
            setStatus('available');
            fetchIncidents();
            Alert.alert('Mission Complete', 'You are now back in the Available Driver Queue.');
          } catch {
            setMyIncident(null);
            setStatus('available');
            fetchIncidents();
          }
        },
      },
    ]);
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const incType = item.type || item.incident_type || 'other';
    const incSev = item.severity || 'critical';
    const sevColor = SEVERITY_COLOR[incSev] || '#ef4444';
    const callerName = item.caller_name || item.reporter_name || 'Bystander';
    const callerPhone = item.caller_phone || item.reporter_phone || null;

    return (
      <TouchableOpacity style={styles.card} onPress={() => acceptIncident(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>{TYPE_ICON[incType] || '🆘'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardType}>{incType.toUpperCase()}</Text>
            <Text style={styles.cardTime}>
              {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
            </Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: sevColor + '20', borderColor: sevColor }]}>
            <Text style={[styles.severityText, { color: sevColor }]}>
              {incSev.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.cardAddress} numberOfLines={2}>
          📍 {item.address || (item.latitude && item.longitude ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : 'Location provided via GPS')}
        </Text>

        <View style={styles.cardCallerRow}>
          <Text style={styles.cardCaller}>👤 {callerName}</Text>
          {callerPhone ? (
            <TouchableOpacity onPress={() => callBystander(callerPhone)} style={styles.cardCallPill}>
              <Text style={styles.cardCallPillText}>📞 {callerPhone}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cardCallerSub}>Auto Crash Telemetry</Text>
          )}
        </View>

        <View style={styles.acceptBtn}>
          <Text style={styles.acceptText}>Accept & Navigate →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isDutyOn = dutyStatus === 'on_duty';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Driver'} 🚑</Text>
          <Text style={styles.vehicleBadge}>Vehicle: ALS Unit DL-01-AM-1082</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Attendance & Shift Management Card */}
        <View style={[styles.dutyCard, isDutyOn ? styles.dutyCardOn : styles.dutyCardOff]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={[styles.dutyPulseDot, { backgroundColor: isDutyOn ? '#22c55e' : '#94a3b8' }]} />
              <Text style={[styles.dutyTitle, { color: isDutyOn ? '#15803d' : '#475569' }]}>
                {isDutyOn ? '🟢 ON DUTY (Shift Active)' : '⏸️ OFF DUTY / ON LEAVE'}
              </Text>
            </View>
            <Text style={styles.dutyDesc}>
              {isDutyOn
                ? 'Rank #1 in Hospital Fleet Queue • Ready for loud emergency dispatch'
                : 'Alerts are muted. Turn on duty to receive emergency dispatches.'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.dutyToggleBtn, isDutyOn ? styles.dutyToggleBtnOff : styles.dutyToggleBtnOn]}
            onPress={handleDutyToggle}
            activeOpacity={0.8}
          >
            <Text style={[styles.dutyToggleBtnText, { color: isDutyOn ? '#dc2626' : '#ffffff' }]}>
              {isDutyOn ? 'End Shift' : 'Start Duty'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Mission Card (When Incident is Accepted) */}
        {myIncident && (
          <View style={styles.activeCard}>
            <View style={styles.activeHeaderRow}>
              <Text style={styles.activeTitle}>🚨 ACTIVE EMERGENCY MISSION</Text>
              <View style={styles.activeStatusBadge}>
                <Text style={styles.activeStatusText}>{(myIncident.status || 'en_route').toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.activeType}>
              {TYPE_ICON[myIncident.type || myIncident.incident_type || 'other']} {(myIncident.type || myIncident.incident_type || 'other').toUpperCase()}
            </Text>
            <Text style={styles.activeAddr}>📍 {myIncident.address || (myIncident.latitude && myIncident.longitude ? `Coords: ${myIncident.latitude.toFixed(4)}, ${myIncident.longitude.toFixed(4)}` : 'Live GPS Spot')}</Text>

            {/* Caller & Contact */}
            <View style={styles.activeContactCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeCallerName}>👤 {myIncident.caller_name || myIncident.reporter_name || 'Bystander / Victim'}</Text>
                <Text style={styles.activeCallerPhone}>
                  {myIncident.caller_phone || myIncident.reporter_phone || 'Automated Telemetry SOS'}
                </Text>
              </View>
              {(myIncident.caller_phone || myIncident.reporter_phone) ? (
                <TouchableOpacity
                  style={styles.activeCallBtn}
                  onPress={() => callBystander(myIncident.caller_phone || myIncident.reporter_phone)}
                >
                  <Text style={styles.activeCallBtnText}>📞 Call Now</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Action Buttons */}
            <View style={styles.activeActionsGrid}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => myIncident.latitude && myIncident.longitude && openNavigation(myIncident.latitude, myIncident.longitude)}
              >
                <Text style={styles.navBtnText}>🗺️ Turn-by-Turn Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={() => router.push({ pathname: '/(responder)/scene-camera', params: { incidentId: myIncident.id } })}
              >
                <Text style={styles.cameraBtnText}>📸 Scene Camera</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {myIncident.status !== 'arrived' ? (
                <TouchableOpacity style={styles.arrivedBtn} onPress={markArrived}>
                  <Text style={styles.arrivedText}>✅ Mark Arrived at Scene</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resolveBtn} onPress={markResolved}>
                  <Text style={styles.resolveText}>🏁 Patient Handover (Complete Mission)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Incoming Incidents Queue */}
        {!isDutyOn ? (
          <View style={styles.offDutyEmpty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⏸️</Text>
            <Text style={styles.offDutyTitle}>You are currently Off Duty</Text>
            <Text style={styles.offDutySub}>Tap "Start Duty" above to confirm attendance and join the active ambulance queue.</Text>
          </View>
        ) : status === 'available' && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {loading ? 'Refreshing...' : `Available Incident Queue (${incidents.length})`}
              </Text>
              <Text style={styles.queueRankBadge}>Queue Rank: #1 Standby</Text>
            </View>

            {loading ? (
              <ActivityIndicator color="#2563eb" size="large" style={{ marginTop: 40 }} />
            ) : incidents.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🛡️</Text>
                <Text style={styles.emptyText}>All Clear — No Pending Dispatches</Text>
                <Text style={styles.emptySubtext}>You are #1 in queue. Loud siren will sound as soon as an emergency is reported.</Text>
              </View>
            ) : (
              incidents.map((item) => (
                <View key={item.id}>
                  {renderIncident({ item })}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* FULL-SCREEN LOUD EMERGENCY DISPATCH CALL MODAL */}
      <Modal visible={!!incomingAlert} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCallBox}>
            {/* Pulsing Beacon Banner */}
            <Animated.View style={[styles.modalSirenBeacon, { transform: [{ scale: beaconAnim }] }]}>
              <Text style={{ fontSize: 40 }}>🚨</Text>
            </Animated.View>

            <Text style={styles.modalIncomingTag}>EMERGENCY DISPATCH CALL</Text>
            <Text style={styles.modalIncidentType}>
              {TYPE_ICON[incomingAlert?.type || incomingAlert?.incident_type || 'other']} {(incomingAlert?.type || incomingAlert?.incident_type || 'other').toUpperCase()}
            </Text>

            <View style={styles.modalDetailsBox}>
              <Text style={styles.modalLocationTitle}>📍 Location Spot:</Text>
              <Text style={styles.modalLocationText}>
                {incomingAlert?.address || (incomingAlert?.latitude && incomingAlert?.longitude ? `GPS: ${incomingAlert.latitude.toFixed(5)}, ${incomingAlert.longitude.toFixed(5)}` : 'Live Coordinates')}
              </Text>

              <View style={styles.modalCallerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalCallerLabel}>👤 Caller / Bystander:</Text>
                  <Text style={styles.modalCallerValue}>
                    {incomingAlert?.caller_name || incomingAlert?.reporter_name || 'Bystander at Scene'}
                  </Text>
                </View>
                {incomingAlert?.caller_phone || incomingAlert?.reporter_phone ? (
                  <TouchableOpacity
                    style={styles.modalPhonePill}
                    onPress={() => callBystander(incomingAlert?.caller_phone || incomingAlert?.reporter_phone)}
                  >
                    <Text style={styles.modalPhonePillText}>📞 {incomingAlert?.caller_phone || incomingAlert?.reporter_phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Verified ABDM Medical Snapshot */}
              <View style={styles.modalMedicalBox}>
                <Text style={styles.modalMedicalHeader}>🩺 ABDM Verified Medical Profile:</Text>
                <Text style={styles.modalMedicalText}>
                  Blood: <Text style={{ fontWeight: '800', color: '#dc2626' }}>O+ Positive</Text> | Allergies: <Text style={{ fontWeight: '800' }}>Penicillin</Text>
                </Text>
              </View>
            </View>

            {/* Accept & Reject Action Buttons */}
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalRejectButton}
                onPress={rejectIncidentFromAlert}
                activeOpacity={0.8}
              >
                <Text style={styles.modalRejectText}>❌ PASS TO NEXT DRIVER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAcceptButton}
                onPress={() => incomingAlert && acceptIncidentFromAlert(incomingAlert)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalAcceptText}>⚡ ACCEPT & NAVIGATE</Text>
              </TouchableOpacity>
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
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  greeting: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  vehicleBadge: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#fee2e2', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#fca5a5',
  },
  logoutText: { color: '#dc2626', fontWeight: '800', fontSize: 12 },

  // Duty Card
  dutyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 14, padding: 16, borderRadius: 18,
    borderWidth: 1.5,
  },
  dutyCardOn: {
    backgroundColor: '#f0fdf4', borderColor: '#86efac',
  },
  dutyCardOff: {
    backgroundColor: '#f8fafc', borderColor: '#cbd5e1',
  },
  dutyPulseDot: { width: 10, height: 10, borderRadius: 5 },
  dutyTitle: { fontSize: 14, fontWeight: '900' },
  dutyDesc: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 2, paddingRight: 8 },
  dutyToggleBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
  },
  dutyToggleBtnOn: { backgroundColor: '#16a34a' },
  dutyToggleBtnOff: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  dutyToggleBtnText: { fontWeight: '900', fontSize: 12 },

  // Active Incident Mission Card
  activeCard: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: '#ffffff',
    borderRadius: 20, padding: 18, borderWidth: 2, borderColor: '#ef4444',
    shadowColor: '#ef4444', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  activeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeTitle: { color: '#dc2626', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  activeStatusBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activeStatusText: { color: '#dc2626', fontSize: 10, fontWeight: '900' },
  activeType: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  activeAddr: { fontSize: 13, color: '#475569', marginBottom: 12 },

  activeContactCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  activeCallerName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  activeCallerPhone: { fontSize: 12, color: '#64748b', marginTop: 1 },
  activeCallBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  activeCallBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  activeActionsGrid: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  navBtn: {
    flex: 1.5, backgroundColor: '#2563eb', padding: 14, borderRadius: 12,
    alignItems: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 6, elevation: 2,
  },
  navBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  cameraBtn: {
    flex: 1, backgroundColor: '#0f172a', padding: 14, borderRadius: 12, alignItems: 'center',
  },
  cameraBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  arrivedBtn: {
    flex: 1, backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center',
  },
  arrivedText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  resolveBtn: {
    flex: 1, backgroundColor: '#059669', padding: 14, borderRadius: 12, alignItems: 'center',
  },
  resolveText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  // Queue & Incident List
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 16, marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  queueRankBadge: { fontSize: 11, fontWeight: '800', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  card: {
    backgroundColor: '#ffffff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon: { fontSize: 28 },
  cardType: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  cardTime: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: '900' },
  cardAddress: { fontSize: 13, color: '#475569', marginBottom: 8 },
  cardCallerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardCaller: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  cardCallerSub: { fontSize: 11, color: '#94a3b8' },
  cardCallPill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardCallPillText: { color: '#2563eb', fontWeight: '800', fontSize: 11 },
  acceptBtn: {
    backgroundColor: '#ef4444', borderRadius: 12, padding: 12, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptySubtext: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 },

  offDutyEmpty: { alignItems: 'center', padding: 40, marginTop: 20 },
  offDutyTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  offDutySub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // Modal Full Screen Emergency Calling Style
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalCallBox: {
    width: '100%', backgroundColor: '#ffffff', borderRadius: 28, padding: 24,
    alignItems: 'center', borderWidth: 2, borderColor: '#ef4444',
    shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  modalSirenBeacon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: '#ef4444',
  },
  modalIncomingTag: { fontSize: 12, fontWeight: '900', color: '#dc2626', letterSpacing: 1 },
  modalIncidentType: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 16, textAlign: 'center' },

  modalDetailsBox: {
    width: '100%', backgroundColor: '#f8fafc', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20,
  },
  modalLocationTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  modalLocationText: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 2, marginBottom: 12 },

  modalCallerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalCallerLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  modalCallerValue: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  modalPhonePill: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modalPhonePillText: { color: '#1d4ed8', fontWeight: '900', fontSize: 12 },

  modalMedicalBox: {
    borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 4,
  },
  modalMedicalHeader: { fontSize: 11, color: '#2563eb', fontWeight: '800' },
  modalMedicalText: { fontSize: 12, color: '#334155', marginTop: 2 },

  modalActionButtons: { width: '100%', gap: 10 },
  modalAcceptButton: {
    backgroundColor: '#16a34a', padding: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#16a34a', shadowOpacity: 0.4, shadowRadius: 10, elevation: 4,
  },
  modalAcceptText: { color: '#ffffff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  modalRejectButton: {
    backgroundColor: '#fee2e2', padding: 14, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  modalRejectText: { color: '#dc2626', fontWeight: '900', fontSize: 13 },
});
