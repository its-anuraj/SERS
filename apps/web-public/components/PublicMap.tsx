'use client';

import { useEffect, useRef } from 'react';

interface Incident {
  id: string;
  incident_number?: string;
  type: string;
  severity: 'critical' | 'moderate' | 'minor';
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface PublicMapProps {
  incidents?: Incident[];
  selectedId?: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#22c55e',
};

const TYPE_ICON: Record<string, string> = {
  accident: '🚗', cardiac: '❤️', medical: '🏥',
  fire: '🔥', drowning: '🌊', fall: '⬇️', assault: '⚠️', other: '🆘',
};

export default function PublicMap({ incidents = [], selectedId }: PublicMapProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<Record<string, any>>({});
  const leafletRef     = useRef<any>(null);

  // Init map once
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      leafletRef.current = L;
      if (mapInstanceRef.current) return;

      mapInstanceRef.current = L.map(mapRef.current!, {
        center: [28.6139, 77.209], // Default: Delhi
        zoom: 11,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap ©CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    };

    initMap();
  }, []);

  // Update markers when incidents change
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // If no live incidents, show demo hotspots
    if (incidents.length === 0) {
      const demoHotspots = [
        { lat: 28.6139, lng: 77.2090, risk: 'critical', name: 'Connaught Place' },
        { lat: 28.6562, lng: 77.2410, risk: 'high',     name: 'Civil Lines Junction' },
        { lat: 28.5355, lng: 77.3910, risk: 'medium',   name: 'Noida Expressway' },
        { lat: 28.4595, lng: 77.0266, risk: 'low',      name: 'Gurugram Sector 29' },
      ];
      const riskColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
      demoHotspots.forEach(h => {
        const color = riskColors[h.risk];
        L.circle([h.lat, h.lng], { radius: 500, color, fillColor: color, fillOpacity: 0.12, weight: 1 }).addTo(map);
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 12px ${color};"></div>`,
          className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        });
        L.marker([h.lat, h.lng], { icon }).addTo(map).bindPopup(`<b style="color:${color}">${h.risk.toUpperCase()} RISK</b><br>${h.name}`);
      });
      return;
    }

    // Clear old markers
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

    // Add incident markers
    incidents.forEach(incident => {
      if (!incident.latitude || !incident.longitude) return;
      const color   = SEV_COLOR[incident.severity] || '#64748b';
      const emoji   = TYPE_ICON[incident.type]    || '🆘';
      const isSelected = incident.id === selectedId;
      const size    = isSelected ? 22 : 16;
      const glow    = isSelected ? `0 0 20px ${color}, 0 0 40px ${color}` : `0 0 10px ${color}`;

      const icon = L.divIcon({
        html: `
          <div style="
            position:relative;
            width:${size}px; height:${size}px;
            border-radius:50%;
            background:${color};
            border:2px solid rgba(255,255,255,0.6);
            box-shadow:${glow};
            display:flex; align-items:center; justify-content:center;
            font-size:${size * 0.7}px;
            cursor:pointer;
            transition: all 0.3s;
          ">${emoji}</div>
          ${isSelected ? `<div style="position:absolute;top:-4px;left:-4px;width:${size + 8}px;height:${size + 8}px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:ping 1s infinite;"></div>` : ''}
        `,
        className: '',
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const elapsedMin = Math.floor((Date.now() - new Date(incident.created_at).getTime()) / 60000);

      const marker = L.marker([incident.latitude, incident.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="background:#111827;border:1px solid ${color};border-radius:10px;padding:12px;min-width:180px;font-family:Inter,sans-serif;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:${color};font-weight:800;font-size:13px;">${emoji} ${incident.type?.toUpperCase()}</span>
              <span style="background:${color}20;color:${color};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">${incident.severity?.toUpperCase()}</span>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Status: <b style="color:#f1f5f9;">${incident.status?.replace('_', ' ').toUpperCase()}</b></p>
            <p style="color:#64748b;font-size:11px;margin:0;">${elapsedMin}m ago · #${(incident.incident_number || incident.id?.slice(-6))?.toUpperCase()}</p>
          </div>
        `, { className: 'custom-popup' });

      markersRef.current[incident.id] = marker;

      // Add pulse ring for critical incidents
      if (incident.severity === 'critical') {
        L.circle([incident.latitude, incident.longitude], {
          radius: 200,
          color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map);
      }
    });

    // Pan to selected
    if (selectedId && markersRef.current[selectedId]) {
      const marker = markersRef.current[selectedId];
      map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
      marker.openPopup();
    }

    // Auto-fit bounds if we have incidents
    if (incidents.length > 0) {
      const latlngs = incidents
        .filter(i => i.latitude && i.longitude)
        .map(i => [i.latitude, i.longitude] as [number, number]);
      if (latlngs.length > 0) {
        try { map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 14, animate: true }); } catch {}
      }
    }

  }, [incidents, selectedId]);

  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-popup-tip { display: none !important; }
        .leaflet-popup-content { margin: 0 !important; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.8); opacity: 0; } }
      `}</style>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </>
  );
}
