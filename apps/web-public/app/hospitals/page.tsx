'use client';

/**
 * SERS Public — Hospital Directory Page
 * Search and find nearby SERS-networked hospitals with live bed availability
 */

import { useState, useEffect } from 'react';
import { Hospital, Search, MapPin, Phone, Bed, ChevronRight, ArrowLeft, Zap } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface HospitalItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  icu_beds_available: number;
  icu_beds_total: number;
  er_beds_available: number;
  er_beds_total: number;
  specialties: string[];
  latitude: number;
  longitude: number;
  distance_km?: number;
}

const SPECIALTIES = [
  'All', 'Trauma', 'Cardiac', 'Burns', 'Neuro', 'Pediatric', 'Ortho'
];

export default function HospitalDirectoryPage() {
  const [hospitals, setHospitals]   = useState<HospitalItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [specialty, setSpecialty]   = useState('All');
  const [userLocation, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Try get user location for distance sorting
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        fetchHospitals(pos.coords.latitude, pos.coords.longitude);
      }, () => fetchHospitals());
    } else {
      fetchHospitals();
    }
  }, []);

  const fetchHospitals = async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (lat && lng) { params.append('lat', String(lat)); params.append('lng', String(lng)); }
      const res  = await fetch(`${API}/api/hospitals?${params}`);
      const data = await res.json();
      setHospitals(data.data || []);
    } catch { }
    finally { setLoading(false); }
  };

  const bedColor = (avail: number, total: number) => {
    if (!total) return '#64748b';
    const pct = avail / total;
    return pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#f97316' : '#ef4444';
  };

  const bedLabel = (avail: number, total: number) => {
    if (!total) return 'Unknown';
    const pct = avail / total;
    return pct > 0.5 ? 'Good' : pct > 0.2 ? 'Limited' : 'Critical';
  };

  const filtered = hospitals.filter(h => {
    const matchSearch = !search || h.name?.toLowerCase().includes(search.toLowerCase()) || h.address?.toLowerCase().includes(search.toLowerCase());
    const matchSpec = specialty === 'All' || h.specialties?.some(s => s.toLowerCase().includes(specialty.toLowerCase()));
    return matchSearch && matchSpec;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      {/* Navbar */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#94a3b8' }}>
          <ArrowLeft size={18} /> Back
        </Link>
        <div style={{ width: 1, height: 20, background: '#1e293b' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>SERS</span>
        </div>
        <span style={{ color: '#64748b', fontSize: 14 }}>/ Hospital Directory</span>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>LIVE BED AVAILABILITY</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 12px' }}>Find a Hospital Near You</h1>
          <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>
            Real-time bed availability from {hospitals.length} SERS-networked hospitals
          </p>
        </div>

        {/* Search + Filter */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 20, padding: 20, marginBottom: 28 }}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={18} color="#64748b" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search hospitals by name or area..."
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 14px 14px 48px', color: '#f1f5f9', fontSize: 15, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SPECIALTIES.map(sp => (
              <button key={sp} onClick={() => setSpecialty(sp)}
                style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: specialty === sp ? '#ef444420' : 'transparent', borderColor: specialty === sp ? '#ef4444' : '#334155', color: specialty === sp ? '#ef4444' : '#64748b' }}>
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <p>Loading hospitals...</p>
          </div>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>{filtered.length} hospitals found</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(h => {
                const icuColor = bedColor(h.icu_beds_available, h.icu_beds_total);
                const erColor  = bedColor(h.er_beds_available, h.er_beds_total);
                return (
                  <div key={h.id} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 18, padding: 22, transition: 'border-color 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#334155')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#22c55e15', border: '1px solid #22c55e30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Hospital size={18} color="#22c55e" />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{h.name}</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={10} /> {h.address}
                            </p>
                          </div>
                        </div>

                        {/* Specialties */}
                        {h.specialties?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '10px 0' }}>
                            {h.specialties.slice(0, 5).map(s => (
                              <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bed availability */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ background: `${icuColor}15`, border: `1px solid ${icuColor}40`, borderRadius: 10, padding: '8px 12px' }}>
                          <p style={{ margin: 0, color: '#64748b', fontSize: 10, fontWeight: 700 }}>ICU BEDS</p>
                          <p style={{ margin: 0, color: icuColor, fontSize: 18, fontWeight: 800 }}>{h.icu_beds_available}<span style={{ fontSize: 12, color: '#475569' }}>/{h.icu_beds_total}</span></p>
                          <p style={{ margin: 0, color: icuColor, fontSize: 10, fontWeight: 700 }}>{bedLabel(h.icu_beds_available, h.icu_beds_total)}</p>
                        </div>
                        <div style={{ background: `${erColor}15`, border: `1px solid ${erColor}40`, borderRadius: 10, padding: '8px 12px' }}>
                          <p style={{ margin: 0, color: '#64748b', fontSize: 10, fontWeight: 700 }}>ER BEDS</p>
                          <p style={{ margin: 0, color: erColor, fontSize: 18, fontWeight: 800 }}>{h.er_beds_available}<span style={{ fontSize: 12, color: '#475569' }}>/{h.er_beds_total}</span></p>
                          <p style={{ margin: 0, color: erColor, fontSize: 10, fontWeight: 700 }}>{bedLabel(h.er_beds_available, h.er_beds_total)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '1px solid #1e293b', marginTop: 14, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <a href={`tel:${h.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                        <Phone size={13} /> {h.phone}
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                        target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13, background: '#1e293b', borderRadius: 8, padding: '6px 12px' }}>
                        Get Directions <ChevronRight size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
