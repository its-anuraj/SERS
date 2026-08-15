'use client';

/**
 * SERS Admin — Ambulance Fleet Management Page (100% Real Live Database Data)
 */

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, RefreshCw, Edit3, MapPin, X, Save, ArrowLeft } from 'lucide-react';
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
  status: string;
  driver_name?: string;
  driver_phone?: string;
  paramedic_name?: string;
  hospital_id?: string;
  hospital_name?: string;
  current_lat?: number;
  current_lng?: number;
  equipment_list?: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:    { label: 'Available',    color: '#16a34a', bg: '#f0fdf4' },
  dispatched:   { label: 'Dispatched',   color: '#2563eb', bg: '#eff6ff' },
  en_route:     { label: 'En Route',     color: '#0891b2', bg: '#ecfeff' },
  on_scene:     { label: 'On Scene',     color: '#9333ea', bg: '#faf5ff' },
  at_scene:     { label: 'At Scene',     color: '#9333ea', bg: '#faf5ff' },
  transporting: { label: 'Transporting', color: '#ea580c', bg: '#fff7ed' },
  at_hospital:  { label: 'At Hospital',  color: '#3b82f6', bg: '#eff6ff' },
  maintenance:  { label: 'Maintenance',  color: '#d97706', bg: '#fffbeb' },
  offline:      { label: 'Offline',      color: '#64748b', bg: '#f8fafc' },
};

const EMPTY: Partial<Ambulance> = {
  registration_number: '', vehicle_type: 'als', status: 'available',
  driver_name: '', driver_phone: '', paramedic_name: '',
};

export default function FleetPage() {
  const [fleet, setFleet]         = useState<Ambulance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Ambulance>>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/ambulances?limit=200');
      setFleet(res.data || []);
    } catch (e: any) {
      console.error('Fleet fetch error:', e);
      setErrorMsg('Failed to load fleet data from database');
      setFleet([]);
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
      if (editing.id) {
        await apiFetch(`/api/ambulances/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      } else {
        await apiFetch('/api/ambulances', { method: 'POST', body: JSON.stringify(editing) });
      }
      setModalOpen(false);
      await fetchFleet();
    } catch (e: any) {
      alert('Error updating vehicle: ' + e.message);
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
      a.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.hospital_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Truck size={22} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Ambulance Fleet Dispatcher</h1>
              <p className="text-xs text-slate-500 font-semibold">{fleet.length} registered emergency units in database</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={fetchFleet} className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Add Vehicle
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

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}>
            All Vehicles ({fleet.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer"
              style={{
                background: filterStatus === key ? cfg.bg : '#ffffff',
                borderColor: filterStatus === key ? cfg.color : '#e2e8f0',
                color: filterStatus === key ? cfg.color : '#475569',
              }}>
              ● {cfg.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by registration number, driver name, or hospital..."
            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        {/* Fleet Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-500 font-semibold">Loading fleet telemetry from database...</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
            <p className="text-base font-extrabold text-slate-800">No ambulance units registered yet</p>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">When ALS/BLS ambulances and first-responder bikes are registered, their live GPS telemetry, driver assignments, and dispatch status will show here.</p>
            <button onClick={openAdd} className="mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Add Ambulance
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => {
              const sc = STATUS_CONFIG[a.status] || { label: a.status, color: '#64748b', bg: '#f8fafc' };
              return (
                <div key={a.id} className="glass-card p-5 rounded-2xl bg-white border space-y-3 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all" style={{ borderColor: '#e2e8f0' }}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">{a.registration_number}</h3>
                        <p className="text-xs text-slate-500 font-semibold uppercase">{a.vehicle_type}</p>
                      </div>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5 border" style={{ background: sc.bg, color: sc.color, borderColor: `${sc.color}40` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                        {sc.label.toUpperCase()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-700 font-medium">
                      <p><strong>Driver:</strong> 🧑‍✈️ {a.driver_name || 'Assigned on Dispatch'} {a.driver_phone ? `(${a.driver_phone})` : ''}</p>
                      {a.hospital_name && <p className="text-slate-500 flex items-center gap-1"><MapPin size={12} /> {a.hospital_name}</p>}
                    </div>

                    {a.equipment_list && a.equipment_list.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        {a.equipment_list.map(eq => (
                          <span key={eq} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                            {eq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openEdit(a)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 bg-white border border-slate-200 shadow-2xl rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">{editing.id ? 'Edit Vehicle Status' : 'Add Vehicle to Fleet'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 font-bold mb-1 block">Registration Number</label>
                <input
                  value={editing.registration_number || ''}
                  onChange={e => setEditing(prev => ({ ...prev, registration_number: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-500 font-bold mb-1 block">Vehicle Type</label>
                <select
                  value={editing.vehicle_type || 'als'}
                  onChange={e => setEditing(prev => ({ ...prev, vehicle_type: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 font-bold">
                  <option value="als">ALS (Advanced Life Support)</option>
                  <option value="bls">BLS (Basic Life Support)</option>
                  <option value="mobile_icu">Mobile ICU</option>
                  <option value="bike">First Responder Bike</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-bold mb-1 block">Status</label>
                <select
                  value={editing.status || 'available'}
                  onChange={e => setEditing(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 font-bold">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
