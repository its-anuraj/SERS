/**
 * Citizen — Nearby Hospitals Screen
 * Shows SERS-connected hospitals sorted by distance with live capacity data
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert, TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { api } from '../../services/api';

interface Hospital {
  id: string;
  name: string;
  type: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: string;
  distanceMeters: number;
  etaMins: number;
  emergencyPhone: string;
  icuBedsAvailable: number;
  erBedsAvailable: number;
  specialties: string[];
  hasTraumaCenter: boolean;
  isAbdmRegistered: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  'multi-specialty': '#3b82f6',
  'government':      '#22c55e',
  'clinic':          '#f59e0b',
};

function BedBar({ label, available, total, color }: { label: string; available: number; total?: number; color: string }) {
  const pct = total ? Math.min(available / total, 1) : 0.5;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '700' }}>{available} free</Text>
      </View>
      <View style={{ height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: available > 0 ? color : '#374151', borderRadius: 4 }} />
      </View>
    </View>
  );
}

export default function HospitalsScreen() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filtered, setFiltered] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'beds'>('distance');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchHospitals = useCallback(async (loc?: { lat: number; lng: number }) => {
    const coords = loc || location;
    try {
      const params = coords
        ? `?lat=${coords.lat}&lng=${coords.lng}&radius=20000&limit=20`
        : `?limit=20`;
      const res = await api.get(`/hospitals/nearest${params}`);
      setHospitals(res.data.data || []);
    } catch (err: any) {
      // Fallback: try listing all hospitals
      try {
        const res2 = await api.get('/hospitals?limit=20');
        setHospitals(res2.data.data || []);
      } catch {
        Alert.alert('Error', 'Could not load hospitals. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location]);

  // Get location + fetch
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLocation(coords);
        fetchHospitals(coords);
      } else {
        fetchHospitals();
      }
    })();
  }, []);

  // Filter + sort
  useEffect(() => {
    let list = [...hospitals];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.address?.toLowerCase().includes(q) ||
        h.specialties?.some(s => s.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'distance') {
      list.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    } else {
      list.sort((a, b) => (b.erBedsAvailable + b.icuBedsAvailable) - (a.erBedsAvailable + a.icuBedsAvailable));
    }
    setFiltered(list);
  }, [hospitals, search, sortBy]);

  const callHospital = (phone: string, name: string) => {
    const clean = phone.replace(/\s/g, '');
    Alert.alert(
      `Call ${name}?`,
      `Emergency line: ${phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '📞 Call Now', onPress: () => Linking.openURL(`tel:${clean}`) },
      ]
    );
  };

  const openMaps = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open Google Maps'));
  };

  const renderHospital = ({ item: h, index }: { item: Hospital; index: number }) => {
    const bedsOk = (h.erBedsAvailable || 0) > 0;
    const typeColor = TYPE_COLOR[h.type] || '#64748b';

    return (
      <View style={[styles.card, index === 0 && styles.cardFirst]}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={styles.cardName} numberOfLines={2}>{h.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20`, borderColor: `${typeColor}40` }]}>
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>{h.type}</Text>
              </View>
              {h.hasTraumaCenter && (
                <View style={styles.traumaBadge}>
                  <Text style={styles.traumaText}>🚨 Trauma</Text>
                </View>
              )}
              {h.isAbdmRegistered && (
                <View style={styles.abdmBadge}>
                  <Text style={styles.abdmText}>🏛️ ABDM</Text>
                </View>
              )}
            </View>
          </View>

          {/* Distance + ETA */}
          <View style={styles.distanceBox}>
            <Text style={styles.distanceKm}>{h.distanceKm ?? '—'} km</Text>
            <Text style={styles.distanceEta}>⏱ {h.etaMins ?? '—'} min</Text>
          </View>
        </View>

        {/* Address */}
        <Text style={styles.cardAddress} numberOfLines={2}>📍 {h.address || 'Address not available'}</Text>

        {/* Bed availability */}
        <View style={styles.bedsSection}>
          <BedBar label="ER / Emergency Beds" available={h.erBedsAvailable ?? 0} color="#ef4444" />
          <BedBar label="ICU Beds" available={h.icuBedsAvailable ?? 0} color="#a855f7" />
        </View>

        {/* Specialties */}
        {h.specialties?.length > 0 && (
          <View style={styles.specialties}>
            {h.specialties.slice(0, 4).map(s => (
              <View key={s} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{s}</Text>
              </View>
            ))}
            {h.specialties.length > 4 && (
              <View style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>+{h.specialties.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.callBtn, !h.emergencyPhone && { opacity: 0.4 }]}
            onPress={() => h.emergencyPhone && callHospital(h.emergencyPhone, h.name)}
            disabled={!h.emergencyPhone}>
            <Text style={styles.callBtnText}>📞 Emergency Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.navBtn]}
            onPress={() => openMaps(h.latitude, h.longitude, h.name)}>
            <Text style={styles.navBtnText}>🗺️ Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Nearby Hospitals',
          headerStyle: { backgroundColor: '#0a0e1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />

      {/* Search + sort bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInput}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, specialty..."
            placeholderTextColor="#475569"
            style={styles.searchText}
          />
        </View>
        <View style={styles.sortToggle}>
          {(['distance', 'beds'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
              onPress={() => setSortBy(s)}>
              <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                {s === 'distance' ? '📍 Distance' : '🛏️ Beds'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#ef4444" size="large" />
          <Text style={styles.loadingText}>Finding nearest hospitals...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={h => h.id}
          renderItem={renderHospital}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchHospitals(); }}
              tintColor="#ef4444"
            />
          }
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {filtered.length} hospital{filtered.length !== 1 ? 's' : ''} found
              {location ? ' near you' : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏥</Text>
              <Text style={styles.emptyText}>No hospitals found</Text>
              <Text style={styles.emptySubtext}>Try a different search term or expand the radius</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },

  searchBar: { padding: 12, gap: 8 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchText: { flex: 1, color: '#f1f5f9', fontSize: 14 },
  sortToggle: { flexDirection: 'row', gap: 8 },
  sortBtn: {
    flex: 1, padding: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sortBtnActive: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  sortBtnTextActive: { color: '#ef4444' },

  resultsCount: { fontSize: 12, color: '#475569', marginBottom: 12, fontWeight: '600' },

  card: {
    backgroundColor: '#111827', borderRadius: 18,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardFirst: { borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1.5 },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#f1f5f9', flex: 1, lineHeight: 20 },

  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  traumaBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  traumaText: { fontSize: 10, fontWeight: '700', color: '#ef4444' },
  abdmBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  abdmText: { fontSize: 10, fontWeight: '700', color: '#a855f7' },

  distanceBox: { alignItems: 'flex-end', minWidth: 64 },
  distanceKm: { fontSize: 18, fontWeight: '900', color: '#3b82f6' },
  distanceEta: { fontSize: 11, color: '#64748b', marginTop: 1 },

  cardAddress: { fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 18 },

  bedsSection: { marginBottom: 10 },

  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  specialtyTag: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  specialtyText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 11, alignItems: 'center' },
  callBtn: { backgroundColor: '#ef4444' },
  callBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  navBtn: { backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
  navBtnText: { color: '#3b82f6', fontWeight: '800', fontSize: 13 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748b', fontSize: 14, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
