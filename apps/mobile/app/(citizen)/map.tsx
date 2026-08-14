/**
 * Citizen — Live Map Screen
 * Shows user location, accident hotspots, nearest hospitals, and active incidents
 * Uses react-native-maps (already in project dependencies)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, ScrollView, Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { api } from '../../services/api';

const { width, height } = Dimensions.get('window');

interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_score: number;
  risk_label: string;
}

interface NearbyHospital {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: string;
  erBedsAvailable: number;
  emergencyPhone: string;
}

interface ActiveIncident {
  id: string;
  type: string;
  severity: string;
  latitude: number;
  longitude: number;
  status: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#22c55e',
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥',
  fire: '🔥', drowning: '🌊', fall: '⬇️', other: '🆘',
};

// Map style — dark theme
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#0f2744' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
];

type LayerKey = 'hotspots' | 'hospitals' | 'incidents';

export default function LiveMapScreen() {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [incidents, setIncidents] = useState<ActiveIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    hotspots: true,
    hospitals: true,
    incidents: true,
  });
  const [selectedItem, setSelectedItem] = useState<{
    type: string; title: string; subtitle: string; color: string;
  } | null>(null);

  const toggleLayer = (key: LayerKey) =>
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  const fetchMapData = useCallback(async (lat: number, lng: number) => {
    try {
      const [hotRes, hospRes, incRes] = await Promise.allSettled([
        api.get(`/analytics/hotspots`),
        api.get(`/hospitals/nearest?lat=${lat}&lng=${lng}&radius=15000&limit=10`),
        api.get('/analytics/active-incidents-map'),
      ]);

      if (hotRes.status === 'fulfilled') setHotspots(hotRes.value.data.data || []);
      if (hospRes.status === 'fulfilled') setHospitals(hospRes.value.data.data || []);
      if (incRes.status === 'fulfilled') setIncidents(incRes.value.data.data || []);
    } catch {
      // silently handle if API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const defaultLoc = { latitude: 12.9716, longitude: 77.5946 };
      let coords = defaultLoc;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);
          if (loc && 'coords' in loc) {
            coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          }
        }
      } catch (e) {
        console.warn('Map location fetch timed out:', e);
      }
      setUserLocation(coords);
      fetchMapData(coords.latitude, coords.longitude);
      
      // Snap immediately once found
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 300);
        }
      }, 500);
    })();
  }, []);

  const centerOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 600);
  };

  const initialRegion: Region = userLocation
    ? { ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.12, longitudeDelta: 0.12 };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Live Map',
          headerStyle: { backgroundColor: '#0a0e1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => setSelectedItem(null)}
      >
        {/* ── Hotspot circles */}
        {layers.hotspots && hotspots.map(hs => (
          <Circle
            key={hs.id || `${hs.latitude}-${hs.longitude}`}
            center={{ latitude: hs.latitude, longitude: hs.longitude }}
            radius={hs.radius_meters}
            strokeColor={RISK_COLORS[hs.risk_label] + '80'}
            fillColor={RISK_COLORS[hs.risk_label] + '22'}
            strokeWidth={1.5}
          />
        ))}
        {layers.hotspots && hotspots.map(hs => (
          <Marker
            key={`hs-marker-${hs.latitude}-${hs.longitude}`}
            coordinate={{ latitude: hs.latitude, longitude: hs.longitude }}
            onPress={() => setSelectedItem({
              type: 'hotspot',
              title: `${(hs.risk_label || 'warning').toUpperCase()} Risk Zone`,
              subtitle: `Accident risk: ${((hs.risk_score || 0) * 100).toFixed(0)}% · Radius: ${hs.radius_meters || 500}m`,
              color: RISK_COLORS[hs.risk_label] || '#f97316',
            })}
          >
            <View style={[styles.hotspotMarker, { backgroundColor: (RISK_COLORS[hs.risk_label] || '#f97316') + '30', borderColor: RISK_COLORS[hs.risk_label] || '#f97316' }]}>
              <Text style={{ fontSize: 12 }}>⚠️</Text>
            </View>
          </Marker>
        ))}

        {/* ── Hospital markers */}
        {layers.hospitals && hospitals.map(h => (
          <Marker
            key={`hosp-${h.id}`}
            coordinate={{ latitude: h.latitude, longitude: h.longitude }}
            onPress={() => setSelectedItem({
              type: 'hospital',
              title: h.name || 'Hospital',
              subtitle: `${h.distanceKm || '—'} km away · ER Beds: ${h.erBedsAvailable ?? '—'}`,
              color: '#3b82f6',
            })}
          >
            <View style={styles.hospitalMarker}>
              <Text style={{ fontSize: 16 }}>🏥</Text>
            </View>
          </Marker>
        ))}

        {/* ── Active incident markers */}
        {layers.incidents && incidents.map(inc => (
          <Marker
            key={`inc-${inc.id}`}
            coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
            onPress={() => setSelectedItem({
              type: 'incident',
              title: `${(inc.type || 'Emergency').toUpperCase()} Incident`,
              subtitle: `Severity: ${inc.severity || 'moderate'} · Status: ${inc.status || 'reported'}`,
              color: SEVERITY_COLORS[inc.severity] || '#64748b',
            })}
          >
            <View style={[styles.incidentMarker, { backgroundColor: (SEVERITY_COLORS[inc.severity] || '#64748b') + '30', borderColor: SEVERITY_COLORS[inc.severity] || '#64748b' }]}>
              <Text style={{ fontSize: 14 }}>{TYPE_ICON[inc.type] || '🆘'}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#ef4444" size="large" />
          <Text style={styles.loadingText}>Loading live map…</Text>
        </View>
      )}

      {/* Layer toggles — top */}
      <View style={styles.layerBar}>
        {(Object.keys(layers) as LayerKey[]).map(key => {
          const cfg: Record<LayerKey, { icon: string; label: string; color: string }> = {
            hotspots:  { icon: '⚠️', label: 'Hotspots',  color: '#f97316' },
            hospitals: { icon: '🏥', label: 'Hospitals', color: '#3b82f6' },
            incidents: { icon: '🚨', label: 'Incidents', color: '#ef4444' },
          };
          const { icon, label, color } = cfg[key];
          return (
            <TouchableOpacity
              key={key}
              onPress={() => toggleLayer(key)}
              style={[styles.layerBtn, layers[key] && { backgroundColor: `${color}25`, borderColor: `${color}60` }]}>
              <Text style={{ fontSize: 12 }}>{icon}</Text>
              <Text style={[styles.layerBtnText, layers[key] && { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info pill — selected item */}
      {selectedItem && (
        <View style={[styles.infoPill, { borderColor: selectedItem.color + '50' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoPillTitle, { color: selectedItem.color }]}>{selectedItem.title}</Text>
            <Text style={styles.infoPillSubtitle}>{selectedItem.subtitle}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.infoPillClose}>
            <Text style={{ color: '#64748b', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FABs — bottom right */}
      <View style={styles.fabGroup}>
        <TouchableOpacity style={styles.fabSos} onPress={() => router.back()}>
          <Text style={styles.fabSosText}>🆘 SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabCenter} onPress={centerOnUser}>
          <Text style={{ fontSize: 18 }}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#ef4444', label: 'Critical zone' },
          { color: '#f97316', label: 'High risk' },
          { color: '#eab308', label: 'Medium risk' },
        ].map(item => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
            <Text style={{ fontSize: 9, color: '#64748b' }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,26,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  loadingText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },

  layerBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 12 : 10,
    left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 5,
  },
  layerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  layerBtnText: { fontSize: 10, fontWeight: '700', color: '#64748b' },

  infoPill: {
    position: 'absolute', bottom: 130, left: 16, right: 16, zIndex: 5,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16, padding: 14,
    borderWidth: 1,
  },
  infoPillTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  infoPillSubtitle: { fontSize: 12, color: '#64748b' },
  infoPillClose: { paddingLeft: 10, paddingVertical: 4 },

  fabGroup: {
    position: 'absolute', bottom: 56, right: 16, gap: 10, alignItems: 'flex-end', zIndex: 5,
  },
  fabSos: {
    backgroundColor: '#ef4444', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
    shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  fabSosText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  fabCenter: {
    backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: 14,
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  legend: {
    position: 'absolute', bottom: 56, left: 16, zIndex: 5,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  // Markers
  hotspotMarker: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  hospitalMarker: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 2, borderColor: 'rgba(59,130,246,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  incidentMarker: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
});
