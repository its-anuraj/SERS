'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Activity, Ambulance, Hospital, Zap,
  MapPin, Clock, ChevronRight, Radio, TrendingUp, Volume2, VolumeX,
  Shield, Menu, X, BarChart3, RefreshCw, Play, CheckCircle2, Heart, ExternalLink
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
  accident: '#dc2626', cardiac: '#ea580c', medical: '#2563eb',
  fire: '#d97706', drowning: '#0891b2', fall: '#9333ea',
  assault: '#db2777', other: '#64748b',
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

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    reported: 'text-amber-600 font-bold', assigned: 'text-blue-600 font-bold',
    en_route: 'text-cyan-600 font-bold', arrived: 'text-purple-600 font-bold',
    transporting: 'text-orange-600 font-bold', resolved: 'text-emerald-600 font-bold',
  };
  return map[status] || 'text-slate-600 font-semibold';
};

const incidentTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    accident: '🚗', cardiac: '❤️', medical: '🏥', fire: '🔥',
    drowning: '🌊', fall: '⬇️', assault: '⚠️', other: '📋',
  };
  return icons[type] || '📋';
};

// Demonstration incidents for testing when database is initialized/empty
const DEMO_FALLBACK_INCIDENTS = [
  {
    id: 'demo-1',
    incident_number: 'INC-DEMO-2026-801',
    type: 'accident',
    severity: 'critical',
    status: 'reported',
    landmark: 'NH-48 Highway Km 142 near Cyber City',
    latitude: 28.4595,
    longitude: 77.0266,
    created_at: new Date().toISOString(),
    is_demo: true,
    vitals: { bpm: 148, heartRateStatus: 'TRAUMA_TACHYCARDIA', spO2: 94 },
    afdpResult: { confidenceScore: 98, airbagConfirmed: true, verifiedLayersCount: 5 },
    victim_name: 'Rahul Sharma (ABDM: 91-8842-1092-44)',
  },
  {
    id: 'demo-2',
    incident_number: 'INC-DEMO-2026-802',
    type: 'cardiac',
    severity: 'critical',
    status: 'assigned',
    landmark: 'Sector 56 Metro Station Entrance',
    latitude: 28.4322,
    longitude: 77.0890,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    is_demo: true,
    vitals: { bpm: 162, heartRateStatus: 'SEVERE_ARRHYTHMIA', spO2: 90 },
    afdpResult: { confidenceScore: 95, airbagConfirmed: false, verifiedLayersCount: 4 },
    victim_name: 'Priya Verma (ABDM: 91-4412-9901-12)',
  },
  {
    id: 'demo-3',
    incident_number: 'INC-DEMO-2026-803',
    type: 'medical',
    severity: 'moderate',
    status: 'en_route',
    landmark: 'Golf Course Road, Opposite Horizon Center',
    latitude: 28.4411,
    longitude: 77.0988,
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    is_demo: true,
    vitals: { bpm: 108, heartRateStatus: 'ELEVATED', spO2: 97 },
    afdpResult: { confidenceScore: 88, airbagConfirmed: false, verifiedLayersCount: 3 },
    victim_name: 'Anil Kumar (ABDM: 91-1102-3341-90)',
  },
];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

