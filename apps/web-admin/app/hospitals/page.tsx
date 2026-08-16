'use client';

/**
 * SERS Admin — My Hospital Bed & Emergency Capacity Manager
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Hospital as HospitalIcon, Plus, Search, RefreshCw,
  Edit3, MapPin, X, Save, ArrowLeft, Bed, HeartPulse,
  Activity, Phone, Shield, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '../../lib/config';

async function apiFetch(path: string, opts?: RequestInit) {
  const API = getApiUrl();
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
  city?: string;
  phone: string;
  emergency_phone?: string;
  is_active: boolean;
  is_on_sers_network: boolean;
  icu_beds_total: number;
  icu_beds_available: number;
  er_beds_total: number;
  er_beds_available: number;
  blood_inventory?: Record<string, number>;
  specialties: string[];
  latitude: number;
  longitude: number;
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [msg, setMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // My Hospital Capacity Form State
  const [myHosp, setMyHosp] = useState<Partial<Hospital>>({
    name: '',
    address: '',
    phone: '',
    icu_beds_total: 15,
    icu_beds_available: 8,
    er_beds_total: 25,
    er_beds_available: 12,
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    if (!token) {
      window.location.href = '/login';
      return;
    }
    try {
      const u = localStorage.getItem('sers_user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
  }, []);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/hospitals?limit=100');
      const list = res.data || [];
      setHospitals(list);

      const uStr = typeof window !== 'undefined' ? localStorage.getItem('sers_user') : null;
      const u = uStr ? JSON.parse(uStr) : null;
      
      const found = list.find((h: Hospital) => h.id === u?.hospitalId || h.name === u?.hospitalName || h.name === u?.hospital);
      if (found) {
        setMyHosp(found);
      } else if (u?.hospitalName || u?.hospital) {
        setMyHosp(prev => ({
          ...prev,
          name: u.hospitalName || u.hospital,
          icu_beds_total: u.icuBedsTotal || 15,
          icu_beds_available: u.icuBedsAvailable || 8,
          er_beds_total: u.erBedsTotal || 25,
          er_beds_available: u.erBedsAvailable || 12,
        }));
      }
    } catch (e) {
      console.error('Hospitals fetch error:', e);
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (myHosp.id) {
        await apiFetch(`/api/hospitals/${myHosp.id}/capacity`, {
          method: 'PUT',
          body: JSON.stringify({
            icuBedsAvailable: parseInt(String(myHosp.icu_beds_available)),
            erBedsAvailable: parseInt(String(myHosp.er_beds_available)),
          }),
        });
      } else {
        const createRes = await apiFetch('/api/hospitals', {
          method: 'POST',
          body: JSON.stringify({
            ...myHosp,
            is_active: true,
            is_on_sers_network: true,
          }),
        });
        if (createRes.success && createRes.data) {
          setMyHosp(createRes.data);
        }
      }
      setMsg({ type: 'success', text: 'Hospital bed capacity & triage availability updated live!' });
      await fetchHospitals();
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Failed to update capacity: ' + e.message });
    } finally {
      setSaving(false);
    }
  };

  const bedPct = (avail?: number, total?: number) => {
    const a = avail || 0;
    const t = total || 1;
    return Math.round((a / t) * 100);
  };

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors cursor-pointer">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
              <HospitalIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {currentUser?.hospitalName || myHosp.name || 'Hospital Emergency Bed Capacity'}
              </h1>
              <p className="text-xs text-slate-500 font-semibold">
                Manage ICU beds, ER trauma capacity, and emergency telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button onClick={fetchHospitals} className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Message */}
        {msg && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2.5 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{msg.text}</span>
            </div>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
          </div>
        )}

        {/* Live Hospital Node Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-200 rounded-3xl space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Available ICU Beds</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                🛏️
              </div>
            </div>
            <p className="text-3xl font-black text-emerald-950">{myHosp.icu_beds_available ?? 0}</p>
            <p className="text-[11px] text-emerald-700 font-bold">
              Total Capacity: {myHosp.icu_beds_total ?? 15} ({bedPct(myHosp.icu_beds_available, myHosp.icu_beds_total)}% Available)
            </p>
          </div>

          <div className="glass-card p-5 bg-gradient-to-br from-blue-50/80 to-white border border-blue-200 rounded-3xl space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-800">Available ER Beds</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                🏥
              </div>
            </div>
            <p className="text-3xl font-black text-blue-950">{myHosp.er_beds_available ?? 0}</p>
            <p className="text-[11px] text-blue-700 font-bold">
              Total Capacity: {myHosp.er_beds_total ?? 25} ({bedPct(myHosp.er_beds_available, myHosp.er_beds_total)}% Available)
            </p>
          </div>

          <div className="glass-card p-5 bg-gradient-to-br from-purple-50/80 to-white border border-purple-200 rounded-3xl space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-800">SERS Emergency Network</span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                ⚡
              </div>
            </div>
            <p className="text-xl font-black text-purple-950">Active & Online</p>
            <p className="text-[11px] text-purple-700 font-bold">
              Auto-Routing Incoming Ambulances
            </p>
          </div>
        </div>

        {/* Live Capacity Editor Form */}
        <div className="glass-card bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Edit3 size={18} className="text-emerald-600" />
              Update Real-Time Emergency Capacity
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              When you adjust your available ICU or ER beds, the SERS AI dispatch engine uses this live data to route incoming trauma cases to your facility.
            </p>
          </div>

          <form onSubmit={handleSaveCapacity} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Hospital / Node Name</label>
                <input
                  type="text"
                  required
                  value={myHosp.name || ''}
                  onChange={e => setMyHosp({ ...myHosp, name: e.target.value })}
                  placeholder="e.g. City Life Emergency Care"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Emergency Phone / Triage Desk Hotline</label>
                <input
                  type="text"
                  value={myHosp.phone || ''}
                  onChange={e => setMyHosp({ ...myHosp, phone: e.target.value })}
                  placeholder="+919876543210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Bed Adjusters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800">ICU Beds (Available / Total)</label>
                  <span className="text-xs font-black text-emerald-700">
                    {myHosp.icu_beds_available} / {myHosp.icu_beds_total}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-24">Available:</span>
                  <input
                    type="number"
                    min="0"
                    max={myHosp.icu_beds_total || 50}
                    value={myHosp.icu_beds_available ?? 0}
                    onChange={e => setMyHosp({ ...myHosp, icu_beds_available: parseInt(e.target.value) || 0 })}
                    className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-black text-emerald-800"
                  />
                  <span className="text-xs font-bold text-slate-500 w-16">Total:</span>
                  <input
                    type="number"
                    min="1"
                    value={myHosp.icu_beds_total ?? 15}
                    onChange={e => setMyHosp({ ...myHosp, icu_beds_total: parseInt(e.target.value) || 1 })}
                    className="w-20 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800">ER Beds (Available / Total)</label>
                  <span className="text-xs font-black text-blue-700">
                    {myHosp.er_beds_available} / {myHosp.er_beds_total}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-24">Available:</span>
                  <input
                    type="number"
                    min="0"
                    max={myHosp.er_beds_total || 50}
                    value={myHosp.er_beds_available ?? 0}
                    onChange={e => setMyHosp({ ...myHosp, er_beds_available: parseInt(e.target.value) || 0 })}
                    className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-black text-blue-800"
                  />
                  <span className="text-xs font-bold text-slate-500 w-16">Total:</span>
                  <input
                    type="number"
                    min="1"
                    value={myHosp.er_beds_total ?? 25}
                    onChange={e => setMyHosp({ ...myHosp, er_beds_total: parseInt(e.target.value) || 1 })}
                    className="w-20 bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-800"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all">
              <Save size={16} />
              {saving ? 'Saving Live Capacity...' : 'Save & Publish Live Bed Capacity'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
