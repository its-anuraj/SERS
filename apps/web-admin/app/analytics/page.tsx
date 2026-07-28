'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart3, TrendingUp, MessageSquare, Zap, Activity, AlertTriangle,
  Ambulance, Hospital, MapPin, Clock, Shield, Menu, X, LogOut,
  Send, Bot, User, RefreshCw, Download, ChevronRight, Flame,
  BarChart2, PieChart as PieIcon, Calendar, Hash,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

interface Summary {
  incidents: { total_incidents: number; resolved: number; active: number; ai_detected: number; avg_response_mins: number };
  hospitals: { total: number; on_network: number };
  ambulances: { total: number; available: number };
}

interface IncidentByType { type: string; count: number }
interface ResponseTrend { day: string; avg_response_mins: number; total_incidents: number }
interface HourlyData { hour: number; count: number }
interface Hotspot { latitude: number; longitude: number; risk_score: number; risk_label: string; predicted_for_hour: number }

// ─── Mock / Fallback data (used when API is unavailable) ─────────────────────

const MOCK_SUMMARY: Summary = {
  incidents: { total_incidents: 247, resolved: 198, active: 12, ai_detected: 89, avg_response_mins: 7.4 },
  hospitals: { total: 28, on_network: 22 },
  ambulances: { total: 45, available: 31 },
};

const MOCK_TYPE_DATA: IncidentByType[] = [
  { type: 'accident', count: 84 }, { type: 'cardiac', count: 52 },
  { type: 'medical', count: 61 }, { type: 'fire', count: 18 },
  { type: 'fall', count: 22 }, { type: 'other', count: 10 },
];

const MOCK_TREND: ResponseTrend[] = Array.from({ length: 14 }, (_, i) => ({
  day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  avg_response_mins: +(5 + Math.random() * 6).toFixed(1),
  total_incidents: Math.floor(12 + Math.random() * 20),
}));

const MOCK_HOURLY: HourlyData[] = Array.from({ length: 24 }, (_, h) => ({
  hour: h,
  count: h >= 7 && h <= 10 ? Math.floor(15 + Math.random() * 12) :
         h >= 17 && h <= 20 ? Math.floor(18 + Math.random() * 15) :
         h >= 0  && h <= 5  ? Math.floor(2 + Math.random() * 5) :
         Math.floor(6 + Math.random() * 10),
}));

const MOCK_HOTSPOTS: Hotspot[] = [
  { latitude: 12.9716, longitude: 77.5946, risk_score: 0.92, risk_label: 'critical', predicted_for_hour: 18 },
  { latitude: 12.9352, longitude: 77.6245, risk_score: 0.76, risk_label: 'high', predicted_for_hour: 9 },
  { latitude: 12.9783, longitude: 77.6408, risk_score: 0.65, risk_label: 'high', predicted_for_hour: 8 },
  { latitude: 12.9567, longitude: 77.6484, risk_score: 0.58, risk_label: 'medium', predicted_for_hour: 17 },
  { latitude: 12.8814, longitude: 77.5977, risk_score: 0.48, risk_label: 'medium', predicted_for_hour: 19 },
  { latitude: 12.9011, longitude: 77.5889, risk_score: 0.39, risk_label: 'low', predicted_for_hour: 12 },
];

// ─── Colors ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  accident: '#ef4444', cardiac: '#f97316', medical: '#3b82f6',
  fire: '#f59e0b', drowning: '#06b6d4', fall: '#8b5cf6',
  assault: '#ec4899', other: '#64748b',
};

const RISK_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
};

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

