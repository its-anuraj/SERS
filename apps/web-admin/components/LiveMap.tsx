'use client';

import { useEffect, useRef } from 'react';

interface Incident {
  id: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  type: string;
  severity: string;
  status: string;
  landmark?: string;
  address?: string;
}

interface LiveMapProps {
  incidents: Incident[];
  onSelectIncident?: (inc: Incident) => void;
}

const severityColor = (severity: string) => {
  const map: Record<string, string> = {
    critical: '#dc2626', moderate: '#ea580c', minor: '#16a34a', unknown: '#64748b',
  };
  return map[severity] || '#64748b';
};

export default function LiveMap({ incidents, onSelectIncident }: LiveMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [12.9716, 77.5946],
          zoom: 12,
          zoomControl: true,
        });

        // Crisp Light Tile Layer (CartoDB Voyager)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '©OpenStreetMap ©CartoDB',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      if (!mapInstanceRef.current) return;

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add incident markers
      incidents.forEach(incident => {
        const lat = parseFloat(String(incident.latitude ?? incident.lat));
        const lng = parseFloat(String(incident.longitude ?? incident.lng));
        if (isNaN(lat) || isNaN(lng)) return;

        const color = severityColor(incident.severity);
        const icon = L.divIcon({
          html: `
            <div style="
              width: 34px; height: 34px; border-radius: 50%;
              background: #ffffff; border: 3px solid ${color};
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
              cursor: pointer;
            ">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            </div>
          `,
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: inherit; min-width: 180px; padding: 4px;">
              <strong style="color: ${color}; font-size: 12px; font-weight: 800;">🚨 ${(incident.severity || 'ALERT').toUpperCase()} EMERGENCY</strong>
              <p style="margin: 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">${incident.address || incident.landmark || 'Emergency Alert Location'}</p>
              <p style="font-size: 11px; font-weight: 600; color: #64748b; margin: 0;">${incident.type} · Status: ${incident.status}</p>
            </div>
          `);

        if (onSelectIncident) {
          marker.on('click', () => onSelectIncident(incident));
        }

        markersRef.current.push(marker);
      });

      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
      }
    };

    initMap();
  }, [incidents, onSelectIncident]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%', background: '#f8fafc' }} />
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '11px', fontWeight: 800, color: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.08)'
      }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a',
        }} />
        Live PostGIS Telemetry Radar
      </div>
    </div>
  );
}