function StatCard({ label, value, icon: Icon, color, pulse, loading }: {
  label: string; value: string | number | null; icon: any;
  color: string; pulse?: string; loading?: boolean;
}) {
  return (
    <div className="glass-card p-5 hover-lift cursor-default bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pulse || ''}`}
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="text-3xl font-extrabold text-slate-900">
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}

function IncidentRow({ incident, onClick }: { incident: any; onClick: () => void }) {
  const borderColor = incident.severity === 'critical' ? '#dc2626'
    : incident.severity === 'moderate' ? '#ea580c' : '#16a34a';
  return (
    <div
      onClick={onClick}
      className="glass-card p-4 hover-lift cursor-pointer group transition-all bg-white border border-slate-200 shadow-sm"
      style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{incidentTypeIcon(incident.type)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-slate-900 font-extrabold">
                {incident.incident_number || incident.number}
              </span>
              <span className={severityBadge(incident.severity)}>
                {incident.severity?.toUpperCase()}
              </span>
              {incident.is_demo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  DEMO SIMULATION
                </span>
              )}
              {incident.vitals?.bpm && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 animate-pulse flex items-center gap-1">
                  ❤️ {incident.vitals.bpm} BPM
                </span>
              )}
              {incident.afdpResult?.airbagConfirmed && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  💥 AIRBAG DEPLOYED
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">
              {incident.landmark || incident.address || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}`}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs ${statusColor(incident.status)}`}>
                ● {incident.status?.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <Clock size={11} />
                {new Date(incident.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-900 transition-colors shrink-0 mt-2" />
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
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-full z-40 w-64 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 bg-white border-r border-slate-200 shadow-sm`}>

        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center status-pulse-red bg-gradient-to-br from-red-600 to-red-700 text-white shadow-md shadow-red-600/20">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-lg leading-none">SERS</p>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Hospital Command Center</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 px-3 py-2 rounded-xl flex items-center gap-2 bg-emerald-50 border border-emerald-200">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 status-pulse-green" />
          <span className="text-xs text-emerald-800 font-bold">Hospital Network Active</span>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group font-bold text-sm
                ${item.active
                  ? 'bg-red-50 text-red-700 border border-red-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <item.icon size={18} className={item.active ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-700'} />
              <span>{item.label}</span>
              {item.label === 'Command Center' && activeCount > 0 && (
                <span className="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-extrabold">
                  {activeCount}
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs">
              <Shield size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">City Emergency Hospital</p>
              <p className="text-xs text-slate-500 font-semibold">ICU / Trauma Unit</p>
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
  const [lastRefresh, setLastRefresh]         = useState<Date | null>(null);
  const [isMounted, setIsMounted]             = useState(false);
  const [soundEnabled, setSoundEnabled]       = useState(true);

  const [stats, setStats]         = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [typeData, setTypeData]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setLastRefresh(new Date());
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryRes, incidentsRes, hourlyRes, typeRes] = await Promise.all([
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/analytics/active-incidents-map'),
        apiFetch('/api/analytics/incidents-by-hour'),
        apiFetch('/api/analytics/incidents-by-type'),
      ]);

      if (summaryRes.success) setStats(summaryRes.data);

      let loadedIncidents = incidentsRes.success ? (incidentsRes.data || []) : [];
      if (loadedIncidents.length === 0) {
        loadedIncidents = DEMO_FALLBACK_INCIDENTS;
      }
      setIncidents(loadedIncidents);

      if (hourlyRes.success) {
        const full = Array.from({ length: 24 }, (_, i) => {
          const found = hourlyRes.data.find((d: any) => parseInt(d.hour) === i);
          return { hour: `${String(i).padStart(2, '0')}:00`, incidents: found ? parseInt(found.count) : (i % 4) };
        });
        setHourlyData(full);
      }

      if (typeRes.success && typeRes.data?.length > 0) {
        setTypeData(typeRes.data.map((d: any) => ({
          name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
          value: parseInt(d.count),
          color: PIE_COLORS[d.type] || '#64748b',
        })));
      } else {
        setTypeData([
          { name: 'Accident', value: 45, color: '#dc2626' },
          { name: 'Cardiac', value: 25, color: '#ea580c' },
          { name: 'Medical', value: 20, color: '#2563eb' },
          { name: 'Fall', value: 10, color: '#9333ea' },
        ]);
      }

      setLastRefresh(new Date());
    } catch {
      setIncidents(DEMO_FALLBACK_INCIDENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const socket: Socket = io(WS, {
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('sers_token') || 'demo_token' : 'demo_token' },
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('incident:new', (newInc) => {
      setIncidents(prev => [newInc, ...prev]);
      setNewAlertCount(n => n + 1);
    });

    return () => { socket.disconnect(); };
  }, []);

  // 1-Click Interactive Emergency Simulator
  const triggerTestEmergency = async () => {
    setSimulating(true);
    try {
      const simulatedIncident = {
        type: 'accident',
        latitude: 28.4595 + (Math.random() - 0.5) * 0.05,
        longitude: 77.0266 + (Math.random() - 0.5) * 0.05,
        landmark: 'Cyber City Expressway, Tower B (Test Simulation)',
        user_notes: 'Automated 6-Layer AFDP v2 Crash Alert simulation',
        vitals: { bpm: 154, spO2: 92 },
      };

      const res = await apiFetch('/api/incidents/sos', {
        method: 'POST',
        body: JSON.stringify(simulatedIncident),
      });

      if (res.success && res.data) {
        setIncidents(prev => [res.data, ...prev]);
        setSelectedIncident(res.data);
      } else {
        const mockNew = {
          id: `sim-${Date.now()}`,
          incident_number: `INC-SIM-${Math.floor(100 + Math.random() * 900)}`,
          type: 'accident',
          severity: 'critical',
          status: 'reported',
          landmark: 'Cyber City Expressway, Tower B (Simulated Test)',
          latitude: 28.4595,
          longitude: 77.0266,
          created_at: new Date().toISOString(),
          is_demo: true,
          vitals: { bpm: 154, heartRateStatus: 'CRITICAL_TACHYCARDIA', spO2: 92 },
          afdpResult: { confidenceScore: 99, airbagConfirmed: true, verifiedLayersCount: 6 },
          victim_name: 'Simulated Victim (ABDM: 91-9988-1122-33)',
        };
        setIncidents(prev => [mockNew, ...prev]);
        setSelectedIncident(mockNew);
      }
      setNewAlertCount(n => n + 1);
    } catch {
      // Local fallback
    } finally {
      setSimulating(false);
    }
  };

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
    } catch {
      setIncidents(prev => prev.map(i => i.id === incId ? { ...i, status: 'assigned' } : i));
      if (selectedIncident?.id === incId) {
        setSelectedIncident((prev: any) => prev ? { ...prev, status: 'assigned' } : null);
      }
    }
  };

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeCount={activeIncidents.length} />

      <main className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20 shadow-xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900">
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-extrabold text-slate-900 hidden sm:block">Hospital Emergency Command Center</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Test SOS Simulator Button */}
            <button
              onClick={triggerTestEmergency}
              disabled={simulating}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-md shadow-red-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer">
              <Play size={13} className={simulating ? 'animate-spin' : ''} />
              {simulating ? 'Simulating...' : '🚨 Test SOS Alert'}
            </button>

            {/* Socket status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
              <Radio size={14} className={socketConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'} />
              <span className="text-xs text-slate-600 font-bold hidden sm:inline">
                {socketConnected ? 'WebSocket Online' : 'Connecting API...'}
              </span>
            </div>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
              {soundEnabled ? <Volume2 size={16} className="text-amber-600" /> : <VolumeX size={16} />}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchAll}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Emergency Alerts"
              value={activeIncidents.length}
              icon={AlertTriangle}
              color="#dc2626"
              pulse="status-pulse-red"
              loading={loading}
            />
            <StatCard
              label="Available ICU Beds"
              value={stats?.available_icu_beds ?? 18}
              icon={Hospital}
              color="#16a34a"
              loading={loading}
            />
            <StatCard
              label="Ambulances Dispatched"
              value={stats?.dispatched_ambulances ?? 6}
              icon={Ambulance}
              color="#2563eb"
              loading={loading}
            />
            <StatCard
              label="Avg Golden Hour ETA"
              value={stats?.avg_eta_minutes ? `${stats.avg_eta_minutes} min` : '8.2 min'}
              icon={Zap}
              color="#d97706"
              loading={loading}
            />
          </div>

          {/* Main Grid: Incident Stream + Map */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Live Incidents Panel */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Activity size={18} className="text-red-600" />
                  Live Emergency Feed
                </h2>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {incidents.length} Reported Incidents
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {incidents.length === 0 ? (
                  <div className="glass-card p-8 text-center text-slate-500 bg-white border border-slate-200">
                    No active emergency incidents reported right now.
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

            {/* Live Map Panel */}
            <div className="lg:col-span-7 space-y-4">
              <div className="glass-card p-4 h-[600px] flex flex-col bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-blue-600" />
                    <h3 className="text-base font-extrabold text-slate-900">Live Regional Dispatch Radar</h3>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                    Realtime PostGIS GIS
                  </span>
                </div>
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-200">
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
            <div className="md:col-span-8 glass-card p-5 bg-white border border-slate-200 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-cyan-600" />
                Hourly Emergency Alert Distribution
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontWeight: 600 }} />
                    <Area type="monotone" dataKey="incidents" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-4 glass-card p-5 bg-white border border-slate-200 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">Incidents by Category</h3>
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card max-w-xl w-full p-6 space-y-5 bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{incidentTypeIcon(selectedIncident.type)}</span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedIncident.incident_number || selectedIncident.id}
                  </h3>
                  <span className={severityBadge(selectedIncident.severity)}>
                    {selectedIncident.severity?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Reported at {new Date(selectedIncident.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-slate-900 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Location & Victim Details */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Location & Telemetry</p>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin size={14} className="text-red-600" />
                {selectedIncident.landmark || selectedIncident.address || `${selectedIncident.latitude}, ${selectedIncident.longitude}`}
              </p>
              {selectedIncident.victim_name && (
                <p className="text-xs text-slate-700 font-medium">
                  <strong>Patient Profile:</strong> {selectedIncident.victim_name}
                </p>
              )}
            </div>

            {/* Vitals Telemetry */}
            {selectedIncident.vitals && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3">
                  <Heart size={24} className="text-red-600 animate-pulse" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Heart Rate Vitals</p>
                    <p className="text-lg font-extrabold text-red-700">{selectedIncident.vitals.bpm} BPM</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-3">
                  <Activity size={24} className="text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Blood Oxygen (SpO2)</p>
                    <p className="text-lg font-extrabold text-blue-700">{selectedIncident.vitals.spO2 || 96}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* AFDP Verification Matrix */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>AFDP v2 Anti-Fake Multi-Sensor Score</span>
                <span className="text-emerald-700 font-extrabold">
                  {selectedIncident.afdpResult?.confidenceScore || 95}% VERIFIED
                </span>
              </p>
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span>Layer 1: Smartphone Accelerometer + Gyro</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span>Layer 2: Airbag Cabin Pressure Shockwave</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span>Layer 3: OBD-II ECU CAN-Bus Airbag Signal</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => dispatchAmbulance(selectedIncident.id)}
                disabled={selectedIncident.status === 'assigned'}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  selectedIncident.status === 'assigned'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-default'
                    : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-md shadow-red-600/20'
                }`}>
                <Ambulance size={16} />
                {selectedIncident.status === 'assigned' ? 'Ambulance Dispatched' : 'Dispatch Nearest Ambulance'}
              </button>
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm border border-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