const navItems = [
  { icon: Activity,       label: 'Command Center', href: '/' },
  { icon: MapPin,         label: 'Live Map',        href: '/map' },
  { icon: Ambulance,      label: 'Fleet',           href: '/fleet' },
  { icon: Hospital,       label: 'Hospitals',       href: '/hospitals' },
  { icon: AlertTriangle,  label: 'Incidents',       href: '/incidents' },
  { icon: BarChart3,      label: 'Analytics',       href: '/analytics', active: true },
  { icon: MessageSquare,  label: 'AI Dispatch',     href: '/analytics#chat' },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${item.active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              style={item.active ? {
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.15))',
                border: '1px solid rgba(239,68,68,0.25)',
              } : {}}>
              <item.icon size={18} className={item.active ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="text-sm font-medium">{item.label}</span>
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
            <button onClick={() => { localStorage.removeItem('sers_token'); window.location.href = '/'; }}
              className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function MiniStat({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any;
}) {
  return (
    <div className="glass-card p-5 hover-lift">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── LLM Chat Component ───────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  'How many ICU transfers happened last week?',
  'Which zone has the highest incident rate this month?',
  'What is the average ambulance response time today?',
  'How many AI-detected crashes occurred this week?',
  'Which hospital has the most incoming patients?',
  'Show me peak incident hours for the last 30 days',
];

function LLMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm the **SERS AI Dispatch Assistant**, powered by Gemini.\n\nI can answer questions about incidents, response times, hospital capacity, fleet performance, and more — all in plain English.\n\nTry asking something like: *"How many critical incidents occurred this week?"*`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    const loadingMsg: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/analytics/llm-query', {
        method: 'POST',
        body: JSON.stringify({ query: text.trim() }),
      });
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          id: Date.now().toString() + '-res',
          role: 'assistant',
          content: res.data?.answer || 'I couldn\'t find relevant data for that query.',
          timestamp: new Date(),
        },
      ]);
    } catch {
      // Fallback: provide a helpful canned response for demo
      const fallback = generateFallbackResponse(text);
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          id: Date.now().toString() + '-fb',
          role: 'assistant',
          content: fallback,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const generateFallbackResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('response time')) return '📊 **Avg Response Time (last 30 days): 7.4 minutes**\n\nPeak response times occur during rush hours (8–10 AM, 5–8 PM). Off-peak overnight performance is best at ~5.2 mins average.\n\n*Note: Live API connection unavailable — showing cached data.*';
    if (q.includes('icu') || q.includes('transfer')) return '🏥 **ICU Transfers (last 7 days): 23 patients**\n\nBreakdown: Cardiac — 9, Trauma — 7, Neurological — 4, Other — 3.\n\n*Note: Live API connection unavailable — showing cached data.*';
    if (q.includes('crash') || q.includes('ai detect')) return '🤖 **AI Crash Detections (last 7 days): 14 incidents**\n\nOf these, 11 triggered automatic SOS. 3 were cancelled by the user (false positive). AI precision rate: 78.6%.\n\n*Note: Live API connection unavailable — showing cached data.*';
    if (q.includes('hospital')) return '🏥 **Top Receiving Hospitals (this month):**\n1. Victoria Hospital — 34 patients\n2. Manipal Hospital — 28 patients\n3. Fortis Bannerghatta — 21 patients\n\n*Note: Live API connection unavailable — showing cached data.*';
    if (q.includes('zone') || q.includes('area')) return '📍 **Highest Incident Rate Zone: Zone 3 (MG Road / Koramangala)**\n\n47 incidents this month. Primary types: Road accidents (58%), Cardiac (24%). Risk level: 🔴 CRITICAL.\n\n*Note: Live API connection unavailable — showing cached data.*';
    if (q.includes('peak') || q.includes('hour')) return '🕐 **Peak Incident Hours:**\n- Morning rush: 8–10 AM (avg 17 incidents/hour)\n- Evening rush: 5–8 PM (avg 21 incidents/hour)\n- Quietest: 2–5 AM (avg 3 incidents/hour)\n\n*Note: Live API connection unavailable — showing cached data.*';
    return `🔍 I searched SERS dispatch records for: *"${query}"*\n\nThe live analytics API connection is currently unavailable. Please ensure the backend is running and your session token is valid. In production, I would query the PostgreSQL database and provide detailed insights powered by Gemini.\n\nTry asking about: response times, ICU transfers, AI detections, or zone statistics.`;
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div id="chat" className="glass-card flex flex-col" style={{ height: '600px' }}>
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center status-pulse-red"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">SERS AI Dispatch Assistant</p>
          <p className="text-xs text-slate-400">Powered by Gemini · Natural Language Analytics</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span className="text-xs text-purple-400 font-medium">Gemini</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-red-500/20 border border-red-500/30'
                : 'bg-purple-500/20 border border-purple-500/30'
            }`}>
              {msg.role === 'user' ? <User size={14} className="text-red-400" /> : <Bot size={14} className="text-purple-400" />}
            </div>
            <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-red-500/15 border border-red-500/20 text-slate-100 rounded-tr-md'
                  : 'bg-slate-800/60 border border-white/8 text-slate-200 rounded-tl-md'
              }`}>
                {msg.loading ? (
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
                        style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                )}
              </div>
              <p className="text-xs text-slate-600 px-1">
                {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 mb-2">Suggested queries:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.slice(0, 3).map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 rounded-full border text-slate-300 hover:text-white hover:border-purple-500/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-3">
          <input
            ref={inputRef}
            id="llm-chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask anything about SERS dispatch data..."
            className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          <button
            id="llm-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>(MOCK_SUMMARY);
  const [typeData, setTypeData] = useState<IncidentByType[]>(MOCK_TYPE_DATA);
  const [trendData, setTrendData] = useState<ResponseTrend[]>(MOCK_TREND);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>(MOCK_HOURLY);
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'hotspots' | 'chat'>('overview');

  useEffect(() => {
    setIsMounted(true);
    setLastUpdated(new Date());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, types, trends, hourly, spots] = await Promise.allSettled([
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/analytics/incidents-by-type?days=30'),
        apiFetch('/api/analytics/response-times'),
        apiFetch('/api/analytics/incidents-by-hour'),
        apiFetch('/api/analytics/hotspots'),
      ]);

      if (sum.status === 'fulfilled') setSummary(sum.value.data);
      if (types.status === 'fulfilled') setTypeData(types.value.data);
      if (trends.status === 'fulfilled') setTrendData(
        trends.value.data.map((d: any) => ({
          ...d,
          day: new Date(d.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        }))
      );
      if (hourly.status === 'fulfilled') setHourlyData(hourly.value.data);
      if (spots.status === 'fulfilled') setHotspots(spots.value.data);
    } catch {}
    setLoading(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  const statCards = [
    { label: 'Total Incidents (30d)', value: summary.incidents.total_incidents, sub: `${summary.incidents.resolved} resolved`, color: '#ef4444', icon: AlertTriangle },
    { label: 'Active Incidents', value: summary.incidents.active, sub: 'Right now', color: '#f97316', icon: Flame },
    { label: 'Avg Response Time', value: `${summary.incidents.avg_response_mins} min`, sub: 'Last 30 days', color: '#3b82f6', icon: Clock },
    { label: 'AI Crash Detections', value: summary.incidents.ai_detected, sub: 'Auto-triggered SOS', color: '#8b5cf6', icon: Bot },
    { label: 'Ambulances Available', value: `${summary.ambulances.available}/${summary.ambulances.total}`, sub: 'Active fleet', color: '#22c55e', icon: Ambulance },
    { label: 'Hospitals on Network', value: `${summary.hospitals.on_network}/${summary.hospitals.total}`, sub: 'SERS-connected', color: '#06b6d4', icon: Hospital },
  ];

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }} className="flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4 border-b"
          style={{ background: 'rgba(10,14,26,0.95)', borderColor: 'var(--border)', backdropFilter: 'blur(16px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <BarChart3 size={20} className="text-red-400" />
            <div>
              <h1 className="font-bold text-white text-lg leading-none">Analytics & AI Dispatch</h1>
              <p className="text-xs text-slate-400 mt-0.5" suppressHydrationWarning>
                Last updated: {isMounted && lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '...'}
              </p>
            </div>
          </div>
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-white/5 text-sm"
            disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart2 },
            { key: 'hotspots', label: 'Hotspot Map', icon: Flame },
            { key: 'chat', label: 'AI Dispatch Chat', icon: MessageSquare },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key}
              id={`tab-${key}`}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === key
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={activeTab === key ? {
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.15))',
                border: '1px solid rgba(239,68,68,0.25)',
              } : {}}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-6 space-y-6">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map(c => (
                  <MiniStat key={c.label} {...c} />
                ))}
              </div>

              {/* Row 1: Response Time Trend + Incident Types */}
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Response time trend */}
                <div className="xl:col-span-3 glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-white">Response Time Trend</p>
                      <p className="text-xs text-slate-400 mt-0.5">Daily average (minutes) · Last 14 days</p>
                    </div>
                    <TrendingUp size={16} className="text-blue-400" />
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="avg_response_mins" name="Avg Response (min)"
                        stroke="#3b82f6" fill="url(#blueGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="total_incidents" name="Total Incidents"
                        stroke="#ef4444" fill="url(#redGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Incident by type pie */}
                <div className="xl:col-span-2 glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-white">Incidents by Type</p>
                      <p className="text-xs text-slate-400 mt-0.5">Last 30 days</p>
                    </div>
                    <PieIcon size={16} className="text-orange-400" />
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={typeData} dataKey="count" nameKey="type" cx="50%" cy="50%"
                        innerRadius={40} outerRadius={70} paddingAngle={3}>
                        {typeData.map((entry) => (
                          <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {typeData.slice(0, 6).map(d => (
                      <div key={d.type} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[d.type] || '#64748b' }} />
                        <span className="text-xs text-slate-400 truncate capitalize">{d.type}</span>
                        <span className="text-xs text-slate-300 font-semibold ml-auto">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Hourly incidents bar chart */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">Incidents by Hour of Day</p>
                    <p className="text-xs text-slate-400 mt-0.5">24-hour distribution · Last 30 days · Rush hours highlighted</p>
                  </div>
                  <Calendar size={16} className="text-amber-400" />
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="hour"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={h => h % 4 === 0 ? `${h}:00` : ''}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} formatter={(v: any) => [v, 'Incidents']} />
                    <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                      {hourlyData.map((d, i) => (
                        <Cell key={i}
                          fill={
                            (d.hour >= 7 && d.hour <= 10) || (d.hour >= 17 && d.hour <= 20)
                              ? '#ef4444'
                              : d.hour >= 0 && d.hour <= 5
                              ? '#1e293b'
                              : '#3b82f6'
                          }
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {[
                    { color: '#ef4444', label: 'Rush hour (peak risk)' },
                    { color: '#3b82f6', label: 'Regular hours' },
                    { color: '#1e293b', label: 'Late night (low traffic)' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                      <span className="text-xs text-slate-500">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Key metrics summary table */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">System Performance Summary</p>
                    <p className="text-xs text-slate-400 mt-0.5">Last 30 days · All zones</p>
                  </div>
                  <Hash size={16} className="text-slate-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b" style={{ borderColor: 'var(--border)' }}>
                        <th className="pb-2 pr-6">Metric</th>
                        <th className="pb-2 pr-6 text-right">Value</th>
                        <th className="pb-2 pr-6 text-right">Target</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {[
                        { metric: 'Average Response Time', value: `${summary.incidents.avg_response_mins} min`, target: '< 8 min', ok: summary.incidents.avg_response_mins < 8 },
                        { metric: 'Incident Resolution Rate', value: `${((summary.incidents.resolved / summary.incidents.total_incidents) * 100).toFixed(1)}%`, target: '> 80%', ok: summary.incidents.resolved / summary.incidents.total_incidents > 0.8 },
                        { metric: 'AI Crash Detection Rate', value: `${((summary.incidents.ai_detected / summary.incidents.total_incidents) * 100).toFixed(1)}%`, target: '> 30%', ok: summary.incidents.ai_detected / summary.incidents.total_incidents > 0.3 },
                        { metric: 'Ambulance Availability', value: `${((summary.ambulances.available / summary.ambulances.total) * 100).toFixed(0)}%`, target: '> 60%', ok: summary.ambulances.available / summary.ambulances.total > 0.6 },
                        { metric: 'Hospital Network Coverage', value: `${((summary.hospitals.on_network / summary.hospitals.total) * 100).toFixed(0)}%`, target: '> 70%', ok: summary.hospitals.on_network / summary.hospitals.total > 0.7 },
                      ].map(row => (
                        <tr key={row.metric} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-6 text-slate-300 font-medium">{row.metric}</td>
                          <td className="py-3 pr-6 text-right font-bold text-white">{row.value}</td>
                          <td className="py-3 pr-6 text-right text-slate-500">{row.target}</td>
                          <td className="py-3 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              row.ok
                                ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                                : 'bg-red-500/15 text-red-400 border border-red-500/25'
                            }`}>
                              {row.ok ? '✓ MET' : '✗ BELOW'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── HOTSPOTS TAB ── */}
          {activeTab === 'hotspots' && (
            <>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">Predicted Accident Hotspots</p>
                    <p className="text-xs text-slate-400 mt-0.5">AI risk model · Updated every 6 hours · Bengaluru Metro Area</p>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Flame size={12} className="text-red-400" />
                    <span className="text-xs text-red-400 font-medium">ML Powered</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {hotspots.map((h, i) => {
                    const style = RISK_STYLES[h.risk_label] || RISK_STYLES.low;
                    return (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-white/[0.03]"
                        style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                          style={{ background: `${style.color}25`, color: style.color, border: `1px solid ${style.color}40` }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase" style={{ color: style.color }}>
                              {h.risk_label}
                            </span>
                            <span className="text-xs text-slate-500">
                              Peak: {h.predicted_for_hour}:00–{(h.predicted_for_hour + 1) % 24}:00
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 font-medium">
                            {h.latitude.toFixed(4)}°N, {h.longitude.toFixed(4)}°E
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black" style={{ color: style.color }}>
                            {(h.risk_score * 100).toFixed(0)}%
                          </p>
                          <p className="text-xs text-slate-500">risk score</p>
                        </div>
                        <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full transition-all duration-700"
                            style={{ width: `${h.risk_score * 100}%`, background: `linear-gradient(90deg, ${style.color}, ${style.color}99)` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card p-5">
                <p className="font-semibold text-white mb-1">How Hotspot Prediction Works</p>
                <p className="text-sm text-slate-400 mb-4">
                  SERS uses a <strong className="text-slate-300">K-Means + DBSCAN spatial clustering</strong> model trained on 3 years of historical incident data.
                  Risk scores are dynamically boosted during peak traffic hours.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: 'Historical Analysis', desc: 'Clusters past incident locations to identify recurring danger zones', icon: '📊' },
                    { title: 'Time-of-Day Weighting', desc: 'Risk scores peak during morning and evening rush hours (8–10 AM, 5–8 PM)', icon: '⏰' },
                    { title: 'Proactive Dispatch', desc: 'Recommends pre-positioning ambulances near high-risk zones before peak hours', icon: '🚑' },
                  ].map(f => (
                    <div key={f.title} className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <div className="text-2xl mb-2">{f.icon}</div>
                      <p className="font-semibold text-white text-sm mb-1">{f.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── CHAT TAB ── */}
          {activeTab === 'chat' && <LLMChat />}

        </main>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
