'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle, Activity, Ambulance, Hospital, Zap,
  MapPin, Clock, ChevronRight, Radio, TrendingUp, Volume2, VolumeX,
  Shield, Menu, X, BarChart3, RefreshCw, LogOut, LogIn, UserCheck,
  Stethoscope, Bed, HeartPulse, Edit3, CheckCircle2, Phone, Save
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

function StatCard({ label, value, sub, icon: Icon, color, bgGradient, pulse, loading, action }: {
  label: string; value: string | number | null; sub?: string; icon: any;
  color: string; bgGradient: string; pulse?: string; loading?: boolean; action?: () => void;
}) {
  return (
    <div className={`glass-card glass-card-hover p-5 bg-gradient-to-br ${bgGradient} border border-slate-200/80 relative`}>
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
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-slate-900 tracking-tight">{value ?? '—'}</p>
            {action && (
              <button
                onClick={action}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer transition-all shadow-xs">
                ✏️ Update
              </button>
            )}
          </div>
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
  { icon: UserCheck, label: 'Doctor & Staff Attendance', href: '/attendance' },
  { icon: Hospital, label: 'My Hospital Bed Capacity', href: '/hospitals' },
  { icon: AlertTriangle, label: 'Emergency Incidents', href: '/incidents' },
  { icon: Ambulance, label: 'Fleet Dispatcher', href: '/fleet' },
  { icon: MapPin, label: 'Live Dispatch Radar', href: '/map' },
  { icon: BarChart3, label: 'Hospital Analytics', href: '/analytics' },
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
          <div className="min-w-0">
            <p className="text-xs text-emerald-900 font-black truncate">
              {currentUser?.hospitalName || currentUser?.hospital || 'Hospital Node Active'}
            </p>
            <p className="text-[10px] text-emerald-700 font-semibold">Triage Live & Telemetry Active</p>
          </div>
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
              <span className="truncate">{item.label}</span>
              {item.label === 'Command Center' && activeCount > 0 && (
                <span className="ml-auto text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-black">
                  {activeCount}
                </span>
              )}
            </a>
          ))}

          {/* Log Out Button */}
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-xs shrink-0">
              <Shield size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {currentUser?.name || 'Hospital Triage Staff'}
              </p>
              <p className="text-[11px] text-slate-500 font-bold truncate">
                {currentUser?.staffTitle || currentUser?.department || (currentUser?.role ? `${currentUser.role.replace('_', ' ').toUpperCase()}` : 'Level-1 Emergency Node')}
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
  const [onDutyDoctors, setOnDutyDoctors] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [typeData, setTypeData]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Doctor Quick Status State
  const [myDutyStatus, setMyDutyStatus] = useState<string>('on_duty');
  const [dutyUpdating, setDutyUpdating] = useState<boolean>(false);

  // Bed Capacity Quick Modal
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [editIcuAvail, setEditIcuAvail] = useState(8);
  const [editErAvail, setEditErAvail] = useState(12);
  const [savingBeds, setSavingBeds] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const u = localStorage.getItem('sers_user');
      if (u) {
        const parsed = JSON.parse(u);
        setCurrentUser(parsed);
        if (parsed.icuBedsAvailable !== undefined) setEditIcuAvail(parsed.icuBedsAvailable);
        if (parsed.erBedsAvailable !== undefined) setEditErAvail(parsed.erBedsAvailable);
      }
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const uStr = typeof window !== 'undefined' ? localStorage.getItem('sers_user') : null;
      const u = uStr ? JSON.parse(uStr) : null;
      const hospParam = u?.hospitalId ? `&hospitalId=${u.hospitalId}` : '';
      const hospQueryParam = u?.hospitalId ? `?hospital_id=${u.hospitalId}` : '';

      const [summaryRes, incidentsRes, hourlyRes, typeRes, hospRes, ambRes, attendRes] = await Promise.allSettled([
        apiFetch(`/api/analytics/summary${u?.hospitalId ? `?hospitalId=${u.hospitalId}` : ''}`),
        apiFetch(`/api/incidents?limit=50${hospParam}`),
        apiFetch('/api/analytics/incidents-by-hour'),
        apiFetch('/api/analytics/incidents-by-type'),
        apiFetch('/api/hospitals?limit=50'),
        apiFetch(`/api/ambulances${u?.hospitalId ? `?hospitalId=${u.hospitalId}` : ''}`),
        apiFetch(`/api/attendance${hospQueryParam}`),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
        setStats(summaryRes.value.data);
        if (summaryRes.value.data?.hospitalProfile) {
          setEditIcuAvail(summaryRes.value.data.hospitalProfile.icu_beds_available ?? 8);
          setEditErAvail(summaryRes.value.data.hospitalProfile.er_beds_available ?? 12);
        }
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

      if (attendRes.status === 'fulfilled' && attendRes.value?.success) {
        setOnDutyDoctors(attendRes.value.data || []);
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

  // Load current doctor's duty status if logged in as doctor
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    if (token) {
      apiFetch('/api/attendance/my-status')
        .then(res => {
          if (res.success && res.data?.status) {
            setMyDutyStatus(res.data.status);
          }
        })
        .catch(() => {});
    }
  }, []);

  // WebSocket Live Updates
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    const socket: Socket = io(WS, {
      auth: { token: token || 'guest' },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    
    socket.on('incident:new', (newInc) => {
      const uStr = typeof window !== 'undefined' ? localStorage.getItem('sers_user') : null;
      const u = uStr ? JSON.parse(uStr) : null;
      // Scoped alerting: If user has a hospitalId, only notify if assigned to this hospital
      if (u?.hospitalId && newInc.assigned_hospital_id && newInc.assigned_hospital_id !== u.hospitalId) {
        return;
      }
      setIncidents(prev => [newInc, ...prev.filter(i => i.id !== newInc.id)]);
      setNewAlertCount(n => n + 1);
    });

    socket.on('incident:status', ({ incidentId, status }) => {
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleToggleDoctorDuty = async (newStatus: string) => {
    setDutyUpdating(true);
    try {
      const res = await apiFetch('/api/attendance/toggle-my-status', {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setMyDutyStatus(newStatus);
        await fetchAll();
      }
    } catch (err) {
      console.error('Failed to update doctor duty status:', err);
    } finally {
      setDutyUpdating(false);
    }
  };

  const handleSaveBedCapacity = async () => {
    setSavingBeds(true);
    try {
      const hospId = currentUser?.hospitalId || stats?.hospitalProfile?.id;
      if (hospId) {
        await apiFetch(`/api/hospitals/${hospId}/capacity`, {
          method: 'PUT',
          body: JSON.stringify({
            icuBedsAvailable: editIcuAvail,
            erBedsAvailable: editErAvail,
          }),
        });
      }
      setBedModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      alert('Error updating bed capacity: ' + err.message);
    } finally {
      setSavingBeds(false);
    }
  };

  const activeIncidents = incidents.filter(i => !['resolved', 'cancelled', 'false_alarm'].includes(i.status));
  const activeDoctorsOnDuty = onDutyDoctors.filter(d => d.status === 'on_duty' || d.status === 'in_ot');
  const myHospitalProfile = stats?.hospitalProfile || hospitals.find(h => h.id === currentUser?.hospitalId);
  const availableIcuBeds = myHospitalProfile?.icu_beds_available ?? (currentUser?.icuBedsAvailable ?? 8);
  const availableErBeds = myHospitalProfile?.er_beds_available ?? (currentUser?.erBedsAvailable ?? 12);
  const activeDispatchedAmbulances = ambulances.filter(a => ['en_route', 'dispatched', 'transporting', 'on_scene'].includes(a.status)).length;

  const isDoctorRole = currentUser?.staffTitle || currentUser?.department || currentUser?.role === 'doctor';

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 flex font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeCount={activeIncidents.length} />

      <main className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 shadow-xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 cursor-pointer">
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                🏥 {currentUser?.hospitalName || currentUser?.hospital || 'Hospital Emergency Command Center'}
                <span className="text-[10px] bg-rose-100 text-rose-700 font-extrabold px-2 py-0.5 rounded-md border border-rose-200">
                  LIVE DESK
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-bold">
                {currentUser?.name ? `Logged in: ${currentUser.name} (${currentUser.staffTitle || currentUser.role?.replace('_', ' ').toUpperCase() || 'Desk Officer'})` : 'Hospital Command & Triage Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Socket status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80">
              <Radio size={14} className={socketConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'} />
              <span className="text-xs text-slate-700 font-extrabold hidden sm:inline">
                {socketConnected ? 'Alert Stream Active' : 'Connecting API...'}
              </span>
            </div>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition-colors cursor-pointer">
              {soundEnabled ? <Volume2 size={16} className="text-amber-600" /> : <VolumeX size={16} />}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchAll}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition-colors cursor-pointer">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          
          {/* Doctor / Medical Personnel Shift Status Quick Bar */}
          {isDoctorRole && (
            <div className="glass-card p-4 bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/90 border border-indigo-200/80 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-900">Dr. {currentUser?.name || 'Physician'} — Live Duty Status</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {currentUser?.department || 'Emergency & Trauma'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    Your availability is broadcast to the trauma desk for incoming emergency cases.
                  </p>
                </div>
              </div>

              {/* 1-Tap Toggle Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={dutyUpdating}
                  onClick={() => handleToggleDoctorDuty('on_duty')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                    myDutyStatus === 'on_duty'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  🟢 On-Duty / Ready
                </button>

                <button
                  type="button"
                  disabled={dutyUpdating}
                  onClick={() => handleToggleDoctorDuty('in_ot')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                    myDutyStatus === 'in_ot'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  }`}>
                  🟡 In OT / Surgery
                </button>

                <button
                  type="button"
                  disabled={dutyUpdating}
                  onClick={() => handleToggleDoctorDuty('on_call')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                    myDutyStatus === 'on_call'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}>
                  🔵 On-Call
                </button>

                <button
                  type="button"
                  disabled={dutyUpdating}
                  onClick={() => handleToggleDoctorDuty('off_duty')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                    myDutyStatus === 'off_duty'
                      ? 'bg-slate-700 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  ⚪ Off-Duty
                </button>
              </div>
            </div>
          )}

          {/* Hospital Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Incoming Emergency Alerts"
              value={activeIncidents.length}
              sub={`${incidents.filter(i => i.severity === 'critical' && !['resolved','cancelled','false_alarm'].includes(i.status)).length} Critical Trauma Cases`}
              icon={AlertTriangle}
              color="#e11d48"
              bgGradient="from-rose-50/50 to-white"
              pulse={activeIncidents.length > 0 ? "status-pulse-red" : undefined}
              loading={loading}
            />
            <StatCard
              label="My Hospital ICU Beds"
              value={availableIcuBeds}
              sub={`🛏️ Available for Trauma`}
              icon={Hospital}
              color="#059669"
              bgGradient="from-emerald-50/50 to-white"
              loading={loading}
              action={() => setBedModalOpen(true)}
            />
            <StatCard
              label="My Hospital ER Beds"
              value={availableErBeds}
              sub={`🏥 Emergency Triage Ready`}
              icon={Bed}
              color="#2563eb"
              bgGradient="from-blue-50/50 to-white"
              loading={loading}
              action={() => setBedModalOpen(true)}
            />
            <StatCard
              label="On-Duty Medical Staff"
              value={activeDoctorsOnDuty.length}
              sub={`👨‍⚕️ Doctors & Surgeons Active`}
              icon={UserCheck}
              color="#7c3aed"
              bgGradient="from-purple-50/50 to-white"
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
                  Live Incoming Emergency Stream
                </h2>
                <span className="text-[11px] font-mono font-extrabold text-slate-600 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                  {incidents.length} Logged
                </span>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {incidents.length === 0 ? (
                  <div className="glass-card p-10 text-center text-slate-500 font-bold bg-white border border-slate-200 rounded-2xl space-y-2">
                    <p className="text-sm font-black text-slate-800">No active alerts routed to this hospital</p>
                    <p className="text-xs text-slate-400 font-semibold">
                      When a citizen SOS, road crash, or cardiac distress alert is dispatched to {currentUser?.hospitalName || 'your hospital'}, it will appear here in real-time.
                    </p>
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

            {/* Live Map Radar */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
                  <MapPin size={16} className="text-rose-600" />
                  Live Regional Emergency Radar
                </h2>
                <span className="text-[11px] font-bold text-slate-500">
                  {ambulances.length} Ambulances Tracked
                </span>
              </div>

              <div className="glass-card bg-white border border-slate-200 rounded-2xl overflow-hidden h-[580px] relative shadow-sm">
                <LiveMap
                  incidents={incidents}
                  hospitals={hospitals}
                  ambulances={ambulances}
                  selectedIncident={selectedIncident}
                  onSelectIncident={(inc) => setSelectedIncident(inc)}
                />
              </div>
            </div>
          </div>

          {/* On-Duty Doctors & Emergency Duty Roster Summary */}
          <div className="glass-card p-6 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Stethoscope size={18} className="text-indigo-600" />
                  Hospital Emergency Medical Roster
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Real-time duty availability of Doctors, Trauma Surgeons, and Nurses ready for emergency intake.
                </p>
              </div>

              <Link
                href="/attendance"
                className="text-xs font-black px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 transition-all">
                View Full Department Attendance <ChevronRight size={14} />
              </Link>
            </div>

            {onDutyDoctors.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                <p className="text-xs font-bold text-slate-700">No medical personnel attendance logged today yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Doctors & staff can mark shift check-in from the Attendance tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {onDutyDoctors.slice(0, 8).map((doc) => (
                  <div key={doc.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-900 truncate">Dr. {doc.name}</p>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        doc.status === 'on_duty' ? 'bg-emerald-100 text-emerald-800' :
                        doc.status === 'in_ot' ? 'bg-amber-100 text-amber-800' :
                        doc.status === 'on_call' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {doc.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-indigo-700 truncate">{doc.department || 'Trauma & ER'}</p>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">{doc.specialization || doc.shift}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bed Capacity Quick Editor Modal */}
      {bedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Bed size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Update Hospital Bed Capacity</h4>
                  <p className="text-[11px] text-slate-500 font-bold">{currentUser?.hospitalName || 'Hospital Node'}</p>
                </div>
              </div>
              <button onClick={() => setBedModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Available ICU Beds (Trauma Ready)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditIcuAvail(prev => Math.max(0, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 font-black text-slate-700 hover:bg-slate-200">-</button>
                  <input
                    type="number"
                    min="0"
                    value={editIcuAvail}
                    onChange={e => setEditIcuAvail(parseInt(e.target.value) || 0)}
                    className="flex-1 text-center font-black text-lg p-2 bg-slate-50 border border-slate-200 rounded-xl text-emerald-700"
                  />
                  <button
                    type="button"
                    onClick={() => setEditIcuAvail(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 font-black text-slate-700 hover:bg-slate-200">+</button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Available ER / Triage Beds</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditErAvail(prev => Math.max(0, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 font-black text-slate-700 hover:bg-slate-200">-</button>
                  <input
                    type="number"
                    min="0"
                    value={editErAvail}
                    onChange={e => setEditErAvail(parseInt(e.target.value) || 0)}
                    className="flex-1 text-center font-black text-lg p-2 bg-slate-50 border border-slate-200 rounded-xl text-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setEditErAvail(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 font-black text-slate-700 hover:bg-slate-200">+</button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBedModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBeds}
                onClick={handleSaveBedCapacity}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2">
                <Save size={14} />
                {savingBeds ? 'Saving...' : 'Update Live Capacity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
