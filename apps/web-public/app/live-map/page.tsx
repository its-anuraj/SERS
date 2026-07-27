'use client';

/**
 * SERS Public — Live Incident Map Page
 * Shows active emergencies on a live map, updates every 10s
 */

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Zap, ArrowLeft, AlertTriangle, RefreshCw, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Dynamically load map (no SSR)
const LiveIncidentMap = dynamic(() => import('../../components/PublicMap'), { ssr: false });

interface Incident {
  id: string;
  incident_number: string;
  type: string;
  severity: 'critical' | 'moderate' | 'minor';
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#22c55e',
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥',
  fire: '🔥', drowning: '🌊', fall: '⬇️',
  assault: '⚠️', other: '📋',
};

export default function LiveMapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selected, setSelected]   = useState<Incident | null>(null);

  const fetchIncidents = async () => {
    try {
      const res  = await fetch(`${API}/api/analytics/active-incidents-map`);
      const data = await res.json();
      setIncidents(data.data || []);
      setLastUpdate(new Date());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const criticalCount  = incidents.filter(i => i.severity === 'critical').length;
  const moderateCount  = incidents.filter(i => i.severity === 'moderate').length;
  const resolvedRecent = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #1e293b', background: '#0f172a', flexShrink: 0 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#94a3b8', fontSize: 14 }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <div style={{ width: 1, height: 18, background: '#1e293b' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>SERS</span>
        </div>
        <span style={{ color: '#64748b', fontSize: 14 }}>/ Live Incident Map</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdate && (
            <span style={{ color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} />
              Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={fetchIncidents} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </nav>

      {/* Stats bar */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', gap: 24, flexShrink: 0 }}>
        {[
          { label: 'Active Incidents', value: incidents.length, color: '#f1f5f9' },
          { label: 'Critical', value: criticalCount, color: '#ef4444' },
          { label: 'Moderate', value: moderateCount, color: '#f97316' },
          { label: 'Recently Resolved', value: resolvedRecent, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: s.color, fontWeight: 800, fontSize: 20 }}>{s.value}</span>
            <span style={{ color: '#64748b', fontSize: 13 }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
          <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 340, background: '#0f172a', borderRight: '1px solid #1e293b', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Active Incidents ({incidents.length})
            </h2>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
          ) : incidents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
              <p style={{ color: '#64748b', margin: 0 }}>No active incidents</p>
            </div>
          ) : (
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incidents.map(incident => (
                <div
                  key={incident.id}
                  onClick={() => setSelected(incident === selected ? null : incident)}
                  style={{
                    background: selected?.id === incident.id ? '#1e293b' : '#111827',
                    border: `1px solid ${selected?.id === incident.id ? SEV_COLOR[incident.severity] : '#1e293b'}`,
                    borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
                    borderLeft: `3px solid ${SEV_COLOR[incident.severity] || '#64748b'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}>
                      {TYPE_ICON[incident.type] || '🆘'} {incident.type?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: `${SEV_COLOR[incident.severity]}20`, color: SEV_COLOR[incident.severity], fontWeight: 700 }}>
                      {incident.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={10} /> {incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {new Date(incident.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: incident.status === 'en_route' ? '#06b6d4' : incident.status === 'assigned' ? '#3b82f6' : '#f59e0b' }}>
                      ● {incident.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <LiveIncidentMap incidents={incidents} selectedId={selected?.id} />
          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 24, right: 24, background: 'rgba(15,23,42,0.9)', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(10px)' }}>
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Severity</p>
            {[['Critical', '#ef4444'], ['Moderate', '#f97316'], ['Minor', '#22c55e']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color as string }} />
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
