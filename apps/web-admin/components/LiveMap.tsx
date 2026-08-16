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

interface Hospital {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  icu_beds_available?: number;
  er_beds_available?: number;
  phone?: string;
}

interface Ambulance {
  id?: string;
  registration_number?: string;
  current_lat?: number;
  current_lng?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
}

export interface LiveMapProps {
  incidents: Incident[];
  hospitals?: Hospital[];
  ambulances?: Ambulance[];
  selectedIncident?: any;
  onSelectIncident?: (inc: Incident) => void;
}

const severityColor = (severity: string) => {
  const map: Record<string, string> = {
    critical: '#dc2626', moderate: '#ea580c', minor: '#16a34a', unknown: '#64748b',
  };
  return map[severity] || '#64748b';
};

export default function LiveMap({ incidents, hospitals = [], ambulances = [], selectedIncident, onSelectIncident }: LiveMapProps) {
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

      // 1. Add Hospital Markers
      hospitals.forEach(h => {
        const lat = parseFloat(String(h.latitude ?? h.lat));
        const lng = parseFloat(String(h.longitude ?? h.lng));
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = L.divIcon({
          html: `
            <div style="
              width: 32px; height: 32px; border-radius: 10px;
              background: #059669; color: #ffffff;
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; box-shadow: 0 4px 10px rgba(5,150,105,0.35);
              border: 2px solid #ffffff;
            ">
              🏥
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: inherit; min-width: 170px; padding: 4px;">
              <strong style="color: #059669; font-size: 12px; font-weight: 800;">🏥 ${h.name || 'Hospital Node'}</strong>
              <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 4px 0;">ICU Beds Avail: ${h.icu_beds_available ?? '—'} | ER: ${h.er_beds_available ?? '—'}</p>
              ${h.phone ? `<p style="font-size: 10px; color: #64748b; margin: 0;">📞 ${h.phone}</p>` : ''}
            </div>
          `);

        markersRef.current.push(marker);
      });

      // 2. Add Ambulance Markers
      ambulances.forEach(a => {
        const lat = parseFloat(String(a.current_lat ?? a.latitude));
        const lng = parseFloat(String(a.current_lng ?? a.longitude));
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = L.divIcon({
          html: `
            <div style="
              width: 32px; height: 32px; border-radius: 10px;
              background: #2563eb; color: #ffffff;
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; box-shadow: 0 4px 10px rgba(37,99,235,0.35);
              border: 2px solid #ffffff;
            ">
              🚑
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: inherit; min-width: 160px; padding: 4px;">
              <strong style="color: #2563eb; font-size: 12px; font-weight: 800;">🚑 ${a.registration_number || 'Ambulance Unit'}</strong>
              <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 4px 0;">Status: ${(a.status || 'Active').toUpperCase()}</p>
            </div>
          `);

        markersRef.current.push(marker);
      });

      // 3. Add Incident Markers
      incidents.forEach(incident => {
        const lat = parseFloat(String(incident.latitude ?? incident.lat));
        const lng = parseFloat(String(incident.longitude ?? incident.lng));
        if (isNaN(lat) || isNaN(lng)) return;

        const color = severityColor(incident.severity);
        const isSelected = selectedIncident?.id === incident.id;

        const icon = L.divIcon({
          html: `
            <div style="
              width: ${isSelected ? '38px' : '32px'}; height: ${isSelected ? '38px' : '32px'}; border-radius: 50%;
              background: #ffffff; border: 3px solid ${color};
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
              cursor: pointer; transition: transform 0.2s;
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
  }, [incidents, hospitals, ambulances, selectedIncident, onSelectIncident]);

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
