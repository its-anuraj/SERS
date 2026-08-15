'use client';

/**
 * SERS Admin — Incident History & Log Page (100% Real Live Database Data)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Clock, CheckCircle2,
  Search, RefreshCw, X, Radio, Ambulance, Hospital,
  MapPin, User, Zap, Activity, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'Critical' },
  moderate: { bg: '#fff7ed', border: '#ffedd5', text: '#ea580c', label: 'Moderate' },
  minor:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', label: 'Minor' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  reported:     { color: '#d97706', label: 'Reported',     icon: '📡' },
  assigned:     { color: '#2563eb', label: 'Assigned',     icon: '🔗' },
  en_route:     { color: '#0891b2', label: 'En Route',     icon: '🚑' },
  arrived:      { color: '#9333ea', label: 'Arrived',      icon: '📍' },
  transporting: { color: '#ea580c', label: 'Transporting', icon: '🏥' },
  resolved:     { color: '#16a34a', label: 'Resolved',     icon: '✅' },
  cancelled:    { color: '#64748b', label: 'Cancelled',    icon: '❌' },
  false_alarm:  { color: '#64748b', label: 'False Alarm',  icon: '⚠️' },
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥', fire: '🔥',
  drowning: '🌊', fall: '⬇️', assault: '⚠️', other: '📋',
};

function timeAgo(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60)  return `${Math.max(1, secs)}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/incidents/${incident.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, notes: `Status updated to ${newStatus} by command center` }),
      });
      onStatusUpdate(incident.id, newStatus);
      setNewStatus('');
    } catch (e: any) {
      alert('Failed to update incident status: ' + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
  const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
      <div className="ml-auto w-full max-w-lg h-full overflow-y-auto bg-white border-l border-slate-200 shadow-2xl p-6 space-y-6"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{TYPE_ICON[incident.type] || '📋'}</span>
            <div>
              <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">{incident.incident_number}</p>
              <h2 className="text-xl font-extrabold text-slate-900 capitalize">{incident.type} Emergency</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold border" style={{ background: sev.bg, borderColor: sev.border, color: sev.text }}>
            {sev.label}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold border" style={{ background: `${stat.color}15`, borderColor: `${stat.color}40`, color: stat.color }}>
            {stat.icon} {stat.label}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 font-medium">
          <div>
            <p className="text-slate-500 font-bold mb-1 flex items-center gap-1"><MapPin size={12} /> Location</p>
            <p className="font-bold text-slate-900">{incident.address || `${incident.latitude}, ${incident.longitude}`}</p>
          </div>
          <div>
            <p className="text-slate-500 font-bold mb-1 flex items-center gap-1"><Clock size={12} /> Reported</p>
            <p className="font-bold text-slate-900">{timeAgo(incident.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-bold mb-1 flex items-center gap-1"><User size={12} /> Reporter</p>
            <p className="font-bold text-slate-900">{incident.reporter_name || 'System / Auto SOS'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-bold mb-1 flex items-center gap-1"><Activity size={12} /> Contact</p>
            <p className="font-bold text-slate-900">{incident.reporter_phone || 'N/A'}</p>
          </div>
        </div>

        {incident.description && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <p className="text-slate-500 font-bold mb-1">Incident Description</p>
            <p className="text-slate-800 font-medium">{incident.description}</p>
          </div>
        )}

        {/* Status Update */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Update Emergency Status</p>
          <div className="flex gap-2">
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900">
              <option value="">Select status…</option>
              {['assigned','en_route','arrived','transporting','resolved','cancelled','false_alarm'].map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
            <button
              onClick={handleStatusUpdate}
              disabled={!newStatus || updating}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs cursor-pointer">
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filtered, setFiltered] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/incidents?limit=100&offset=0');
      setIncidents(data.data || []);
    } catch (e) {
      console.error('Incidents fetch error:', e);
      setIncidents([]);
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
        i.landmark?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [incidents, search]);

  const handleStatusUpdate = (id: string, status: string) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  const active = incidents.filter(i => !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const critical = incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const aiDetected = incidents.filter(i => i.ai_crash_detected).length;

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={24} className="text-red-600" /> Emergency Incident Logs
              </h1>
              <p className="text-xs text-slate-500 font-semibold">Realtime incoming alert history & response tracking ({incidents.length} total in database)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchIncidents}
              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('sers_token');
                localStorage.removeItem('sers_user');
                window.location.href = '/login';
              }}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <X size={14} /> Log Out
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Alerts', value: active, color: '#dc2626', icon: <Radio size={16} /> },
            { label: 'Critical Trauma', value: critical, color: '#ea580c', icon: <AlertTriangle size={16} /> },
            { label: 'Resolved Cases', value: resolved, color: '#16a34a', icon: <CheckCircle2 size={16} /> },
            { label: 'AI Crash Verified', value: aiDetected, color: '#9333ea', icon: <Zap size={16} /> },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by incident number, location, or reporter..."
            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 focus:outline-none focus:border-red-500 shadow-xs font-medium"
          />
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 text-center text-slate-500 font-semibold">Loading incident telemetry logs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold">
              <p className="text-base text-slate-700 font-black">No emergency incidents recorded</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Realtime logs will be automatically registered when live citizen emergency calls or vehicle crash sensor alerts arrive.</p>
            </div>
          ) : (
            filtered.map((incident) => {
              const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;
              const stat = STATUS_CONFIG[incident.status] || { color: '#64748b', label: incident.status, icon: '?' };

              return (
                <div
                  key={incident.id}
                  onClick={() => setSelected(incident)}
                  className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{TYPE_ICON[incident.type] || '📋'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-extrabold text-slate-900">{incident.incident_number}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border" style={{ background: sev.bg, borderColor: sev.border, color: sev.text }}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-bold flex items-center gap-1 truncate">
                        <MapPin size={12} className="text-slate-400" /> {incident.address || `${incident.latitude}, ${incident.longitude}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full border" style={{ background: `${stat.color}15`, borderColor: `${stat.color}30`, color: stat.color }}>
                      {stat.icon} {stat.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
