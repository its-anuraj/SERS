'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AlertTriangle, Clock, CheckCircle2, XCircle, ChevronRight,
  Search, Filter, RefreshCw, X, Radio, Ambulance, Hospital,
  MapPin, User, Zap, Activity, TrendingUp, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:3000';

interface Incident {
  id: string;
  incident_number: string;
  type: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark: string;
  description: string;
  reporter_name: string;
  reporter_phone: string;
  responder_name: string | null;
  hospital_name: string | null;
  ambulance_reg: string | null;
  ai_crash_detected: boolean;
  ai_severity_score: number | null;
  created_at: string;
  resolved_at: string | null;
  timeline?: TimelineEvent[];
  is_demo?: boolean;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  actor_name: string | null;
  actor_role: string;
  description: string;
  timestamp: string;
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', label: 'Critical' },
  moderate: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', text: '#f97316', label: 'Moderate' },
  minor:    { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.4)',  text: '#22c55e', label: 'Minor' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  reported:     { color: '#eab308', label: 'Reported',     icon: '📡' },
  assigned:     { color: '#3b82f6', label: 'Assigned',     icon: '🔗' },
  en_route:     { color: '#06b6d4', label: 'En Route',     icon: '🚑' },
  arrived:      { color: '#a855f7', label: 'Arrived',      icon: '📍' },
  transporting: { color: '#f97316', label: 'Transporting', icon: '🏥' },
  resolved:     { color: '#22c55e', label: 'Resolved',     icon: '✅' },
  cancelled:    { color: '#64748b', label: 'Cancelled',    icon: '❌' },
  false_alarm:  { color: '#94a3b8', label: 'False Alarm',  icon: '⚠️' },
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥', fire: '🔥',
  drowning: '🌊', fall: '⬇️', assault: '⚠️', other: '📋',
};

