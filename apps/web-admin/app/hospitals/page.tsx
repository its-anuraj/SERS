'use client';

/**
 * SERS Admin — Hospital Management Page
 * List, search, add and update hospitals + live bed counts
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Hospital as HospitalIcon, Plus, Search, RefreshCw, Bed, AlertCircle,
  CheckCircle, XCircle, Edit3, MapPin, Phone, X, Save, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  is_on_sers_network: boolean;
  icu_beds_total: number;
  icu_beds_available: number;
  er_beds_total: number;
  er_beds_available: number;
  specialties: string[];
  latitude: number;
  longitude: number;
  is_demo?: boolean;
}

const DEMO_HOSPITALS: Hospital[] = [
  {
    id: 'hosp-demo-1',
    name: 'City Emergency & Multi-Specialty Hospital',
    address: 'Sector 44, Golf Course Extension, Gurgaon',
    phone: '+91 124 499 1000',
    is_active: true,
    is_on_sers_network: true,
    icu_beds_total: 30,
    icu_beds_available: 12,
    er_beds_total: 50,
    er_beds_available: 28,
    specialties: ['Trauma ICU', 'Cardiac Arrest', 'Burn Care', 'Neurosurgery'],
    latitude: 28.4595,
    longitude: 77.0266,
    is_demo: true,
  },
  {
    id: 'hosp-demo-2',
    name: 'Max Super Specialty Hospital',
    address: 'Block B, Sushant Lok Phase 1, Gurgaon',
    phone: '+91 124 662 3000',
    is_active: true,
    is_on_sers_network: true,
    icu_beds_total: 45,
    icu_beds_available: 8,
    er_beds_total: 60,
    er_beds_available: 15,
    specialties: ['Emergency Trauma', 'Orthopedics', 'Cardiology', 'Pediatric ER'],
    latitude: 28.4682,
    longitude: 77.0732,
    is_demo: true,
  },
  {
    id: 'hosp-demo-3',
    name: 'Fortis Memorial Research Institute',
    address: 'Sector 44, Opposite HUDA City Centre, Gurgaon',
    phone: '+91 124 716 2200',
    is_active: true,
    is_on_sers_network: true,
    icu_beds_total: 60,
    icu_beds_available: 22,
    er_beds_total: 80,
    er_beds_available: 42,
    specialties: ['Level-1 Trauma Center', 'Organ Transplant', 'Stroke Unit'],
    latitude: 28.4571,
    longitude: 77.0725,
    is_demo: true,
  },
  {
    id: 'hosp-demo-4',
    name: 'Artemis Hospital',
    address: 'Sector 51, Gurgaon, Haryana 122001',
    phone: '+91 124 451 1111',
    is_active: true,
    is_on_sers_network: false,
    icu_beds_total: 25,
    icu_beds_available: 4,
    er_beds_total: 40,
    er_beds_available: 9,
    specialties: ['Emergency Triage', 'Cardiovascular Surgery'],
    latitude: 28.4312,
    longitude: 77.0811,
    is_demo: true,
  },
];

const EMPTY_HOSPITAL: Partial<Hospital> = {
  name: '', address: '', phone: '',
  icu_beds_total: 10, icu_beds_available: 5,
  er_beds_total: 20, er_beds_available: 10,
  specialties: ['Emergency'], is_active: true, is_on_sers_network: true,
};

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Hospital>>(EMPTY_HOSPITAL);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/hospitals?limit=100');
      const loaded = data.data || [];
      setHospitals(loaded.length > 0 ? loaded : DEMO_HOSPITALS);
    } catch {
      setHospitals(DEMO_HOSPITALS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const openAdd = () => { setEditing(EMPTY_HOSPITAL); setModalOpen(true); };
  const openEdit = (h: Hospital) => { setEditing(h); setModalOpen(true); };

  const saveHospital = async () => {
    setSaving(true);
    try {
      if (editing.id && !editing.is_demo) {
        await apiFetch(`/api/hospitals/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      } else {
        await apiFetch('/api/hospitals', { method: 'POST', body: JSON.stringify(editing) });
      }
      setModalOpen(false);
      fetchHospitals();
    } catch {
      // Local fallback for testing
      if (editing.id) {
        setHospitals(prev => prev.map(h => h.id === editing.id ? { ...h, ...editing } as Hospital : h));
      } else {
        const newHosp: Hospital = {
          id: `hosp-${Date.now()}`,
          name: editing.name || 'New Emergency Hospital',
          address: editing.address || 'Central City Road',
          phone: editing.phone || '+91 999 888 7777',
          is_active: true,
          is_on_sers_network: true,
          icu_beds_total: editing.icu_beds_total || 20,
          icu_beds_available: editing.icu_beds_available || 10,
          er_beds_total: editing.er_beds_total || 30,
          er_beds_available: editing.er_beds_available || 15,
          specialties: editing.specialties || ['Trauma ER'],
          latitude: 28.4595,
          longitude: 77.0266,
        };
        setHospitals(prev => [newHosp, ...prev]);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleNetwork = async (h: Hospital) => {
    setHospitals(prev => prev.map(item => item.id === h.id ? { ...item, is_on_sers_network: !item.is_on_sers_network } : item));
    if (!h.is_demo) {
      try {
        await apiFetch(`/api/hospitals/${h.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_on_sers_network: !h.is_on_sers_network }),
        });
      } catch {}
    }
  };

  const filtered = hospitals.filter(h =>
    h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.address?.toLowerCase().includes(search.toLowerCase())
  );

  const bedPct = (avail: number, total: number) =>
    total > 0 ? Math.round((avail / total) * 100) : 0;

  const bedColor = (pct: number) =>
    pct > 50 ? '#22c55e' : pct > 20 ? '#f97316' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center">
              <HospitalIcon size={22} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Hospital ICU & ER Bed Manager</h1>
              <p className="text-xs text-slate-400">{hospitals.length} partner hospitals registered on SERS Network</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={fetchHospitals} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={openAdd} className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Add Hospital
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Hospitals', value: hospitals.length, color: '#3b82f6' },
            { label: 'On SERS Network', value: hospitals.filter(h => h.is_on_sers_network).length, color: '#22c55e' },
            { label: 'Total ICU Beds', value: hospitals.reduce((a, h) => a + (h.icu_beds_total || 0), 0), color: '#f97316' },
            { label: 'Available ICU Beds', value: hospitals.reduce((a, h) => a + (h.icu_beds_available || 0), 0), color: '#06b6d4' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 rounded-xl border border-slate-800">
              <p className="text-xs font-medium text-slate-400 mb-1">{s.label}</p>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals by name, trauma specialty, or location..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 focus:outline-none focus:border-green-500/50"
          />
        </div>

        {/* Hospital List */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading live hospital telemetry...</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(h => {
              const icuPct = bedPct(h.icu_beds_available, h.icu_beds_total);
              const erPct  = bedPct(h.er_beds_available, h.er_beds_total);
              return (
                <div key={h.id} className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-all">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-base text-white">{h.name}</h3>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        h.is_on_sers_network
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                        {h.is_on_sers_network ? '● SERS CONNECTED' : '○ OFF-NETWORK'}
                      </span>
                      {h.is_demo && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          PRE-CONFIGURED DEMO NETWORK
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                      <MapPin size={13} className="text-slate-500 shrink-0" />
                      {h.address} · 📞 {h.phone}
                    </p>

                    {/* Bed Gauges */}
                    <div className="flex items-center gap-6 pt-1 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">ICU Beds:</span>
                        <span className="text-xs font-bold" style={{ color: bedColor(icuPct) }}>
                          {h.icu_beds_available} / {h.icu_beds_total} ({icuPct}% free)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">ER Beds:</span>
                        <span className="text-xs font-bold" style={{ color: bedColor(erPct) }}>
                          {h.er_beds_available} / {h.er_beds_total} ({erPct}% free)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {h.specialties?.map(s => (
                          <span key={s} className="text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleNetwork(h)}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                        h.is_on_sers_network
                          ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          : 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
                      }`}>
                      {h.is_on_sers_network ? 'Disconnect' : 'Connect to SERS'}
                    </button>
                    <button
                      onClick={() => openEdit(h)}
                      className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer">
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing.id ? 'Edit Hospital Telemetry' : 'Add Hospital to SERS'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Hospital Name</label>
                <input
                  value={editing.name || ''}
                  onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Address</label>
                <input
                  value={editing.address || ''}
                  onChange={e => setEditing(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Available ICU Beds</label>
                  <input
                    type="number"
                    value={editing.icu_beds_available || 0}
                    onChange={e => setEditing(prev => ({ ...prev, icu_beds_available: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Total ICU Beds</label>
                  <input
                    type="number"
                    value={editing.icu_beds_total || 0}
                    onChange={e => setEditing(prev => ({ ...prev, icu_beds_total: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveHospital}
              disabled={saving}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Hospital Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
