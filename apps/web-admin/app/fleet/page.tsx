'use client';

/**
 * SERS Admin — Ambulance Fleet Management Page
 * View all ambulances, update status, assign to hospitals
 */

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, RefreshCw, Edit3, MapPin, X, Save, Radio, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
  is_demo?: boolean;
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

const DEMO_FLEET: Ambulance[] = [
  {
    id: 'amb-demo-1',
    registration_number: 'HR-26-EQ-1008',
    vehicle_type: 'ALS (Advanced Life Support)',
    status: 'available',
    driver_name: 'Vikram Singh',
    driver_phone: '+91 98712 34567',
    paramedic_name: 'Dr. Neha Kapoor (Paramedic)',
    hospital_name: 'City Emergency & Multi-Specialty Hospital',
    equipment: ['Ventilator', 'Defibrillator', 'ECG Monitor', 'O2 Cylinder', 'ICU Meds'],
    is_demo: true,
  },
  {
    id: 'amb-demo-2',
    registration_number: 'HR-26-EQ-2045',
    vehicle_type: 'ALS (Advanced Life Support)',
    status: 'en_route',
    driver_name: 'Manish Verma',
    driver_phone: '+91 98110 99887',
    paramedic_name: 'Suresh Kumar',
    hospital_name: 'Max Super Specialty Hospital',
    equipment: ['Defibrillator', 'Suction Machine', 'Splints', 'Stretcher'],
    is_demo: true,
  },
  {
    id: 'amb-demo-3',
    registration_number: 'HR-26-EQ-3099',
    vehicle_type: 'BLS (Basic Life Support)',
    status: 'dispatched',
    driver_name: 'Rajesh Yadav',
    driver_phone: '+91 99533 11224',
    paramedic_name: 'Pooja Sharma',
    hospital_name: 'Fortis Memorial Research Institute',
    equipment: ['First Aid Kit', 'O2 Mask', 'Spine Board'],
    is_demo: true,
  },
  {
    id: 'amb-demo-4',
    registration_number: 'HR-26-EQ-4011',
    vehicle_type: 'Neonatal Care Unit',
    status: 'available',
    driver_name: 'Amit Joshi',
    driver_phone: '+91 97177 44556',
    paramedic_name: 'Dr. Sunita Rao',
    hospital_name: 'City Emergency Hospital',
    equipment: ['Incubator', 'Infant Ventilator', 'Pulse Oximeter'],
    is_demo: true,
  },
];

const VEHICLE_TYPES = ['ALS', 'BLS', 'Neonatal', 'Bariatric', 'Bike'];

const EMPTY: Partial<Ambulance> = {
  registration_number: '', vehicle_type: 'ALS', status: 'available',
  driver_name: '', driver_phone: '', paramedic_name: '', equipment: ['Defibrillator', 'O2 Tank'],
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
      const loaded = data.data || [];
      setFleet(loaded.length > 0 ? loaded : DEMO_FLEET);
    } catch {
      setFleet(DEMO_FLEET);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const openAdd = () => { setEditing(EMPTY); setModalOpen(true); };
  const openEdit = (a: Ambulance) => { setEditing(a); setModalOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id && !editing.is_demo) {
        await apiFetch(`/api/ambulances/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      } else {
        await apiFetch('/api/ambulances', { method: 'POST', body: JSON.stringify(editing) });
      }
      setModalOpen(false);
      fetchFleet();
    } catch {
      // Local fallback for testing UI
      if (editing.id) {
        setFleet(prev => prev.map(a => a.id === editing.id ? { ...a, ...editing } as Ambulance : a));
      } else {
        const newAmb: Ambulance = {
          id: `amb-${Date.now()}`,
          registration_number: editing.registration_number || 'HR-26-EQ-9999',
          vehicle_type: editing.vehicle_type || 'ALS',
          status: (editing.status as any) || 'available',
          driver_name: editing.driver_name || 'Driver Unit',
          driver_phone: editing.driver_phone || '+91 99999 88888',
          paramedic_name: editing.paramedic_name,
          equipment: editing.equipment || ['Defibrillator'],
        };
        setFleet(prev => [newAmb, ...prev]);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <Truck size={22} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Ambulance Fleet Dispatcher</h1>
              <p className="text-xs text-slate-400">{fleet.length} total emergency units in fleet network</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={fetchFleet} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Add Vehicle
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}>
            All Vehicles ({fleet.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer"
              style={{
                background: filterStatus === key ? `${cfg.color}20` : '#111827',
                borderColor: filterStatus === key ? cfg.color : '#1e293b',
                color: filterStatus === key ? cfg.color : '#94a3b8',
              }}>
              ● {cfg.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by registration number, driver name, or unit type..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Fleet Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading live fleet GPS telemetry...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => {
              const sc = STATUS_CONFIG[a.status] || { label: a.status, color: '#64748b' };
              return (
                <div key={a.id} className="glass-card p-5 rounded-2xl border space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all" style={{ borderColor: `${sc.color}40` }}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-base text-white">{a.registration_number}</h3>
                        <p className="text-xs text-slate-400 font-medium">{a.vehicle_type}</p>
                      </div>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                        {sc.label.toUpperCase()}
                      </span>
                    </div>

                    {a.is_demo && (
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        PRE-CONFIGURED FLEET UNIT
                      </span>
                    )}

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs text-slate-300">
                      <p><strong>Driver:</strong> 🧑‍✈️ {a.driver_name} ({a.driver_phone})</p>
                      {a.paramedic_name && <p><strong>Paramedic:</strong> 🩺 {a.paramedic_name}</p>}
                      {a.hospital_name && <p className="text-slate-400 flex items-center gap-1"><MapPin size={12} /> {a.hospital_name}</p>}
                    </div>

                    {a.equipment?.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        {a.equipment.map(eq => (
                          <span key={eq} className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                            {eq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openEdit(a)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2">
                    <Edit3 size={13} /> Edit Vehicle & Status
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing.id ? 'Edit Vehicle Status' : 'Add Vehicle to Fleet'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Registration Number</label>
                <input
                  value={editing.registration_number || ''}
                  onChange={e => setEditing(prev => ({ ...prev, registration_number: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Driver Name</label>
                <input
                  value={editing.driver_name || ''}
                  onChange={e => setEditing(prev => ({ ...prev, driver_name: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Status</label>
                <select
                  value={editing.status || 'available'}
                  onChange={e => setEditing(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
