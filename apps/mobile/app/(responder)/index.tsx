/**
 * SERS Mobile — Responder Dashboard
 * Ambulance driver sees incoming SOS requests, accepts them, and navigates to victim.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';

interface Incident {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  caller_name: string;
  caller_phone: string;
  latitude: number;
  longitude: number;
  address: string;
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
  const [incidents, setIncidents]     = useState<Incident[]>([]);
  const [myIncident, setMyIncident]   = useState<Incident | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [status, setStatus]           = useState<'available' | 'busy'>('available');

  // Fetch open incidents
  const fetchIncidents = useCallback(async () => {
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
  }, []);

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
      setIncidents(prev => [incident, ...prev]);
    });
    socket.on('incident:updated', fetchMyIncident);

    return () => {
      socket.off('incident:new');
      socket.off('incident:updated');
    };
  }, []);

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

  const acceptIncident = async (incident: Incident) => {
    Alert.alert(
      'Accept Incident?',
      `${TYPE_ICON[incident.incident_type] || '🆘'} ${incident.incident_type.toUpperCase()}\n${incident.address || 'Location: ' + incident.latitude + ', ' + incident.longitude}`,
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
              openNavigation(incident.latitude, incident.longitude);
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

  const renderIncident = ({ item }: { item: Incident }) => (
    <TouchableOpacity style={styles.card} onPress={() => acceptIncident(item)} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{TYPE_ICON[item.incident_type] || '🆘'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardType}>{item.incident_type.toUpperCase()}</Text>
          <Text style={styles.cardTime}>
            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLOR[item.severity] + '20', borderColor: SEVERITY_COLOR[item.severity] }]}>
          <Text style={[styles.severityText, { color: SEVERITY_COLOR[item.severity] }]}>
            {item.severity.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.cardAddress} numberOfLines={2}>
        📍 {item.address || `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}`}
      </Text>
      <Text style={styles.cardCaller}>👤 {item.caller_name}  📞 {item.caller_phone}</Text>
      <View style={styles.acceptBtn}>
        <Text style={styles.acceptText}>Accept & Navigate →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 🚑</Text>
          <View style={[styles.statusDot, { backgroundColor: status === 'available' ? '#22c55e' : '#f97316' }]}>
            <Text style={styles.statusText}>{status === 'available' ? '● Available' : '● On Duty'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Active Incident Banner */}
      {myIncident && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>🚨 Active Incident</Text>
          <Text style={styles.activeType}>{TYPE_ICON[myIncident.incident_type]} {myIncident.incident_type.toUpperCase()}</Text>
          <Text style={styles.activeAddr}>📍 {myIncident.address || 'GPS Location'}</Text>
          <Text style={styles.activeStatus}>Status: {myIncident.status.replace('_', ' ').toUpperCase()}</Text>
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => openNavigation(myIncident.latitude, myIncident.longitude)}
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
      {status === 'available' && (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0e1a' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 56, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  greeting:     { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  statusDot:    { marginTop: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText:   { color: '#fff', fontWeight: '700', fontSize: 12 },
  logoutBtn:    { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText:   { color: '#94a3b8', fontWeight: '600' },

  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },

  card:         { backgroundColor: '#111827', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  cardIcon:     { fontSize: 32 },
  cardType:     { color: '#f1f5f9', fontWeight: '800', fontSize: 15 },
  cardTime:     { color: '#64748b', fontSize: 12, marginTop: 2 },
  severityBadge:{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: '800' },
  cardAddress:  { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  cardCaller:   { color: '#64748b', fontSize: 12, marginBottom: 12 },
  acceptBtn:    { backgroundColor: '#ef4444', borderRadius: 10, padding: 12, alignItems: 'center' },
  acceptText:   { color: '#fff', fontWeight: '800', fontSize: 14 },

  activeCard:   { margin: 16, backgroundColor: '#1a0a0a', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#ef4444' },
  activeTitle:  { color: '#ef4444', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 6 },
  activeType:   { color: '#f1f5f9', fontWeight: '800', fontSize: 20, marginBottom: 4 },
  activeAddr:   { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  activeStatus: { color: '#f97316', fontWeight: '700', fontSize: 13, marginBottom: 12 },
  activeActions:{ flexDirection: 'row', gap: 8 },
  navBtn:       { flex: 1, backgroundColor: '#1d4ed8', borderRadius: 10, padding: 10, alignItems: 'center' },
  navBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  arrivedBtn:   { flex: 1, backgroundColor: '#166534', borderRadius: 10, padding: 10, alignItems: 'center' },
  arrivedText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  resolveBtn:   { flex: 1, backgroundColor: '#374151', borderRadius: 10, padding: 10, alignItems: 'center' },
  resolveText:  { color: '#9ca3af', fontWeight: '700', fontSize: 13 },

  empty:        { alignItems: 'center', marginTop: 80 },
  emptyIcon:    { fontSize: 56, marginBottom: 12 },
  emptyText:    { color: '#f1f5f9', fontWeight: '700', fontSize: 18 },
  emptySubtext: { color: '#64748b', fontSize: 14, marginTop: 4 },
});
