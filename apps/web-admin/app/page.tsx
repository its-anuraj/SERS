'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Activity, Ambulance, Hospital, Zap,
  MapPin, Clock, ChevronRight, Radio, TrendingUp, Volume2, VolumeX,
  Shield, Menu, X, BarChart3, RefreshCw, LogOut, LogIn
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const LiveMap = dynamic(() => import('../components/LiveMap'), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:3000';

const PIE_COLORS: Record<string, string> = {
  accident: '#e11d48', cardiac: '#f59e0b', medical: '#3b82f6',
  fire: '#ea580c', drowning: '#0891b2', fall: '#8b5cf6',
  assault: '#ec4899', other: '#64748b',
};

async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

const severityBadge = (severity: string) => {
  const map: Record<string, string> = {
    critical: 'badge-critical', moderate: 'badge-moderate',
    minor: 'badge-minor', unknown: 'badge-unknown',
  };
  return map[severity] || 'badge-unknown';
};

const statusTag = (status: string) => {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    reported:     { label: 'REPORTED',     bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    assigned:     { label: 'DISPATCHED',   bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    en_route:     { label: 'EN ROUTE',     bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    arrived:      { label: 'AT SCENE',     bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    transporting: { label: 'TRANSPORTING', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    resolved:     { label: 'RESOLVED',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    cancelled:    { label: 'CANCELLED',    bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
    false_alarm:  { label: 'FALSE ALARM',  bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  };
  const cfg = map[status] || { label: (status || 'UNKNOWN').toUpperCase(), bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  return (
    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border} tracking-wide`}>
      ● {cfg.label}
    </span>
  );
};

const incidentTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    accident: '🚗', cardiac: '❤️', medical: '🏥', fire: '🔥',
    drowning: '🌊', fall: '⬇️', assault: '⚠️', other: '📋',
  };
  return icons[type] || '📋';
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

function StatCard({ label, value, sub, icon: Icon, color, bgGradient, pulse, loading }: {
  label: string; value: string | number | null; sub?: string; icon: any;
  color: string; bgGradient: string; pulse?: string; loading?: boolean;
}) {
  return (
    <div className={`glass-card glass-card-hover p-5 bg-gradient-to-br ${bgGradient} border border-slate-200/80`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pulse || ''}`}
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={19} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{value ?? '—'}</p>
          {sub && <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1">{sub}</p>}
        </div>
      )}
    </div>
  );
}

function IncidentRow({ incident, onClick }: { incident: any; onClick: () => void }) {
  const borderColor = incident.severity === 'critical' ? '#e11d48'
    : incident.severity === 'moderate' ? '#ea580c' : '#059669';

  return (
    <div
      onClick={onClick}
      className="glass-card glass-card-hover p-4 cursor-pointer group transition-all bg-white border border-slate-200/80 relative overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl shrink-0">
            {incidentTypeIcon(incident.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {incident.incident_number || incident.id?.slice(0, 12)}
              </span>
              <span className={severityBadge(incident.severity)}>
                {incident.severity?.toUpperCase()}
              </span>
            </div>

            <p className="text-sm font-extrabold text-slate-900 truncate group-hover:text-rose-600 transition-colors">
              {incident.address || incident.landmark || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}`}
            </p>

            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              {statusTag(incident.status)}
              {incident.ai_crash_detected && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  ⚡ AI CRASH DETECTED
                </span>
              )}
              {incident.ai_severity_score && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  Score: {incident.ai_severity_score}/10
                </span>
              )}
              <span className="text-xs text-slate-500 font-bold ml-auto flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                {incident.created_at ? new Date(incident.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-900 transition-colors shrink-0 mt-3" />
      </div>
    </div>
  );
}

const navItems = [
  { icon: Activity, label: 'Command Center', href: '/', active: true },
  { icon: MapPin, label: 'Live Map', href: '/map' },
  { icon: Ambulance, label: 'Fleet', href: '/fleet' },
  { icon: Hospital, label: 'Hospitals', href: '/hospitals' },
  { icon: AlertTriangle, label: 'Incidents', href: '/incidents' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
];

function Sidebar({ open, onClose, activeCount }: { open: boolean; onClose: () => void; activeCount: number }) {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('sers_user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sers_token');
    localStorage.removeItem('sers_refresh_token');
    localStorage.removeItem('sers_user');
    window.location.href = '/login';
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-full z-40 w-64 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 bg-white border-r border-slate-200/90 shadow-sm`}>

        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center status-pulse-red bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/25">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-black text-slate-900 text-lg leading-none tracking-tight">SERS</p>
              <p className="text-xs text-slate-500 font-bold mt-0.5">Emergency Command</p>
            </div>
          </div>
        </div>

        {/* Gateway Status Badge */}
        <div className="mx-4 mt-4 px-3.5 py-2.5 rounded-xl flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 status-pulse-green" />
          <span className="text-xs text-emerald-900 font-black">SERS Hospital Node Connected</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 mt-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group font-extrabold text-sm
                ${item.active
                  ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
              <item.icon size={18} className={item.active ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-700'} />
              <span>{item.label}</span>
              {item.label === 'Command Center' && activeCount > 0 && (
                <span className="ml-auto text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-black">
                  {activeCount}
                </span>
              )}
            </a>
          ))}

          {/* Log Out Button below Analytics */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group font-extrabold text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer">
              <LogOut size={18} className="text-rose-500 group-hover:text-rose-700" />
              <span>Log Out</span>
            </button>
          </div>
        </nav>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-xs">
              <Shield size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {currentUser?.name || 'Hospital Triage Staff'}
              </p>
              <p className="text-[11px] text-slate-500 font-bold truncate">
                {currentUser?.hospital || (currentUser?.role ? `${currentUser.role.replace('_', ' ').toUpperCase()}` : 'Level-1 Emergency Node')}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [newAlertCount, setNewAlertCount]     = useState(0);
  const [isMounted, setIsMounted]             = useState(false);
  const [soundEnabled, setSoundEnabled]       = useState(true);

  const [stats, setStats]         = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [typeData, setTypeData]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryRes, incidentsRes, hourlyRes, typeRes, hospRes, ambRes] = await Promise.allSettled([
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/incidents?limit=50'),
        apiFetch('/api/analytics/incidents-by-hour'),
        apiFetch('/api/analytics/incidents-by-type'),
        apiFetch('/api/hospitals?limit=50'),
        apiFetch('/api/ambulances'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
        setStats(summaryRes.value.data);
      }

      if (incidentsRes.status === 'fulfilled' && incidentsRes.value?.success) {
        setIncidents(incidentsRes.value.data || []);
      }

      if (hospRes.status === 'fulfilled' && hospRes.value?.success) {
        setHospitals(hospRes.value.data || []);
      }

      if (ambRes.status === 'fulfilled' && ambRes.value?.success) {
        setAmbulances(ambRes.value.data || []);
      }

      if (hourlyRes.status === 'fulfilled' && hourlyRes.value?.success) {
        const full = Array.from({ length: 24 }, (_, i) => {
          const found = hourlyRes.value.data?.find((d: any) => parseInt(d.hour) === i);
          return { hour: `${String(i).padStart(2, '0')}:00`, incidents: found ? parseInt(found.count) : 0 };
        });
        setHourlyData(full);
      }

      if (typeRes.status === 'fulfilled' && typeRes.value?.success && typeRes.value.data?.length > 0) {
        setTypeData(typeRes.value.data.map((d: any) => ({
          name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
          value: parseInt(d.count),
          color: PIE_COLORS[d.type] || '#64748b',
        })));
      } else {
        setTypeData([]);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const socket: Socket = io(WS, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('incident:new', (newInc) => {
      setIncidents(prev => [newInc, ...prev.filter(i => i.id !== newInc.id)]);
      setNewAlertCount(n => n + 1);
    });
    socket.on('incident:status', ({ incidentId, status }) => {
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    });

    return () => { socket.disconnect(); };
  }, []);

  const dispatchAmbulance = async (incId: string) => {
    try {
      await apiFetch(`/api/incidents/${incId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Dispatched from Hospital Command Center' }),
      });
      setIncidents(prev => prev.map(i => i.id === incId ? { ...i, status: 'assigned' } : i));
      if (selectedIncident?.id === incId) {
        setSelectedIncident((prev: any) => prev ? { ...prev, status: 'assigned' } : null);
      }
      await fetchAll();
    } catch (e) {
      console.error('Dispatch error:', e);
    }
  };

  const activeIncidents = incidents.filter(i => !['resolved', 'cancelled', 'false_alarm'].includes(i.status));
  const availableIcuBeds = hospitals.reduce((acc, h) => acc + (parseInt(h.icu_beds_available) || 0), 0);
  const activeDispatchedAmbulances = ambulances.filter(a => ['en_route', 'dispatched', 'transporting', 'on_scene'].includes(a.status)).length;
  const avgResponse = stats?.incidents?.avg_response_mins ? `${stats.incidents.avg_response_mins} min` : '6.5 min';

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 flex font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeCount={activeIncidents.length} />

      <main className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 shadow-xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900">
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-base font-black text-slate-900 tracking-tight">Hospital Emergency Command Center</h1>
              <p className="text-[11px] text-slate-500 font-bold">Realtime Autonomous Emergency Dispatch System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Socket status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80">
              <Radio size={14} className={socketConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'} />
              <span className="text-xs text-slate-700 font-extrabold hidden sm:inline">
                {socketConnected ? 'WebSocket Online' : 'Connecting API...'}
              </span>
            </div>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition-colors">
              {soundEnabled ? <Volume2 size={16} className="text-amber-600" /> : <VolumeX size={16} />}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchAll}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Active Emergency Alerts"
              value={activeIncidents.length}
              sub={`${incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length} Critical Severity`}
              icon={AlertTriangle}
              color="#e11d48"
              bgGradient="from-rose-50/50 to-white"
              pulse={activeIncidents.length > 0 ? "status-pulse-red" : undefined}
              loading={loading}
            />
            <StatCard
              label="Available ICU Beds"
              value={availableIcuBeds}
              sub={`🏥 Across ${hospitals.length} Network Hospitals`}
              icon={Hospital}
              color="#059669"
              bgGradient="from-emerald-50/50 to-white"
              loading={loading}
            />
            <StatCard
              label="Ambulances Dispatched"
              value={activeDispatchedAmbulances}
              sub={`🚑 ${ambulances.length} Units in Fleet`}
              icon={Ambulance}
              color="#3b82f6"
              bgGradient="from-blue-50/50 to-white"
              loading={loading}
            />
          </div>

          {/* Main Grid: Incident Feed + Map Radar */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Live Incidents Stream */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
                  <Activity size={16} className="text-rose-600" />
                  Live Incident Stream
                </h2>
                <span className="text-[11px] font-mono font-extrabold text-slate-600 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                  {incidents.length} Total Logged
                </span>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {incidents.length === 0 ? (
                  <div className="glass-card p-10 text-center text-slate-500 font-bold bg-white border border-slate-200 rounded-2xl">
                    <p className="text-sm font-black text-slate-800">No active emergency incidents</p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Incoming SOS alerts, AI crash detections, and medical distress calls will stream here automatically.</p>
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <IncidentRow
                      key={inc.id}
                      incident={inc}
                      onClick={() => setSelectedIncident(inc)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Live Map Dispatch Radar */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="glass-card p-4 h-[580px] flex flex-col bg-white border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <MapPin size={17} className="text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Live Regional Dispatch Radar</h3>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-black">
                    Realtime PostGIS Telemetry
                  </span>
                </div>
                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200">
                  {isMounted && (
                    <LiveMap
                      incidents={incidents}
                      onSelectIncident={(inc) => setSelectedIncident(inc)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Charts Row */}
          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-8 glass-card p-5 bg-white border border-slate-200/90 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-tight">
                <TrendingUp size={17} className="text-cyan-600" />
                24-Hour Emergency Distribution
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={11} fontWeight={700} />
                    <YAxis stroke="#64748b" fontSize={11} fontWeight={700} />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, color: '#0f172a', fontWeight: 800, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }} />
                    <Area type="monotone" dataKey="incidents" stroke="#e11d48" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-4 glass-card p-5 bg-white border border-slate-200/90 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-tight">Incident Category Breakup</h3>
              <div className="h-48 flex items-center justify-center">
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={4} label>
                        {typeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, color: '#0f172a', fontWeight: 800 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400 font-bold">No incident categories recorded yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card max-w-xl w-full p-6 space-y-5 bg-white border border-slate-300 shadow-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{incidentTypeIcon(selectedIncident.type)}</span>
                  <h3 className="text-lg font-black text-slate-900">
                    {selectedIncident.incident_number || selectedIncident.id}
                  </h3>
                  <span className={severityBadge(selectedIncident.severity)}>
                    {selectedIncident.severity?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Reported at {new Date(selectedIncident.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Location & Profile */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Incident Location & Details</p>
              <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin size={16} className="text-rose-600 shrink-0" />
                {selectedIncident.address || selectedIncident.landmark || `${selectedIncident.latitude}, ${selectedIncident.longitude}`}
              </p>
              {selectedIncident.description && (
                <p className="text-xs text-slate-700 font-medium pt-1">
                  {selectedIncident.description}
                </p>
              )}
            </div>

            {/* Status & Telemetry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold">Status</p>
                <p className="text-sm font-black text-slate-900 uppercase">{selectedIncident.status?.replace('_', ' ')}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold">AI Severity Rating</p>
                <p className="text-sm font-black text-rose-700">{selectedIncident.ai_severity_score ? `${selectedIncident.ai_severity_score}/10` : 'Verified Alert'}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => dispatchAmbulance(selectedIncident.id)}
                disabled={selectedIncident.status === 'assigned' || selectedIncident.status === 'en_route'}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  selectedIncident.status === 'assigned' || selectedIncident.status === 'en_route'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200 cursor-default'
                    : 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-md shadow-rose-600/20'
                }`}>
                <Ambulance size={16} />
                {selectedIncident.status === 'assigned' || selectedIncident.status === 'en_route' ? 'Ambulance Dispatched' : 'Dispatch Nearest Ambulance'}
              </button>
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-sm border border-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
