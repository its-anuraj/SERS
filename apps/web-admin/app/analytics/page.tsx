'use client';

/**
 * SERS Admin — Analytics & AI Dispatch Page (100% Real Live Database Data)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart3, TrendingUp, MessageSquare, Zap, Activity, AlertTriangle,
  Ambulance, Hospital, MapPin, Clock, Shield, Menu, X, LogOut,
  Send, Bot, User, RefreshCw, Flame, BarChart2, PieChart as PieIcon, Calendar, Hash, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getApiUrl } from '../../lib/config';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const API = getApiUrl();
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

interface Summary {
  incidents: { total_incidents: number; resolved: number; active: number; ai_detected: number; avg_response_mins: number | null };
  hospitals: { total: number; on_network: number };
  ambulances: { total: number; available: number };
}

interface IncidentByType { type: string; count: number }
interface ResponseTrend { day: string; avg_response_mins: number; total_incidents: number }
interface HourlyData { hour: number; count: number }
interface Hotspot { id: string; latitude: number; longitude: number; risk_score: number; risk_label: string; predicted_for_hour: number }

const RISK_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  high:     { color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' },
  medium:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  low:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

function MiniStat({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any;
}) {
  return (
    <div className="glass-card p-5 bg-white border border-slate-200 shadow-sm hover-lift">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 font-semibold mt-1">{sub}</p>}
    </div>
  );
}

function LLMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm the **SERS AI Dispatch Assistant**, connected directly to the SERS PostgreSQL database engine.\n\nAsk any question about live emergency incidents, average response times, ICU bed capacity, or ambulance fleet status in plain English.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/analytics/llm-query', {
        method: 'POST',
        body: JSON.stringify({ query: text.trim() }),
      });
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString() + '-res', role: 'assistant', content: res.data?.answer || 'Analytics query processed.', timestamp: new Date() },
      ]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString() + '-err', role: 'assistant', content: '⚠️ Unable to connect to analytics query engine. Please check backend connection.', timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[550px] bg-white border border-slate-200 shadow-sm rounded-2xl">
      <div className="p-4 border-b border-slate-200 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-xs">
          <Bot size={18} />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">SERS AI Dispatch Assistant</p>
          <p className="text-xs text-slate-500 font-semibold">Live Database Intelligence & Natural Language Query</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-red-600 text-white font-bold rounded-tr-xs'
                : 'bg-slate-100 border border-slate-200 text-slate-800 font-medium rounded-tl-xs'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-slate-200 flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask about response times, ICU bed availability, active incidents..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeData, setTypeData] = useState<IncidentByType[]>([]);
  const [trendData, setTrendData] = useState<ResponseTrend[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hotspots' | 'chat'>('overview');

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

      if (sum.status === 'fulfilled' && sum.value?.data) {
        setSummary(sum.value.data);
      }
      if (types.status === 'fulfilled' && Array.isArray(types.value?.data)) {
        setTypeData(types.value.data.map((d: any) => ({
          type: d.type,
          count: parseInt(d.count) || 0,
        })));
      }
      if (trends.status === 'fulfilled' && Array.isArray(trends.value?.data)) {
        setTrendData(trends.value.data.map((d: any) => ({
          day: new Date(d.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          avg_response_mins: parseFloat(d.avg_response_mins) || 0,
          total_incidents: parseInt(d.total_incidents) || 0,
        })));
      }
      if (hourly.status === 'fulfilled' && Array.isArray(hourly.value?.data)) {
        const full = Array.from({ length: 24 }, (_, h) => {
          const found = hourly.value.data.find((d: any) => parseInt(d.hour) === h);
          return { hour: h, count: found ? parseInt(found.count) : 0 };
        });
        setHourlyData(full);
      }
      if (spots.status === 'fulfilled' && Array.isArray(spots.value?.data)) {
        setHotspots(spots.value.data);
      }
    } catch (e) {
      console.error('Analytics load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    if (!token) {
      window.location.href = '/login';
      return;
    }
    load();
  }, [load]);

  const statCards = [
    { label: 'Total Incidents (30d)', value: summary?.incidents ? (summary.incidents.total_incidents ?? 0) : '—', sub: `${summary?.incidents?.resolved ?? 0} resolved`, color: '#dc2626', icon: AlertTriangle },
    { label: 'Active Incidents', value: summary?.incidents ? (summary.incidents.active ?? 0) : '—', sub: 'In progress', color: '#ea580c', icon: Flame },
    { label: 'Avg Response Time', value: summary?.incidents?.avg_response_mins ? `${summary.incidents.avg_response_mins} min` : 'N/A', sub: 'Golden Hour metric', color: '#2563eb', icon: Clock },
    { label: 'AI Crash Detections', value: summary?.incidents ? (summary.incidents.ai_detected ?? 0) : '—', sub: 'Auto-triggered SOS', color: '#9333ea', icon: Bot },
    { label: 'Ambulances Available', value: summary?.ambulances ? `${summary.ambulances.available}/${summary.ambulances.total}` : '0/0', sub: 'Active fleet units', color: '#16a34a', icon: Ambulance },
    { label: 'Hospitals on Network', value: summary?.hospitals ? `${summary.hospitals.on_network}/${summary.hospitals.total}` : '0/0', sub: 'Connected centers', color: '#0891b2', icon: Hospital },
  ];

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
              <BarChart3 size={22} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Analytics & AI Dispatch</h1>
              <p className="text-xs text-slate-500 font-semibold">Real-time emergency intelligence & hotspot prediction</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={load} className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
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

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[
            { key: 'overview', label: 'Live Summary', icon: BarChart2 },
            { key: 'chat', label: 'AI Dispatch Assistant', icon: MessageSquare },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {statCards.map(c => <MiniStat key={c.label} {...c} />)}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-5 bg-white border border-slate-200 shadow-sm rounded-2xl">
                <h3 className="font-extrabold text-base text-slate-900 mb-4">Emergency Incident Breakdown (30 Days)</h3>
                <div className="h-56">
                  {typeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="type" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                        <Bar dataKey="count" fill="#dc2626" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                      Jab pehli emergency aayegi, data yahan apne aap dikhne lagega
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-5 bg-white border border-slate-200 shadow-sm rounded-2xl">
                <h3 className="font-extrabold text-base text-slate-900 mb-4">Response Time Trends</h3>
                <div className="h-56">
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }} />
                        <Area type="monotone" dataKey="avg_response_mins" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.4} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                      Ambulance response times yahan track honge
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && <LLMChat />}
      </div>
    </div>
  );
}
