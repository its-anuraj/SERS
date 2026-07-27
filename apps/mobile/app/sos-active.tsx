/**
 * SERS Mobile — SOS Active Screen
 * Shown after SOS is triggered (manually or by crash detection).
 * Live countdown, cancel button, status updates via socket.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Vibration, Alert, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { connectSocket } from '../services/socket';

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  reported:      { label: 'SOS Sent — Awaiting Dispatch',    color: '#f59e0b', icon: '📡' },
  assigned:      { label: 'Ambulance Assigned!',             color: '#3b82f6', icon: '🚑' },
  en_route:      { label: 'Ambulance is on the way!',        color: '#06b6d4', icon: '🛣️' },
  arrived:       { label: 'Responder has Arrived',           color: '#8b5cf6', icon: '✅' },
  transporting:  { label: 'Transporting to Hospital',        color: '#f97316', icon: '🏥' },
  resolved:      { label: 'Incident Resolved',               color: '#22c55e', icon: '🏁' },
};

export default function SosActiveScreen() {
  const params = useLocalSearchParams<{ incidentId?: string; source?: string }>();
  const [incidentId, setIncidentId] = useState<string | null>(params.incidentId || null);
  const [incidentStatus, setIncidentStatus] = useState<string>('reported');
  const [responderInfo, setResponderInfo] = useState<{ name: string; phone: string; eta: string } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Vibrate on mount
  useEffect(() => {
    Vibration.vibrate([0, 400, 200, 400]);
  }, []);

  // If opened from crash detection without incidentId, create incident first
  useEffect(() => {
    if (!incidentId && params.source === 'crash_detection') {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const res = await api.post('/incidents', {
            incident_type: 'accident',
            severity: 'critical',
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            source: 'crash_detection',
          });
          setIncidentId(res.data.data.id);
        } catch (e) {
          console.warn('Failed to auto-create crash incident', e);
        }
      })();
    }
  }, []);

  // Socket listeners for live status updates
  useEffect(() => {
    if (!incidentId) return;
    const socket = connectSocket();
    socket.on(`incident:${incidentId}:updated`, (data: any) => {
      setIncidentStatus(data.status);
      if (data.responder) setResponderInfo(data.responder);
    });
    return () => {
      socket.off(`incident:${incidentId}:updated`);
    };
  }, [incidentId]);

  const cancelSOS = async () => {
    Alert.alert('Cancel SOS?', 'This will cancel your emergency request.', [
      { text: 'Keep SOS Active', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          if (incidentId) {
            await api.patch(`/incidents/${incidentId}/status`, { status: 'cancelled' }).catch(() => {});
          }
          router.back();
        },
      },
    ]);
  };

  const callResponder = () => {
    if (!responderInfo?.phone) return;
    Linking.openURL(`tel:${responderInfo.phone}`);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const statusInfo = STATUS_LABEL[incidentStatus] || STATUS_LABEL.reported;
  const isResolved = incidentStatus === 'resolved';

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topLabel}>🆘 SOS ACTIVE</Text>
        <Text style={styles.elapsed}>⏱ {formatTime(elapsedSec)}</Text>
      </View>

      {/* Pulsing circle */}
      <View style={styles.pulseWrapper}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
        <View style={[styles.sosCircle, isResolved && styles.resolvedCircle]}>
          <Text style={styles.sosIcon}>{statusInfo.icon}</Text>
          <Text style={styles.sosLabel}>{isResolved ? 'DONE' : 'SOS'}</Text>
        </View>
      </View>

      {/* Status card */}
      <View style={[styles.statusCard, { borderColor: statusInfo.color }]}>
        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        {incidentId && (
          <Text style={styles.incidentId}>Incident ID: #{incidentId.slice(-8).toUpperCase()}</Text>
        )}
      </View>

      {/* Responder info (shows when assigned) */}
      {responderInfo && (
        <View style={styles.responderCard}>
          <Text style={styles.responderTitle}>🚑 Your Responder</Text>
          <Text style={styles.responderName}>{responderInfo.name}</Text>
          <Text style={styles.responderEta}>ETA: {responderInfo.eta}</Text>
          <TouchableOpacity style={styles.callBtn} onPress={callResponder}>
            <Text style={styles.callBtnText}>📞 Call Responder</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress steps */}
      <View style={styles.steps}>
        {Object.entries(STATUS_LABEL).slice(0, 5).map(([key, info]) => {
          const statusOrder = ['reported', 'assigned', 'en_route', 'arrived', 'transporting'];
          const currentIdx = statusOrder.indexOf(incidentStatus);
          const stepIdx    = statusOrder.indexOf(key);
          const isDone     = stepIdx <= currentIdx;
          return (
            <View key={key} style={styles.step}>
              <View style={[styles.stepDot, isDone && { backgroundColor: info.color }]}>
                <Text style={styles.stepDotText}>{isDone ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.stepLabel, isDone && { color: '#f1f5f9' }]}>{info.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      {!isResolved ? (
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelSOS}>
          <Text style={styles.cancelText}>Cancel SOS</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>✅ Go Home</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 20 },
  topBar:         { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 12 },
  topLabel:       { color: '#ef4444', fontWeight: '900', fontSize: 18, letterSpacing: 2 },
  elapsed:        { color: '#64748b', fontWeight: '600', fontSize: 16 },

  pulseWrapper:   { alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  pulseRing:      { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 2, borderColor: 'rgba(239,68,68,0.3)' },
  sosCircle:      { width: 140, height: 140, borderRadius: 70, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 24, elevation: 12 },
  resolvedCircle: { backgroundColor: '#22c55e', shadowColor: '#22c55e' },
  sosIcon:        { fontSize: 40 },
  sosLabel:       { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 4 },

  statusCard:     { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, alignItems: 'center' },
  statusText:     { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  incidentId:     { color: '#475569', fontSize: 12, marginTop: 6 },

  responderCard:  { backgroundColor: '#0f2027', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#3b82f6' },
  responderTitle: { color: '#3b82f6', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', marginBottom: 4 },
  responderName:  { color: '#f1f5f9', fontWeight: '700', fontSize: 18 },
  responderEta:   { color: '#94a3b8', fontSize: 13, marginBottom: 10 },
  callBtn:        { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 12, alignItems: 'center' },
  callBtnText:    { color: '#fff', fontWeight: '700' },

  steps:          { gap: 10, marginBottom: 20 },
  step:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot:        { width: 20, height: 20, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  stepDotText:    { color: '#fff', fontSize: 10, fontWeight: '900' },
  stepLabel:      { color: '#475569', fontSize: 13, flex: 1 },

  cancelBtn:      { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  cancelText:     { color: '#94a3b8', fontWeight: '700', fontSize: 16 },
  doneBtn:        { backgroundColor: '#166534', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 20 },
  doneBtnText:    { color: '#fff', fontWeight: '800', fontSize: 16 },
});