const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'inc-demo-1',
    incident_number: 'INC-2026-901',
    type: 'accident',
    severity: 'critical',
    status: 'reported',
    latitude: 28.4595,
    longitude: 77.0266,
    address: 'NH-48 Expressway Km 142 near Cyber Hub',
    landmark: 'Highway Flyover Junction',
    description: 'Automatic vehicle collision alert. Cabin pressure airbag shockwave detected.',
    reporter_name: 'Rahul Sharma (ABDM Verified)',
    reporter_phone: '+91 98765 43210',
    responder_name: 'Vikram Singh',
    hospital_name: 'City Emergency & Multi-Specialty Hospital',
    ambulance_reg: 'HR-26-EQ-1008',
    ai_crash_detected: true,
    ai_severity_score: 9,
    created_at: new Date().toISOString(),
    resolved_at: null,
    is_demo: true,
  },
  {
    id: 'inc-demo-2',
    incident_number: 'INC-2026-902',
    type: 'cardiac',
    severity: 'critical',
    status: 'assigned',
    latitude: 28.4322,
    longitude: 77.0890,
    address: 'Sector 56 Metro Station Gate 2',
    landmark: 'Commercial Complex Entrance',
    description: 'Smartwatch BLE GATT vitals reported cardiac arrhythmia (>160 BPM).',
    reporter_name: 'Priya Verma',
    reporter_phone: '+91 98112 33445',
    responder_name: 'Manish Verma',
    hospital_name: 'Max Super Specialty Hospital',
    ambulance_reg: 'HR-26-EQ-2045',
    ai_crash_detected: true,
    ai_severity_score: 8,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    resolved_at: null,
    is_demo: true,
  },
  {
    id: 'inc-demo-3',
    incident_number: 'INC-2026-903',
    type: 'medical',
    severity: 'moderate',
    status: 'en_route',
    latitude: 28.4411,
    longitude: 77.0988,
    address: 'Golf Course Road, Opposite Horizon Center',
    landmark: 'Horizon Center Office Park',
    description: 'Asthma respiratory distress emergency SOS request.',
    reporter_name: 'Anil Kumar',
    reporter_phone: '+91 99100 88776',
    responder_name: 'Rajesh Yadav',
    hospital_name: 'Fortis Memorial Research Institute',
    ambulance_reg: 'HR-26-EQ-3099',
    ai_crash_detected: false,
    ai_severity_score: 5,
    created_at: new Date(Date.now() - 40 * 60000).toISOString(),
    resolved_at: null,
    is_demo: true,
  },
];

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function IncidentDrawer({ incident, onClose, onStatusUpdate }: {
  incident: Incident;
  onClose: () => void;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>(incident.timeline || []);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    if (!incident.is_demo) {
      apiFetch(`/api/incidents/${incident.id}/timeline`)
        .then(d => setTimeline(d.data || []))
        .catch(() => {});
    }
  }, [incident.id]);

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      if (!incident.is_demo) {
        await apiFetch(`/api/incidents/${incident.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus, notes: `Status updated to ${newStatus} by admin` }),
        });
      }
      onStatusUpdate(incident.id, newStatus);
      setNewStatus('');
    } catch {
      onStatusUpdate(incident.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
  const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 540, height: '100%', overflowY: 'auto', background: '#111827', borderLeft: '1px solid #1e293b' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: '#111827', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>{TYPE_ICON[incident.type] || '📋'}</span>
              <div>
                <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{incident.incident_number}</p>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', textTransform: 'capitalize' }}>{incident.type} Emergency</h2>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Close
            </button>
          </div>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.text }}>{sev.label}</span>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${stat.color}20`, border: `1px solid ${stat.color}40`, color: stat.color }}>{stat.icon} {stat.label}</span>
            {incident.ai_crash_detected && (
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                🤖 AI Crash Verified {incident.ai_severity_score != null ? `· Score ${incident.ai_severity_score}/10` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { icon: <MapPin size={14} />, label: 'Location', value: incident.address || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}` },
            { icon: <Clock size={14} />, label: 'Reported', value: timeAgo(incident.created_at) },
            { icon: <User size={14} />, label: 'Reporter', value: incident.reporter_name || '—' },
            { icon: <Activity size={14} />, label: 'Phone', value: incident.reporter_phone || '—' },
            { icon: <Ambulance size={14} />, label: 'Ambulance', value: incident.ambulance_reg || 'HR-26-EQ-1008 (Assigned)' },
            { icon: <Hospital size={14} />, label: 'Hospital', value: incident.hospital_name || 'City Emergency Hospital' },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                {item.icon} {item.label}
              </p>
              <p style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, wordBreak: 'break-word' }}>{item.value}</p>
            </div>
          ))}
          {incident.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Description</p>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{incident.description}</p>
            </div>
          )}
        </div>

        {/* Status update */}
        {!['resolved','cancelled','false_alarm'].includes(incident.status) && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Update Status</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 13 }}>
                <option value="">Select new status…</option>
                {['assigned','en_route','arrived','transporting','resolved','cancelled','false_alarm'].map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                ))}
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updating}
                style={{ padding: '9px 18px', borderRadius: 10, background: newStatus ? '#ef4444' : '#1e293b', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: newStatus ? 'pointer' : 'not-allowed', opacity: updating ? 0.6 : 1 }}>
                {updating ? '…' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filtered, setFiltered] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/incidents?limit=100&offset=0');
      const loaded = data.data || [];
      setIncidents(loaded.length > 0 ? loaded : DEMO_INCIDENTS);
    } catch {
      setIncidents(DEMO_INCIDENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    let list = [...incidents];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.incident_number?.toLowerCase().includes(q) ||
        i.type?.toLowerCase().includes(q) ||
        i.address?.toLowerCase().includes(q) ||
        i.reporter_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus) list = list.filter(i => i.status === filterStatus);
    if (filterSeverity) list = list.filter(i => i.severity === filterSeverity);
    if (filterType) list = list.filter(i => i.type === filterType);
    setFiltered(list);
  }, [incidents, search, filterStatus, filterSeverity, filterType]);

  const handleStatusUpdate = (id: string, status: string) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  const active = incidents.filter(i => !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const critical = incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const aiDetected = incidents.filter(i => i.ai_crash_detected).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '24px 28px 60px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ padding: 8, borderRadius: 10, background: '#111827', border: '1px solid #1e293b', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                <AlertTriangle size={24} color="#ef4444" /> Emergency Incident Logs
              </h1>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
                Realtime incoming alert history & response tracking ({incidents.length} total logged)
              </p>
            </div>
          </div>
          <button
            onClick={fetchIncidents}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#111827', border: '1px solid #1e293b', borderRadius: 10, color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Active Alerts', value: active, color: '#ef4444', icon: <Radio size={16} /> },
            { label: 'Critical Trauma', value: critical, color: '#f97316', icon: <AlertTriangle size={16} /> },
            { label: 'Resolved Cases', value: resolved, color: '#22c55e', icon: <CheckCircle2 size={16} /> },
            { label: 'AI Crash Verified', value: aiDetected, color: '#a855f7', icon: <Zap size={16} /> },
          ].map(s => (
            <div key={s.label} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{s.label}</span>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, margin: 0 }}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by incident number, location, or patient..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#111827', border: '1px solid #1e293b', borderRadius: 10, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, border: '1px solid #1e293b', overflow: 'hidden', background: '#111827' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>Loading incident telemetry logs...</div>
        ) : (
          filtered.map((incident, idx) => {
            const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
            const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };

            return (
              <div
                key={incident.id}
                onClick={() => setSelected(incident)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderBottom: idx < filtered.length - 1 ? '1px solid #1e293b' : 'none',
                  cursor: 'pointer', gap: 12,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ fontSize: 24 }}>{TYPE_ICON[incident.type] || '📋'}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', fontFamily: 'monospace' }}>{incident.incident_number}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.text }}>{sev.label}</span>
                      {incident.is_demo && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640' }}>DEMO RECORD</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {incident.address || `${incident.latitude}, ${incident.longitude}`}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, shrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: `${stat.color}20`, color: stat.color, border: `1px solid ${stat.color}40` }}>
                    {stat.icon} {stat.label}
                  </span>
                  <ChevronRight size={16} color="#64748b" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <IncidentDrawer
          incident={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}
