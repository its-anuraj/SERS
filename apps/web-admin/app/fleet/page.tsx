'use client';

/**
 * SERS Admin — Ambulance Fleet Management Page
 * View all ambulances, update status, assign to hospitals
 */

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, RefreshCw, Edit3, MapPin, X, Save, Radio } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

interface Ambulance {
  id: string;
  registration_number: string;
  vehicle_type: string;
  status: 'available' | 'dispatched' | 'en_route' | 'at_scene' | 'transporting' | 'maintenance' | 'offline';
  driver_name: string;
  driver_phone: string;
  paramedic_name?: string;
  hospital_id?: string;
  hospital_name?: string;
  latitude?: number;
  longitude?: number;
  last_seen?: string;
  equipment: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available:    { label: 'Available',    color: '#22c55e' },
  dispatched:   { label: 'Dispatched',   color: '#3b82f6' },
  en_route:     { label: 'En Route',     color: '#06b6d4' },
  at_scene:     { label: 'At Scene',     color: '#8b5cf6' },
  transporting: { label: 'Transporting', color: '#f97316' },
  maintenance:  { label: 'Maintenance',  color: '#f59e0b' },
  offline:      { label: 'Offline',      color: '#64748b' },
};

const VEHICLE_TYPES = ['ALS', 'BLS', 'Neonatal', 'Bariatric', 'Bike'];

const EMPTY: Partial<Ambulance> = {
  registration_number: '', vehicle_type: 'ALS', status: 'available',
  driver_name: '', driver_phone: '', paramedic_name: '', equipment: [],
};

export default function FleetPage() {
  const [fleet, setFleet]         = useState<Ambulance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Ambulance>>(EMPTY);
  const [saving, setSaving]       = useState(false);

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/ambulances?limit=200');
      setFleet(data.data || []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const openAdd = () => { setEditing(EMPTY); setModalOpen(true); };
  const openEdit = (a: Ambulance) => { setEditing(a); setModalOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await apiFetch(`/api/ambulances/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      } else {
        await apiFetch('/api/ambulances', { method: 'POST', body: JSON.stringify(editing) });
      }
      setModalOpen(false);
      fetchFleet();
    } catch {}
    finally { setSaving(false); }
  };

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, k) => {
    acc[k] = fleet.filter(a => a.status === k).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = fleet.filter(a => {
    const matchSearch = !search ||
      a.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      a.driver_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#3b82f620', border: '1px solid #3b82f640', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={22} color="#3b82f6" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Ambulance Fleet</h1>
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{fleet.length} vehicles registered</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchFleet} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={openAdd} style={{ background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Plus size={14} /> Add Vehicle
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setFilter('all')}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterStatus === 'all' ? '#1e293b' : 'transparent', borderColor: filterStatus === 'all' ? '#3b82f6' : '#334155', color: filterStatus === 'all' ? '#3b82f6' : '#64748b' }}
          >
            All ({fleet.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterStatus === key ? `${cfg.color}20` : 'transparent', borderColor: filterStatus === key ? cfg.color : '#334155', color: filterStatus === key ? cfg.color : '#64748b' }}
            >
              {cfg.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by reg. number or driver name..."
            style={{ width: '100%', background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '11px 14px 11px 42px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* Fleet grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading fleet...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filtered.map(a => {
              const sc = STATUS_CONFIG[a.status] || { label: a.status, color: '#64748b' };
              return (
                <div key={a.id} style={{ background: '#111827', border: `1px solid ${sc.color}30`, borderRadius: 16, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{a.registration_number}</p>
                      <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>{a.vehicle_type} Ambulance</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color }} />
                      <span style={{ color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 10 }}>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 4px' }}>
                      🧑‍✈️ {a.driver_name} · 📞 {a.driver_phone}
                    </p>
                    {a.paramedic_name && (
                      <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>🩺 {a.paramedic_name}</p>
                    )}
                    {a.hospital_name && (
                      <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} /> Based at {a.hospital_name}
                      </p>
                    )}
                  </div>

                  {a.equipment?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                      {a.equipment.slice(0, 4).map(eq => (
                        <span key={eq} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#1e293b', color: '#64748b' }}>{eq}</span>
                      ))}
                    </div>
                  )}

                  <button onClick={() => openEdit(a)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, padding: '8px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Edit3 size={12} /> Edit Vehicle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#111827', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, border: '1px solid #1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing.id ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {[
              { label: 'Registration Number', key: 'registration_number', type: 'text' },
              { label: 'Driver Name', key: 'driver_name', type: 'text' },
              { label: 'Driver Phone', key: 'driver_phone', type: 'text' },
              { label: 'Paramedic Name (optional)', key: 'paramedic_name', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  type={f.type} value={(editing as any)[f.key] || ''}
                  onChange={e => setEditing(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Vehicle Type</label>
              <select value={editing.vehicle_type || 'ALS'} onChange={e => setEditing(prev => ({ ...prev, vehicle_type: e.target.value }))}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}>
                {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {editing.id && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                <select value={editing.status || 'available'} onChange={e => setEditing(prev => ({ ...prev, status: e.target.value as any }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}

            <button onClick={save} disabled={saving} style={{ width: '100%', background: '#3b82f6', border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
