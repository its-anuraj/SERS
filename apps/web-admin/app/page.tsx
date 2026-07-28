'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Activity, Ambulance, Hospital, Users, Zap,
  MapPin, Clock, ChevronRight, Radio, TrendingUp, Bell,
  Shield, Menu, X, LogOut, Settings, BarChart3, MessageSquare, RefreshCw
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
  accident: '#ef4444', cardiac: '#f97316', medical: '#3b82f6',
  fire: '#f59e0b', drowning: '#06b6d4', fall: '#8b5cf6',
  assault: '#ec4899', other: '#64748b',
};

async function apiFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    reported: 'text-yellow-400', assigned: 'text-blue-400',
    en_route: 'text-cyan-400', arrived: 'text-purple-400',
    transporting: 'text-orange-400', resolved: 'text-green-400',
  };
  return map[status] || 'text-slate-400';
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

function StatCard({ label, value, icon: Icon, color, pulse, loading }: {
  label: string; value: string | number | null; icon: any;
  color: string; pulse?: string; loading?: boolean;
}) {
  return (
    <div className="glass-card p-5 hover-lift cursor-default">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pulse || ''}`}
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}

function IncidentRow({ incident }: { incident: any }) {
  const borderColor = incident.severity === 'critical' ? '#ef4444'
    : incident.severity === 'moderate' ? '#f97316' : '#22c55e';
  return (
    <div className="glass-card p-4 hover-lift cursor-pointer group"
      style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{incidentTypeIcon(incident.type)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">
                {incident.incident_number || incident.number}
              </span>
              <span className={severityBadge(incident.severity)}>
                {incident.severity?.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200 truncate">
              {incident.landmark || incident.address || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}`}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-medium ${statusColor(incident.status)}`}>
                ● {incident.status?.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock size={10} />
                {new Date(incident.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0 mt-1" />
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
  { icon: MessageSquare, label: 'AI Dispatch', href: '/analytics#chat' },
  { icon: Settings, label: 'Settings', href: '#' },
];

function Sidebar({ open, onClose, activeCount }: { open: boolean; onClose: () => void; activeCount: number }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-full z-40 w-64 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ background: 'rgba(10,14,26,0.95)', borderRight: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>

        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center status-pulse-red"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: 'var(--glow-red)' }}>
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-none">SERS</p>
              <p className="text-xs text-slate-400 mt-0.5">Command Center</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-green-400 status-pulse-green" />
          <span className="text-xs text-green-400 font-medium">System Online</span>
          <span className="text-xs text-slate-500 ml-auto">Live</span>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}
              onClick={(e) => {
                if (item.href === '#') {
                  e.preventDefault();
                  alert('Coming Soon: This feature is currently in development.');
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${item.active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              style={item.active ? {
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.15))',
                border: '1px solid rgba(239,68,68,0.25)',
              } : {}}>
              <item.icon size={18} className={item.active ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="text-sm font-medium">{item.label}</span>
              {item.label === 'Command Center' && activeCount > 0 && (
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                  {activeCount}
                </span>
              )}
              {(item.label === 'Analytics' || item.label === 'AI Dispatch') && (
                <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                  New
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Shield size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">Admin SERS</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
            <button className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={16} />
            </button>
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
  const [lastRefresh, setLastRefresh]         = useState(new Date());

  const [stats, setStats]         = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [typeData, setTypeData]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [summaryRes, incidentsRes, hourlyRes, typeRes] = await Promise.all([
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/analytics/active-incidents-map'),
        apiFetch('/api/analytics/incidents-by-hour'),
        apiFetch('/api/analytics/incidents-by-type'),
      ]);

      if (summaryRes.success) setStats(summaryRes.data);
      if (incidentsRes.success) setIncidents(incidentsRes.data);

      if (hourlyRes.success) {
        const full = Array.from({ length: 24 }, (_, i) => {
          const found = hourlyRes.data.find((d: any) => parseInt(d.hour) === i);
          return { hour: `${String(i).padStart(2, '0')}:00`, incidents: found ? parseInt(found.count) : 0 };
        });
        setHourlyData(full);
      }

      if (typeRes.success) {
        setTypeData(typeRes.data.map((d: any) => ({
          name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
          value: parseInt(d.count),
          color: PIE_COLORS[d.type] || '#64748b',
        })));
      }

      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
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
    socket.on('incident:new', (incident) => {
      setIncidents(prev => [incident, ...prev].slice(0, 20));
      setNewAlertCount(n => n + 1);
    });
    socket.on('incident:status', ({ incidentId, status }) => {
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    });
    socket.emit('join', { role: 'admin' });
    return () => { socket.disconnect(); };
  }, []);

  const activeIncidentCount = incidents.length;

  const statCards = [
    { label: 'Active Incidents',     value: stats ? parseInt(stats.incidents?.active) : null,     icon: AlertTriangle, color: '#ef4444', pulse: 'status-pulse-red' },
    { label: 'Ambulances Available', value: stats ? parseInt(stats.ambulances?.available) : null, icon: Ambulance,     color: '#22c55e' },
    { label: 'Hospitals Online',     value: stats ? parseInt(stats.hospitals?.on_network) : null, icon: Hospital,      color: '#3b82f6' },
    { label: 'Resolved Today',       value: stats ? parseInt(stats.incidents?.resolved) : null,   icon: TrendingUp,    color: '#06b6d4' },
    { label: 'AI Detected',          value: stats ? parseInt(stats.incidents?.ai_detected) : null,icon: Activity,      color: '#a855f7' },
    { label: 'Avg Response (min)',   value: stats ? stats.incidents?.avg_response_mins : null,    icon: Clock,         color: '#f59e0b' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeCount={activeIncidentCount} />

      <main className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        <header className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'rgba(10,14,26,0.8)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Command Center</h1>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
              style={{ border: '1px solid var(--border)' }}>
              <RefreshCw size={12} />
              {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </button>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border
              ${socketConnected ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}
              style={{ background: socketConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-green-400 status-pulse-green' : 'bg-red-400'}`} />
              {socketConnected ? 'Live' : 'Connecting...'}
            </div>

            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
              style={{ border: '1px solid var(--border)' }}>
              <Bell size={16} className="text-slate-400" />
              {newAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {newAlertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {error && (
            <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-red-500">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">API Connection Error</p>
                <p className="text-xs text-slate-400 mt-0.5">{error} — Is the API server running? Start it with: <code className="bg-white/5 px-1 rounded">npm run dev</code> in <code className="bg-white/5 px-1 rounded">services/api</code></p>
              </div>
              <button onClick={fetchAll} className="ml-auto text-xs text-blue-400 hover:text-blue-300 underline">Retry</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {statCards.map(card => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="glass-card overflow-hidden" style={{ height: '450px' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-red-400 status-pulse-red" />
                    <span className="text-sm font-semibold text-white">Live Incident Map</span>
                    <span className="text-xs text-slate-500">Bengaluru Region</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Critical</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Moderate</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Minor</span>
                  </div>
                </div>
                <LiveMap incidents={incidents} />
              </div>
            </div>

            <div className="xl:col-span-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-400" />
                  Active Incidents
                  {incidents.length > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                      {incidents.length}
                    </span>
                  )}
                </h2>
                <a href="/incidents" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</a>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-96">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
                ) : incidents.length > 0 ? (
                  incidents.map(incident => <IncidentRow key={incident.id} incident={incident} />)
                ) : (
                  <div className="glass-card p-8 text-center">
                    <p className="text-slate-400 text-sm">No active incidents</p>
                    <p className="text-green-400 text-xs mt-1">✓ All clear</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-400" /> Incidents by Hour (Last 30 days)
              </h3>
              {loading ? (
                <Skeleton className="h-52" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                    <Area type="monotone" dataKey="incidents" stroke="#ef4444" fill="url(#incidentGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Activity size={14} className="text-purple-400" /> Incident Types (30 days)
              </h3>
              {loading ? (
                <Skeleton className="h-52" />
              ) : typeData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey="value" paddingAngle={3}>
                        {typeData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {typeData.map(item => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-xs text-slate-400">{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-slate-500 text-sm">No data for last 30 days</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
