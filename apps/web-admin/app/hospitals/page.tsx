'use client';

/**
 * SERS Admin — Hospital Management Page
 * List, search, add and update hospitals + live bed counts
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Hospital, Plus, Search, RefreshCw, Bed, AlertCircle,
  CheckCircle, XCircle, Edit3, MapPin, Phone, X, Save
} from 'lucide-react';

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
}

const EMPTY_HOSPITAL: Partial<Hospital> = {
  name: '', address: '', phone: '',
  icu_beds_total: 0, icu_beds_available: 0,
  er_beds_total: 0, er_beds_available: 0,
  specialties: [], is_active: true, is_on_sers_network: true,
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
      setHospitals(data.data || []);
    } catch { setError('Could not load hospitals.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const openAdd = () => { setEditing(EMPTY_HOSPITAL); setModalOpen(true); };
  const openEdit = (h: Hospital) => { setEditing(h); setModalOpen(true); };

  const saveHospital = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await apiFetch(`/api/hospitals/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      } else {
        await apiFetch('/api/hospitals', { method: 'POST', body: JSON.stringify(editing) });
      }
      setModalOpen(false);
      fetchHospitals();
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const toggleNetwork = async (h: Hospital) => {
    try {
      await apiFetch(`/api/hospitals/${h.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_on_sers_network: !h.is_on_sers_network }),
      });
      fetchHospitals();
    } catch {}
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
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#22c55e20', border: '1px solid #22c55e40', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Hospital size={22} color="#22c55e" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Hospital Management</h1>
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{hospitals.length} hospitals on network</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchHospitals} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={openAdd} style={{ background: '#22c55e', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Hospital
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals by name or address..."
            style={{ width: '100%', background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 14px 12px 42px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Hospitals', value: hospitals.length, color: '#3b82f6' },
            { label: 'On SERS Network', value: hospitals.filter(h => h.is_on_sers_network).length, color: '#22c55e' },
            { label: 'Total ICU Beds', value: hospitals.reduce((a, h) => a + (h.icu_beds_total || 0), 0), color: '#f97316' },
            { label: 'Available ICU', value: hospitals.reduce((a, h) => a + (h.icu_beds_available || 0), 0), color: '#06b6d4' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 14, padding: 16 }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 26, fontWeight: 800, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading hospitals...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(h => {
              const icuPct = bedPct(h.icu_beds_available, h.icu_beds_total);
              const erPct  = bedPct(h.er_beds_available, h.er_beds_total);
              return (
                <div key={h.id} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{h.name}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: h.is_on_sers_network ? '#22c55e20' : '#ef444420', color: h.is_on_sers_network ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {h.is_on_sers_network ? '● SERS' : '○ Off-Network'}
                      </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {h.address}
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <span style={{ color: '#475569', fontSize: 11 }}>ICU: </span>
                        <span style={{ color: bedColor(icuPct), fontWeight: 700, fontSize: 13 }}>{h.icu_beds_available}/{h.icu_beds_total}</span>
                      </div>
                      <div>
                        <span style={{ color: '#475569', fontSize: 11 }}>ER: </span>
                        <span style={{ color: bedColor(erPct), fontWeight: 700, fontSize: 13 }}>{h.er_beds_available}/{h.er_beds_total}</span>
                      </div>
                      {h.specialties?.slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#1e293b', color: '#94a3b8' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => toggleNetwork(h)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                      {h.is_on_sers_network ? 'Remove from SERS' : 'Add to SERS'}
                    </button>
                    <button onClick={() => openEdit(h)} style={{ background: '#1d4ed820', border: '1px solid #1d4ed840', color: '#3b82f6', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Edit3 size={12} /> Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#111827', borderRadius: 20, padding: 28, width: '100%', maxWidth: 540, border: '1px solid #1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing.id ? 'Edit Hospital' : 'Add Hospital'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {[
              { label: 'Hospital Name', key: 'name', type: 'text' },
              { label: 'Address', key: 'address', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'text' },
              { label: 'ICU Beds Total', key: 'icu_beds_total', type: 'number' },
              { label: 'ICU Beds Available', key: 'icu_beds_available', type: 'number' },
              { label: 'ER Beds Total', key: 'er_beds_total', type: 'number' },
              { label: 'ER Beds Available', key: 'er_beds_available', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(editing as any)[f.key] || ''}
                  onChange={e => setEditing(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}

            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={saveHospital} disabled={saving} style={{ width: '100%', background: '#22c55e', border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Hospital'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
