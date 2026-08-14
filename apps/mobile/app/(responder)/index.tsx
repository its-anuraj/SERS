/**
 * SERS Mobile — Responder Dashboard
 * Ambulance driver sees incoming SOS requests, accepts them, and navigates to victim.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, RefreshControl, Linking, Modal, Vibration
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';

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

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Responder mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)' as any);
        },
      },
    ]);
  };

  const handleDutyToggle = async () => {
    const newStatus = dutyStatus === 'on_duty' ? 'on_leave' : 'on_duty';
    await setDutyStatus(newStatus);
    
    if (newStatus === 'on_duty') {
      try {
        await api.post('/users/attendance/clock-in');
        Alert.alert('On Duty', 'Attendance marked. You will now receive emergency alerts.');
        fetchIncidents();
      } catch (e) {
        console.log('Attendance clock-in failed', e);
      }
    } else {
      setIncidents([]); // Clear list when off duty
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
      const res = await api.get('/incidents?assignedToMe=true&status=assigned,en_route');
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
    socket.on('incident:new', (incident: Incident) => {
      if (useSettingsStore.getState().dutyStatus === 'on_duty' && status === 'available') {
        setIncidents(prev => [incident, ...prev]);
        setIncomingAlert(incident);
        Vibration.vibrate([500, 500, 500, 500], true); // Loop vibrate
      }
    });
    socket.on('incident:updated', fetchMyIncident);

    return () => {
      socket.off('incident:new');
      socket.off('incident:updated');
    };
  }, [fetchIncidents, fetchMyIncident, status]);

  // Send GPS location to backend every 10s when busy
  useEffect(() => {
    if (status !== 'busy') return;
    const interval = setInterval(async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      api.post('/incidents/location-update', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [status]);

  const acceptIncidentFromAlert = async (incident: Incident) => {
    Vibration.cancel();
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
      Alert.alert('Error', err?.response?.data?.message || 'Could not accept incident.');
    }
  };

  const rejectIncidentFromAlert = () => {
    Vibration.cancel();
    setIncomingAlert(null);
  };

  const acceptIncident = async (incident: Incident) => {
    const incType = incident.type || incident.incident_type || 'other';
    Alert.alert(
      'Accept Incident?',
      `${TYPE_ICON[incType] || '🆘'} ${incType.toUpperCase()}\n${incident.address || (incident.latitude && incident.longitude ? `Location: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}` : 'Location provided via GPS')}`,
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
              // Open Google Maps navigation
              if (incident.latitude && incident.longitude) {
                openNavigation(incident.latitude, incident.longitude);
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not accept incident.');
            }
          },
        },
      ]
    );
  };

  const openNavigation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open Google Maps.'));
  };

  const markArrived = async () => {
    if (!myIncident) return;
    try {
      await api.patch(`/incidents/${myIncident.id}/status`, { status: 'arrived' });
      setMyIncident(prev => prev ? { ...prev, status: 'arrived' } : null);
    } catch {}
  };

  const markResolved = async () => {
    if (!myIncident) return;
    Alert.alert('Mark as Resolved?', 'This will close the incident.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve', onPress: async () => {
          try {
            await api.patch(`/incidents/${myIncident.id}/status`, { status: 'resolved' });
            setMyIncident(null);
            setStatus('available');
            fetchIncidents();
          } catch {}
        },
      },
    ]);
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const incType = item.type || item.incident_type || 'other';
    const incSev = item.severity || 'unknown';
    const callerName = item.reporter_name || item.caller_name || 'Citizen';
    const callerPhone = item.reporter_phone || item.caller_phone || 'Emergency Contact';
    const sevColor = SEVERITY_COLOR[incSev] || '#64748b';

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
        <Text style={styles.cardCaller}>👤 {callerName}  📞 {callerPhone}</Text>
        <View style={styles.acceptBtn}>
          <Text style={styles.acceptText}>Accept & Navigate →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Responder'} 🚑</Text>
          <TouchableOpacity onPress={handleDutyToggle} style={[styles.statusDot, { backgroundColor: dutyStatus === 'on_duty' ? (status === 'available' ? '#22c55e' : '#f97316') : '#64748b' }]}>
            <Text style={styles.statusText}>
              {dutyStatus === 'on_leave' ? '⏸️ On Leave (Tap to Start Duty)' : (status === 'available' ? '● Available' : '● Busy')}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Active Incident Banner */}
      {myIncident && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>🚨 Active Incident</Text>
          <Text style={styles.activeType}>
            {TYPE_ICON[myIncident.type || myIncident.incident_type || 'other']} {(myIncident.type || myIncident.incident_type || 'other').toUpperCase()}
          </Text>
          <Text style={styles.activeAddr}>📍 {myIncident.address || 'GPS Location'}</Text>
          <Text style={styles.activeStatus}>Status: {(myIncident.status || 'assigned').replace('_', ' ').toUpperCase()}</Text>
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => myIncident.latitude && myIncident.longitude && openNavigation(myIncident.latitude, myIncident.longitude)}
            >
              <Text style={styles.navBtnText}>🗺️ Navigate</Text>
            </TouchableOpacity>
            {myIncident.status !== 'arrived' && (
              <TouchableOpacity style={styles.arrivedBtn} onPress={markArrived}>
                <Text style={styles.arrivedText}>✅ Arrived</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.resolveBtn} onPress={markResolved}>
              <Text style={styles.resolveText}>🏁 Resolve</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Incoming Incidents */}
      {dutyStatus === 'on_leave' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#64748b', fontSize: 16, fontWeight: '700' }}>You are currently on leave.</Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>Tap the status indicator above to start duty.</Text>
        </View>
      ) : status === 'available' && (
        <>
          <Text style={styles.sectionTitle}>
            {loading ? 'Loading...' : `Incoming Requests (${incidents.length})`}
          </Text>
          {loading ? (
            <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={incidents}
              keyExtractor={i => i.id}
              renderItem={renderIncident}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); fetchIncidents(); }}
                  tintColor="#ef4444"
                />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyText}>No pending incidents</Text>
                  <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Full Screen Alert Modal */}
      <Modal visible={!!incomingAlert} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalWarning}>🚨 DISPATCH ALERT</Text>
            <Text style={styles.modalType}>
              {TYPE_ICON[incomingAlert?.type || incomingAlert?.incident_type || 'other']} {(incomingAlert?.type || incomingAlert?.incident_type || 'other').toUpperCase()}
            </Text>
            
            <View style={styles.modalDetails}>
              <Text style={styles.modalDetailText}>📍 {incomingAlert?.address || 'Location provided via GPS'}</Text>
              <Text style={styles.modalDetailText}>👤 {incomingAlert?.reporter_name || incomingAlert?.caller_name || 'Citizen'}</Text>
              <Text style={styles.modalDetailText}>📞 {incomingAlert?.reporter_phone || incomingAlert?.caller_phone || 'Unknown'}</Text>
              <View style={styles.medicalProfileStub}>
                <Text style={styles.medicalProfileTitle}>Medical Profile (ABDM Verified):</Text>
                <Text style={styles.medicalProfileText}>Blood Type: O+ | Allergies: Penicillin</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={rejectIncidentFromAlert}>
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAcceptBtn} onPress={() => incomingAlert && acceptIncidentFromAlert(incomingAlert)}>
                <Text style={styles.modalAcceptText}>ACCEPT & NAVIGATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8fafc' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  greeting:     { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  statusDot:    { marginTop: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText:   { color: '#fff', fontWeight: '800', fontSize: 11 },
  logoutBtn:    { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#fca5a5' },
  logoutText:   { color: '#dc2626', fontWeight: '800', fontSize: 12 },

  sectionTitle: { color: '#64748b', fontSize: 13, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },

  card:         { backgroundColor: '#ffffff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  cardIcon:     { fontSize: 32 },
  cardType:     { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  cardTime:     { color: '#64748b', fontSize: 12, marginTop: 2, fontWeight: '600' },
  severityBadge:{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: '800' },
  cardAddress:  { color: '#475569', fontSize: 13, marginBottom: 6 },
  cardCaller:   { color: '#64748b', fontSize: 12, marginBottom: 12, fontWeight: '600' },
  acceptBtn:    { backgroundColor: '#ef4444', borderRadius: 10, padding: 12, alignItems: 'center' },
  acceptText:   { color: '#fff', fontWeight: '800', fontSize: 14 },

  activeCard:   { margin: 16, backgroundColor: '#fee2e2', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#ef4444' },
  activeTitle:  { color: '#dc2626', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 6 },
  activeType:   { color: '#0f172a', fontWeight: '800', fontSize: 20, marginBottom: 4 },
  activeAddr:   { color: '#475569', fontSize: 13, marginBottom: 4 },
  activeStatus: { color: '#ea580c', fontWeight: '800', fontSize: 13, marginBottom: 12 },
  activeActions:{ flexDirection: 'row', gap: 8 },
  navBtn:       { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 10, alignItems: 'center' },
  navBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  arrivedBtn:   { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, padding: 10, alignItems: 'center' },
  arrivedText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  resolveBtn:   { flex: 1, backgroundColor: '#64748b', borderRadius: 10, padding: 10, alignItems: 'center' },
  resolveText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  empty:        { alignItems: 'center', marginTop: 80 },
  emptyIcon:    { fontSize: 56, marginBottom: 12 },
  emptyText:    { color: '#0f172a', fontWeight: '800', fontSize: 18 },
  emptySubtext: { color: '#64748b', fontSize: 14, marginTop: 4 },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, borderWidth: 2, borderColor: '#ef4444' },
  modalWarning: { color: '#dc2626', fontWeight: '900', fontSize: 24, textAlign: 'center', marginBottom: 8 },
  modalType: { color: '#0f172a', fontWeight: '800', fontSize: 20, textAlign: 'center', marginBottom: 20 },
  modalDetails: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  modalDetailText: { color: '#0f172a', fontSize: 14, marginBottom: 8 },
  medicalProfileStub: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  medicalProfileTitle: { color: '#2563eb', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  medicalProfileText: { color: '#475569', fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalRejectBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  modalRejectText: { color: '#64748b', fontWeight: '800' },
  modalAcceptBtn: { flex: 2, backgroundColor: '#ef4444', padding: 16, borderRadius: 12, alignItems: 'center' },
  modalAcceptText: { color: '#fff', fontWeight: '900' }
});
