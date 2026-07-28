'use client';

import { useEffect, useRef } from 'react';

interface Incident {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  status: string;
  landmark?: string;
}

interface LiveMapProps {
  incidents: Incident[];
}

const severityColor = (severity: string) => {
  const map: Record<string, string> = {
    critical: '#ef4444', moderate: '#f97316', minor: '#22c55e', unknown: '#94a3b8',
  };
  return map[severity] || '#94a3b8';
};

export default function LiveMap({ incidents }: LiveMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapInstanceRef.current) {
        // Initialize map centered on Bengaluru
        mapInstanceRef.current = L.map(mapRef.current!, {
          center: [12.9716, 77.5946],
          zoom: 12,
          zoomControl: true,
        });

        // Dark tile layer (CartoDB Dark)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '©OpenStreetMap ©CartoDB',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add incident markers
      incidents.forEach(incident => {
        if (!incident.lat || !incident.lng) return;

        const color = severityColor(incident.severity);
        const icon = L.divIcon({
          html: `
            <div style="
              width: 32px; height: 32px; border-radius: 50%;
              background: ${color}30; border: 2px solid ${color};
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 0 12px ${color}80;
              animation: pulse 1.5s infinite;
            ">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([incident.lat, incident.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: Inter, sans-serif; min-width: 180px;">
              <strong style="color: ${color};">${incident.severity.toUpperCase()}</strong>
              <p style="margin: 4px 0; font-size: 13px;">${incident.landmark || 'Unknown location'}</p>
              <p style="font-size: 11px; color: #94a3b8;">${incident.type} · ${incident.status}</p>
            </div>
          `);
        markersRef.current.push(marker);
      });
    };

    initMap();
  }, [incidents]);

  return (
    <div style={{ position: 'relative', height: 'calc(100% - 49px)', width: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px',
        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '12px', fontWeight: 600, color: '#e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 8px #22c55e'
        }} />
        SERS Network Active · Real-time Socket Connected
      </div>
    </div>
  );
}

