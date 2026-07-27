'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AlertTriangle, Clock, CheckCircle2, XCircle, ChevronRight,
  Search, Filter, RefreshCw, X, Radio, Ambulance, Hospital,
  MapPin, User, Zap, Activity, TrendingUp, ArrowLeft
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
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
}

interface TimelineEvent {
  id: string;
  event_type: string;
  actor_name: string | null;
  actor_role: string;
  description: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// API fetch helper
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Timeline Drawer
// ─────────────────────────────────────────────────────────────
function IncidentDrawer({ incident, onClose, onStatusUpdate }: {
  incident: Incident;
  onClose: () => void;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>(incident.timeline || []);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    apiFetch(`/api/incidents/${incident.id}/timeline`)
      .then(d => setTimeline(d.data || []))
      .catch(() => {});
  }, [incident.id]);

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/incidents/${incident.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, notes: `Status updated to ${newStatus} by admin` }),
      });
      onStatusUpdate(incident.id, newStatus);
      setNewStatus('');
    } catch (e) {
      alert('Status update failed');
    } finally {
      setUpdating(false);
    }
  };

  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
  const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 540, height: '100%', overflowY: 'auto', background: 'var(--surface-1)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface-1)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>{TYPE_ICON[incident.type] || '📋'}</span>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>{incident.incident_number}</p>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{incident.type} Emergency</h2>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Close
            </button>
          </div>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.text }}>{sev.label}</span>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${stat.color}20`, border: `1px solid ${stat.color}40`, color: stat.color }}>{stat.icon} {stat.label}</span>
            {incident.ai_crash_detected && (
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                🤖 AI Detected {incident.ai_severity_score != null ? `· Score ${incident.ai_severity_score}/10` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { icon: <MapPin size={14} />, label: 'Location', value: incident.address || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}` },
            { icon: <Clock size={14} />, label: 'Reported', value: timeAgo(incident.created_at) },
            { icon: <User size={14} />, label: 'Reporter', value: incident.reporter_name || '—' },
            { icon: <Activity size={14} />, label: 'Phone', value: incident.reporter_phone || '—' },
            { icon: <Ambulance size={14} />, label: 'Ambulance', value: incident.ambulance_reg || 'Not assigned' },
            { icon: <Hospital size={14} />, label: 'Hospital', value: incident.hospital_name || 'Not assigned' },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.icon} {item.label}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>{item.value}</p>
            </div>
          ))}
          {incident.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Description</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{incident.description}</p>
            </div>
          )}
        </div>

        {/* Status update */}
        {!['resolved','cancelled','false_alarm'].includes(incident.status) && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Update Status</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">Select new status…</option>
                {['assigned','en_route','arrived','transporting','resolved','cancelled','false_alarm'].map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                ))}
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updating}
                style={{ padding: '9px 18px', borderRadius: 10, background: newStatus ? 'var(--accent)' : 'var(--surface-2)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: newStatus ? 'pointer' : 'not-allowed', opacity: updating ? 0.6 : 1 }}>
                {updating ? '…' : 'Update'}
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Timeline</p>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No events recorded yet</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
              {timeline.map((ev, i) => (
                <div key={ev.id || i} style={{ position: 'relative', paddingLeft: 44, marginBottom: 20 }}>
                  <div style={{ position: 'absolute', left: 8, top: 4, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface-2)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>{ev.event_type.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(ev.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ev.description}</p>
                    {ev.actor_name && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>by {ev.actor_name} ({ev.actor_role})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filtered, setFiltered] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await apiFetch('/api/incidents?limit=100&offset=0');
      setIncidents(data.data || []);
    } catch {
      // Silently handle — token may not be set in dev
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply filters
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

  // Socket.io — live updates
  useEffect(() => {
    fetchIncidents();

    const socket = io(WS, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('incident:new', (incident: Incident) => {
      setIncidents(prev => [incident, ...prev]);
      setNewIds(prev => new Set([...Array.from(prev), incident.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(Array.from(prev)); n.delete(incident.id); return n; }), 5000);
    });

    socket.on('incident:status', ({ incidentId, status }: { incidentId: string; status: string }) => {
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    });

    return () => { socket.disconnect(); };
  }, [fetchIncidents]);

  const handleStatusUpdate = (id: string, status: string) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  // Stats
  const active = incidents.filter(i => !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const critical = incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const aiDetected = incidents.filter(i => i.ai_crash_detected).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      {/* Page header */}
      <div style={{ padding: '28px 28px 0', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={24} color="var(--accent)" /> Incident Log
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Real-time emergency incident management — {incidents.length} total
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchIncidents(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Active', value: active, color: '#ef4444', icon: <Radio size={16} /> },
            { label: 'Critical', value: critical, color: '#f97316', icon: <AlertTriangle size={16} /> },
            { label: 'Resolved', value: resolved, color: '#22c55e', icon: <CheckCircle2 size={16} /> },
            { label: 'AI Detected', value: aiDetected, color: '#a855f7', icon: <Zap size={16} /> },
          ].map(s => (
            <div key={s.label} className="glass-card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</span>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 28px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by number, type, address, reporter…"
            style={{ width: '100%', padding: '9px 12px 9px 36px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {[
          { label: 'Status', value: filterStatus, set: setFilterStatus, options: Object.keys(STATUS_CONFIG) },
          { label: 'Severity', value: filterSeverity, set: setFilterSeverity, options: ['critical','moderate','minor'] },
          { label: 'Type', value: filterType, set: setFilterType, options: Object.keys(TYPE_ICON) },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
            style={{ padding: '9px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: f.value ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            <option value="">All {f.label}</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {(search || filterStatus || filterSeverity || filterType) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterSeverity(''); setFilterType(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ padding: '0 28px' }}>
        <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-1)' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 90px 80px 100px 1fr 160px 110px 90px', padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', gap: 8 }}>
            {['Incident #', 'Type', 'Severity', 'Status', 'Location', 'Reporter', 'Time', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading incidents…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>No incidents found</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {incidents.length > 0 ? 'Try adjusting your filters' : 'No incidents in the system yet'}
              </p>
            </div>
          ) : (
            filtered.map((incident, idx) => {
              const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
              const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };
              const isNew = newIds.has(incident.id);

              return (
                <div
                  key={incident.id}
                  onClick={() => setSelected(incident)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 90px 80px 100px 1fr 160px 110px 90px',
                    padding: '13px 16px',
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    gap: 8,
                    alignItems: 'center',
                    transition: 'background 0.15s',
                    background: isNew ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isNew ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isNew ? 'rgba(239,68,68,0.06)' : 'transparent')}
                >
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                      {isNew && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', marginRight: 5, animation: 'pulse 1s ease infinite' }} />}
                      {incident.incident_number || incident.id.slice(0, 8)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICON[incident.type] || '📋'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>{incident.type}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.text }}>
                    {sev.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: `${stat.color}15`, border: `1px solid ${stat.color}30`, color: stat.color }}>
                    {stat.icon} {stat.label}
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    📍 {incident.address || `${incident.latitude?.toFixed(3)}, ${incident.longitude?.toFixed(3)}`}
                  </p>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{incident.reporter_name || '—'}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{incident.reporter_phone || ''}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(incident.created_at)}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, textAlign: 'right' }}>
          Showing {filtered.length} of {incidents.length} incidents
        </p>
      </div>

      {/* Drawer */}
      {selected && (
        <IncidentDrawer
          incident={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
