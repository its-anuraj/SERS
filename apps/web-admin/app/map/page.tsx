'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Layers, Ambulance, AlertTriangle, Hospital, Zap,
  RefreshCw, Eye, EyeOff, Radio, TrendingUp, X
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ActiveIncident {
  id: string;
  incident_number: string;
  type: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface AmbulanceData {
  id: string;
  registration_number: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  driver_name: string | null;
  hospital_name: string | null;
}

interface HospitalData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  icu_beds_available: number;
  er_beds_available: number;
  is_on_sers_network: boolean;
}

interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_score: number;
  risk_label: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function apiFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  en_route:  '#06b6d4',
  busy:      '#f97316',
  maintenance: '#64748b',
};

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

// ─────────────────────────────────────────────────────────────
// Map Popup Card
// ─────────────────────────────────────────────────────────────
interface PopupInfo {
  type: 'incident' | 'ambulance' | 'hospital' | 'hotspot';
  title: string;
  subtitle?: string;
  details: { label: string; value: string }[];
  color: string;
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────
// Layer toggle button
// ─────────────────────────────────────────────────────────────
function LayerToggle({ label, icon, active, color, count, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; color: string; count?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
        background: active ? `${color}20` : 'var(--surface-2)',
        border: `1px solid ${active ? color + '60' : 'var(--border)'}`,
        color: active ? color : 'var(--text-muted)',
        fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
      }}>
      {icon}
      {label}
      {count !== undefined && (
        <span style={{ background: active ? color : 'var(--border)', color: active ? '#fff' : 'var(--text-muted)', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{count}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function AdminMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<{ incidents: any[]; ambulances: any[]; hospitals: any[]; hotspots: any[] }>({
    incidents: [], ambulances: [], hospitals: [], hotspots: [],
  });
  const socketRef = useRef<Socket | null>(null);

  const [incidents, setIncidents] = useState<ActiveIncident[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceData[]>([]);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const [layers, setLayers] = useState({
    incidents: true,
    ambulances: true,
    hospitals: true,
    hotspots: true,
  });

  const toggleLayer = (key: keyof typeof layers) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  // Stats
  const activeIncidents = incidents.filter(i => !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const availableAmbulances = ambulances.filter(a => a.status === 'available').length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length;

  // ── Fetch data
  const fetchAll = useCallback(async () => {
    try {
      const [incRes, ambRes, hospRes, hotRes] = await Promise.allSettled([
        apiFetch('/api/analytics/active-incidents-map'),
        apiFetch('/api/ambulances'),
        apiFetch('/api/hospitals?limit=20'),
        apiFetch('/api/analytics/hotspots'),
      ]);

      if (incRes.status === 'fulfilled') setIncidents(incRes.value.data || []);
      if (ambRes.status === 'fulfilled') setAmbulances(ambRes.value.data || []);
      if (hospRes.status === 'fulfilled') setHospitals(hospRes.value.data || []);
      if (hotRes.status === 'fulfilled') setHotspots(hotRes.value.data || []);
    } catch {
      // API may not be available in dev without auth
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Init Leaflet map
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    if (!token) {
      window.location.href = '/login';
      return;
    }
    if (typeof window === 'undefined' || leafletMapRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      // Inject Leaflet CSS via link tag (avoids TS module resolution issue)
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!mapRef.current || leafletMapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [12.9716, 77.5946], // Bengaluru
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
      leafletMapRef.current._L = L;

      // Close popup on map click
      map.on('click', () => setPopup(null));
    })();
  }, []);

  // ── Render markers whenever data or layers change
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const L = map._L;
    if (!L) return;

    // ── Clear existing markers
    [...markersRef.current.incidents, ...markersRef.current.ambulances,
     ...markersRef.current.hospitals, ...markersRef.current.hotspots].forEach(m => m.remove());
    markersRef.current = { incidents: [], ambulances: [], hospitals: [], hotspots: [] };

    // ── Incident markers
    if (layers.incidents) {
      incidents.forEach(inc => {
        if (!inc.latitude || !inc.longitude) return;
        const color = SEVERITY_COLORS[inc.severity] || '#64748b';
        const icon = L.divIcon({
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${color}20;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-size:14px;cursor:pointer;
            box-shadow:0 0 12px ${color}60;
          ">${inc.severity === 'critical' ? '🚨' : inc.severity === 'moderate' ? '⚠️' : '🔔'}</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16], className: '',
        });
        const marker = L.marker([inc.latitude, inc.longitude], { icon }).addTo(map);
        marker.on('click', (e: any) => {
          e.originalEvent.stopPropagation();
          const rect = mapRef.current!.getBoundingClientRect();
          setPopup({
            type: 'incident',
            title: `${inc.type.toUpperCase()} — ${inc.incident_number || inc.id.slice(0,8)}`,
            subtitle: `${inc.severity} · ${inc.status}`,
            details: [
              { label: 'Status', value: inc.status.replace('_',' ') },
              { label: 'Severity', value: inc.severity },
              { label: 'Reported', value: new Date(inc.created_at).toLocaleString('en-IN') },
            ],
            color,
            x: e.originalEvent.clientX - rect.left,
            y: e.originalEvent.clientY - rect.top,
          });
        });
        markersRef.current.incidents.push(marker);
      });
    }

    // ── Ambulance markers
    if (layers.ambulances) {
      ambulances.forEach(amb => {
        if (!amb.current_lat || !amb.current_lng) return;
        const color = STATUS_COLORS[amb.status] || '#64748b';
        const icon = L.divIcon({
          html: `<div style="
            width:34px;height:34px;border-radius:10px;
            background:${color}25;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-size:18px;cursor:pointer;
            box-shadow:0 2px 10px ${color}50;
          ">🚑</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17], className: '',
        });
        const marker = L.marker([amb.current_lat, amb.current_lng], { icon }).addTo(map);
        marker.on('click', (e: any) => {
          e.originalEvent.stopPropagation();
          const rect = mapRef.current!.getBoundingClientRect();
          setPopup({
            type: 'ambulance',
            title: amb.registration_number,
            subtitle: amb.driver_name || 'No driver assigned',
            details: [
              { label: 'Status', value: amb.status },
              { label: 'Hospital', value: amb.hospital_name || '—' },
              { label: 'Driver', value: amb.driver_name || '—' },
            ],
            color,
            x: e.originalEvent.clientX - rect.left,
            y: e.originalEvent.clientY - rect.top,
          });
        });
        markersRef.current.ambulances.push(marker);
      });
    }

    // ── Hospital markers
    if (layers.hospitals) {
      hospitals.forEach(hosp => {
        if (!hosp.latitude || !hosp.longitude) return;
        const bedOk = (hosp.er_beds_available || 0) > 0;
        const color = bedOk ? '#3b82f6' : '#64748b';
        const icon = L.divIcon({
          html: `<div style="
            width:34px;height:34px;border-radius:50%;
            background:${color}20;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-size:16px;cursor:pointer;
          ">🏥</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17], className: '',
        });
        const marker = L.marker([hosp.latitude, hosp.longitude], { icon }).addTo(map);
        marker.on('click', (e: any) => {
          e.originalEvent.stopPropagation();
          const rect = mapRef.current!.getBoundingClientRect();
          setPopup({
            type: 'hospital',
            title: hosp.name,
            subtitle: hosp.is_on_sers_network ? 'On SERS Network' : 'Not on SERS Network',
            details: [
              { label: 'ICU Beds', value: String(hosp.icu_beds_available ?? '—') },
              { label: 'ER Beds', value: String(hosp.er_beds_available ?? '—') },
              { label: 'Network', value: hosp.is_on_sers_network ? 'Active' : 'Inactive' },
            ],
            color,
            x: e.originalEvent.clientX - rect.left,
            y: e.originalEvent.clientY - rect.top,
          });
        });
        markersRef.current.hospitals.push(marker);
      });
    }

    // ── Hotspot circles
    if (layers.hotspots) {
      hotspots.forEach(hs => {
        const color = RISK_COLORS[hs.risk_label] || '#64748b';
        const circle = L.circle([hs.latitude, hs.longitude], {
          radius: hs.radius_meters,
          color, fillColor: color,
          fillOpacity: 0.12, weight: 1.5,
        }).addTo(map);
        circle.on('click', (e: any) => {
          e.originalEvent.stopPropagation();
          const rect = mapRef.current!.getBoundingClientRect();
          setPopup({
            type: 'hotspot',
            title: `${hs.risk_label.toUpperCase()} Risk Hotspot`,
            subtitle: `Score: ${(hs.risk_score * 100).toFixed(0)}%`,
            details: [
              { label: 'Risk Score', value: `${(hs.risk_score * 100).toFixed(0)}%` },
              { label: 'Radius', value: `${hs.radius_meters}m` },
              { label: 'Risk Level', value: hs.risk_label },
            ],
            color,
            x: e.originalEvent.clientX - rect.left,
            y: e.originalEvent.clientY - rect.top,
          });
        });
        markersRef.current.hotspots.push(circle);
      });
    }
  }, [incidents, ambulances, hospitals, hotspots, layers]);

  // ── Socket.io live updates
  useEffect(() => {
    fetchAll();

    const socket = io(WS, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('incident:new', (inc: ActiveIncident) => {
      setIncidents(prev => [inc, ...prev.filter(i => i.id !== inc.id)]);
    });

    socket.on('incident:status', ({ incidentId, status }: { incidentId: string; status: string }) => {
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    });

    socket.on('location:update', ({ ambulanceId, lat, lng }: { ambulanceId: string; lat: number; lng: number }) => {
      setAmbulances(prev => prev.map(a => a.id === ambulanceId ? { ...a, current_lat: lat, current_lng: lng } : a));
    });

    // Refresh all data every 60 seconds
    const interval = setInterval(fetchAll, 60000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchAll]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '14px 20px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--accent)" />
            <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Command Map</h1>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Live stats pills */}
          {[
            { label: 'Active', value: activeIncidents, color: '#ef4444', icon: '🚨' },
            { label: 'Critical', value: criticalIncidents, color: '#f97316', icon: '⚠️' },
            { label: 'Ambulances', value: `${availableAmbulances}/${ambulances.length}`, color: '#22c55e', icon: '🚑' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 99,
              background: `${s.color}15`, border: `1px solid ${s.color}30`,
              fontSize: 12, fontWeight: 700, color: s.color,
            }}>
              <span>{s.icon}</span>
              <span>{loading ? '…' : s.value}</span>
              <span style={{ color: s.color + '80', fontWeight: 400 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Layer toggles */}
          <LayerToggle label="Incidents" icon={<AlertTriangle size={12} />} active={layers.incidents} color="#ef4444" count={incidents.filter(i => !['resolved','cancelled','false_alarm'].includes(i.status)).length} onClick={() => toggleLayer('incidents')} />
          <LayerToggle label="Ambulances" icon={<Ambulance size={12} />} active={layers.ambulances} color="#22c55e" count={ambulances.length} onClick={() => toggleLayer('ambulances')} />
          <LayerToggle label="Hospitals" icon={<Hospital size={12} />} active={layers.hospitals} color="#3b82f6" count={hospitals.length} onClick={() => toggleLayer('hospitals')} />
          <LayerToggle label="Hotspots" icon={<Zap size={12} />} active={layers.hotspots} color="#f97316" count={hotspots.length} onClick={() => toggleLayer('hotspots')} />

          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Map container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 14 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading map data…</p>
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 40, left: 16, zIndex: 10,
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
          padding: '14px 16px', minWidth: 180,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Legend</p>
          {[
            { icon: '🚨', label: 'Critical Incident', color: '#ef4444' },
            { icon: '⚠️', label: 'Moderate Incident', color: '#f97316' },
            { icon: '🔔', label: 'Minor Incident', color: '#22c55e' },
            { icon: '🚑', label: 'Ambulance (available)', color: '#22c55e' },
            { icon: '🚑', label: 'Ambulance (en route)', color: '#06b6d4' },
            { icon: '🏥', label: 'Hospital', color: '#3b82f6' },
            { icon: '🔥', label: 'Accident Hotspot', color: '#f97316' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Map popup */}
        {popup && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: Math.min(popup.x + 10, (mapRef.current?.offsetWidth || 800) - 270),
              top: Math.max(popup.y - 160, 10),
              zIndex: 20,
              background: 'rgba(15,23,42,0.97)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${popup.color}40`,
              borderRadius: 14, padding: '14px 16px', width: 250,
              boxShadow: `0 8px 32px ${popup.color}20`,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{popup.title}</p>
                {popup.subtitle && <p style={{ fontSize: 11, color: popup.color, marginTop: 2, fontWeight: 600 }}>{popup.subtitle}</p>}
              </div>
              <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                <X size={14} />
              </button>
            </div>
            {popup.details.map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-container { background: #0a0e1a !important; }
      `}</style>
    </div>
  );
}
