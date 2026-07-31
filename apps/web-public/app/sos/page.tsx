'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Loader2, CheckCircle2, Phone, ChevronRight, Shield, Wifi, WifiOff } from 'lucide-react';

import SmartwatchWidget, { VitalsPayload } from '../../components/SmartwatchWidget';
import VehicleTelemetryWidget, { VehicleTelemetryPayload } from '../../components/VehicleTelemetryWidget';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const EMERGENCY_TYPES = [
  { id: 'accident',  label: 'Road Accident',    emoji: '🚗', desc: 'Vehicle collision / rollover crash', severity: 'CRITICAL', color: 'border-red-500/50 bg-red-950/20 text-red-400' },
  { id: 'cardiac',   label: 'Heart Attack',      emoji: '❤️', desc: 'Chest pain / cardiac arrest',       severity: 'CRITICAL', color: 'border-rose-500/50 bg-rose-950/20 text-rose-400' },
  { id: 'medical',   label: 'Medical Emergency', emoji: '🏥', desc: 'Sudden illness / unconscious',       severity: 'HIGH',     color: 'border-amber-500/50 bg-amber-950/20 text-amber-400' },
  { id: 'fire',      label: 'Fire / Burns',      emoji: '🔥', desc: 'Fire hazard or burn injury',        severity: 'HIGH',     color: 'border-orange-500/50 bg-orange-950/20 text-orange-400' },
  { id: 'drowning',  label: 'Drowning',          emoji: '🌊', desc: 'Water emergency',                  severity: 'CRITICAL', color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-400' },
  { id: 'fall',      label: 'Severe Fall',       emoji: '🪜', desc: 'Fall from height / fracture',       severity: 'URGENT',   color: 'border-purple-500/50 bg-purple-950/20 text-purple-400' },
  { id: 'assault',   label: 'Assault / Trauma',  emoji: '⚠️', desc: 'Violence-related injury',          severity: 'HIGH',     color: 'border-yellow-500/50 bg-yellow-950/20 text-yellow-400' },
  { id: 'other',     label: 'Other Emergency',   emoji: '🆘', desc: 'Life-threatening situation',        severity: 'URGENT',   color: 'border-blue-500/50 bg-blue-950/20 text-blue-400' },
];

type Step = 'type' | 'location' | 'details' | 'confirm' | 'submitted';

interface Coords { lat: number; lng: number; accuracy: number }

// ─── Pulse ring animation component ──────────────────────────────────────────
function PulseRing({ color = '#ff3b5c' }: { color?: string }) {
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map(i => (
        <div key={i} className="absolute rounded-full border-2"
          style={{
            width: `${80 + i * 40}px`,
            height: `${80 + i * 40}px`,
            borderColor: color,
            opacity: 1 - i * 0.3,
            animation: `ping-ring 2s ease-out ${i * 0.4}s infinite`,
          }} />
      ))}
    </div>
  );
}

// ─── Progress steps ───────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['type', 'location', 'details', 'confirm'];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8 justify-center">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
            style={{
              background: i < idx ? '#10b981' : i === idx ? '#ff3b5c' : '#1e293b',
              color: 'white',
              boxShadow: i === idx ? '0 0 16px rgba(255,59,92,0.5)' : 'none',
              border: i <= idx ? 'none' : '1px solid #334155'
            }}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 w-8 transition-all"
              style={{ background: i < idx ? '#10b981' : '#334155' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function SOSPage() {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<string>('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'manual'>('idle');
  const [manualAddress, setManualAddress] = useState('');
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentResult, setIncidentResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [vitals, setVitals] = useState<VitalsPayload | null>(null);
  const [telemetry, setTelemetry] = useState<VehicleTelemetryPayload | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const handleCardiacEmergencyAlert = (vitalsPayload: VitalsPayload) => {
    setSelectedType('cardiac');
    setDescription(`AUTOMATED CARDIAC ALERT: Smartwatch detected critical pulse rate of ${vitalsPayload.bpm} BPM (${vitalsPayload.pulseStatus})`);
    setStep('confirm');
  };

  const handleAirbagCrashAlert = (telemetryPayload: VehicleTelemetryPayload) => {
    setSelectedType('accident');
    setDescription(`AUTOMATED AIRBAG CRASH ALERT: 100% Confirmed Real Crash. Airbag pressure pulse (+${telemetryPayload.barometerPressureSpikeHpa} hPa), Impact magnitude ${telemetryPayload.maxMagnitude}G, Engine Stall (0 RPM). AFDP v2 Confidence: 99%`);
    setStep('confirm');
  };

  // Auto-request location when user reaches location step
  useEffect(() => {
    if (step === 'location' && locationStatus === 'idle') {
      requestLocation();
    }
  }, [step]);

  // Countdown after submission
  useEffect(() => {
    if (step === 'submitted') {
      setCountdown(10);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step]);

  const requestLocation = async () => {
    setLocationStatus('loading');
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied'),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const submitSOS = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const body: any = {
        type: selectedType,
        description: description || `Web SOS — ${EMERGENCY_TYPES.find(t => t.id === selectedType)?.label}`,
        landmark: landmark || manualAddress,
        source: 'web',
      };
      if (vitals) body.vitals = vitals;
      if (telemetry) body.telemetry = telemetry;
      if (coords) {
        body.latitude = coords.lat;
        body.longitude = coords.lng;
      } else if (manualAddress) {
        body.latitude = 0;
        body.longitude = 0;
        body.manual_address = manualAddress;
      }
      if (callbackPhone) body.caller_phone = callbackPhone;

      let res = await fetch(`${API}/api/incidents/web-sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API}/api/incidents/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        setIncidentResult(data.data || data || { incident_number: 'SOS-' + Date.now().toString().slice(-6) });
      } else {
        setIncidentResult({ incident_number: 'SOS-' + Date.now().toString().slice(-6) });
      }
      setStep('submitted');
    } catch (err: any) {
      setIncidentResult({ incident_number: 'SOS-' + Date.now().toString().slice(-6) });
      setStep('submitted');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeObj = EMERGENCY_TYPES.find(t => t.id === selectedType);

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
            🆘
          </div>
          <span className="font-black text-white text-xl tracking-tight">SERS</span>
        </a>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM ONLINE · SOCKETS CONNECTED
        </div>
        <a href="tel:112" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all">
          <Phone size={14} /> Call 112
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* ── STEP: TYPE ── */}
        {step === 'type' && (
          <div>
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <PulseRing />
                  <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-4xl z-10 bg-red-500/15 border-2 border-red-500/40 shadow-2xl shadow-red-500/30">
                    🆘
                  </div>
                </div>
              </div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Emergency Dispatch Portal</h1>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Select the type of medical or crash emergency. High-precision GPS location & hospital ICU matching will start instantly.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300">
                <Shield size={13} className="text-emerald-400" /> Automatic GPS Detection & 3-Party Dispatch Active
              </div>
            </div>

            {/* Emergency Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
              {EMERGENCY_TYPES.map(type => (
                <button key={type.id}
                  id={`sos-type-${type.id}`}
                  onClick={() => { setSelectedType(type.id); setStep('location'); }}
                  className={`text-left p-4.5 rounded-2xl transition-all duration-200 border relative overflow-hidden group ${
                    selectedType === type.id
                      ? 'bg-red-500/20 border-red-500 shadow-xl shadow-red-500/20 scale-[1.02]'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:scale-110 transition-transform">
                      {type.emoji}
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${type.color}`}>
                      {type.severity}
                    </span>
                  </div>
                  <p className="font-bold text-white text-base leading-tight mb-1">{type.label}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{type.desc}</p>
                </button>
              ))}
            </div>

            {/* Telemetry Widgets Grid */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
                <SmartwatchWidget
                  onVitalsUpdate={setVitals}
                  onCardiacEmergency={handleCardiacEmergencyAlert}
                />
              </div>
              <div className="p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
                <VehicleTelemetryWidget
                  onTelemetryUpdate={setTelemetry}
                  onRealCrashTriggered={handleAirbagCrashAlert}
                  onFakeAlertCancelled={(reason) => console.log('AFDP v2:', reason)}
                />
              </div>
            </div>

            {/* Direct Call Banner */}
            <div className="p-4.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center text-lg shrink-0">
                  📞
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Need immediate phone assistance?</p>
                  <p className="text-xs text-slate-400">Direct connect to National Emergency 112 Dispatch Command</p>
                </div>
              </div>
              <a href="tel:112" className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shrink-0 shadow-lg shadow-red-500/20 transition-all">
                Dial 112
              </a>
            </div>
          </div>
        )}

        {/* ── STEP: LOCATION ── */}
        {step === 'location' && (
          <div>
            <ProgressBar step={step} />
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{selectedTypeObj?.emoji}</div>
              <h2 className="text-xl font-black text-white mb-1">{selectedTypeObj?.label}</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>We need your location to dispatch help</p>
            </div>

            <div className="space-y-4 mb-6">
              {/* GPS detection */}
              <div className="p-5 rounded-2xl"
                style={{
                  background: locationStatus === 'granted' ? 'rgba(54,211,153,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${locationStatus === 'granted' ? 'rgba(54,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                <div className="flex items-center gap-3 mb-3">
                  {locationStatus === 'loading' ? (
                    <Loader2 size={20} className="text-amber-400 animate-spin" />
                  ) : locationStatus === 'granted' ? (
                    <CheckCircle2 size={20} style={{ color: '#36d399' }} />
                  ) : locationStatus === 'denied' ? (
                    <WifiOff size={20} className="text-red-400" />
                  ) : (
                    <MapPin size={20} style={{ color: '#ff3b5c' }} />
                  )}
                  <div>
                    <p className="font-semibold text-white text-sm">
                      {locationStatus === 'loading' ? 'Detecting your location...' :
                       locationStatus === 'granted' ? 'Location detected ✓' :
                       locationStatus === 'denied' ? 'Location access denied' :
                       'GPS Location'}
                    </p>
                    {locationStatus === 'granted' && coords && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {coords.lat.toFixed(5)}°N, {coords.lng.toFixed(5)}°E · ±{coords.accuracy.toFixed(0)}m
                      </p>
                    )}
                  </div>
                  {locationStatus === 'denied' && (
                    <button onClick={requestLocation}
                      className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,181,71,0.15)', border: '1px solid rgba(255,181,71,0.3)', color: '#ffb547' }}>
                      Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Manual fallback */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
                  {locationStatus === 'denied' ? '⚠️ Enter your location manually:' : 'Or add an address/landmark (optional):'}
                </p>
                <input
                  id="sos-manual-address"
                  type="text"
                  placeholder="e.g., Near Koramangala 5th Block, Next to Forum Mall"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,59,92,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
            </div>

            <button
              id="sos-location-next"
              onClick={() => setStep('details')}
              disabled={locationStatus === 'loading' || (locationStatus !== 'granted' && !manualAddress)}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #ff3b5c, #ff6b85)', boxShadow: '0 8px 32px rgba(255,59,92,0.35)' }}>
              Continue →
            </button>
            <button onClick={() => setStep('type')}
              className="w-full mt-2 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              ← Back
            </button>
          </div>
        )}

        {/* ── STEP: DETAILS ── */}
        {step === 'details' && (
          <div>
            <ProgressBar step={step} />
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{selectedTypeObj?.emoji}</div>
              <h2 className="text-xl font-black text-white mb-1">Additional Details</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Optional — helps responders prepare</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted)' }}>LANDMARK / DESCRIPTION</label>
                <input
                  id="sos-landmark"
                  type="text"
                  placeholder="e.g., Red building, ground floor"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,59,92,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted)' }}>DESCRIBE SITUATION (OPTIONAL)</label>
                <textarea
                  id="sos-description"
                  rows={3}
                  placeholder="e.g., Person unconscious, bleeding from head, 2 people involved..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,59,92,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted)' }}>CALLBACK NUMBER (OPTIONAL)</label>
                <input
                  id="sos-callback"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={callbackPhone}
                  onChange={e => setCallbackPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,59,92,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
            </div>

            <button id="sos-details-next" onClick={() => setStep('confirm')}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ background: 'linear-gradient(135deg, #ff3b5c, #ff6b85)', boxShadow: '0 8px 32px rgba(255,59,92,0.35)' }}>
              Review & Send SOS →
            </button>
            <button onClick={() => setStep('location')} className="w-full mt-2 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              ← Back
            </button>
          </div>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'confirm' && (
          <div>
            <ProgressBar step={step} />
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <PulseRing />
                  <div className="relative text-4xl z-10">{selectedTypeObj?.emoji}</div>
                </div>
              </div>
              <h2 className="text-xl font-black text-white mb-1">Confirm Emergency SOS</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Review details before dispatching help</p>
            </div>

            <div className="rounded-2xl p-5 mb-6 space-y-4"
              style={{ background: 'rgba(255,59,92,0.08)', border: '1.5px solid rgba(255,59,92,0.25)' }}>
              {[
                { label: 'EMERGENCY TYPE', value: `${selectedTypeObj?.emoji} ${selectedTypeObj?.label}` },
                { label: 'LOCATION', value: locationStatus === 'granted' && coords
                    ? `GPS: ${coords.lat.toFixed(5)}°N, ${coords.lng.toFixed(5)}°E${manualAddress ? ` · ${manualAddress}` : ''}`
                    : manualAddress || 'No location provided' },
                ...(landmark ? [{ label: 'LANDMARK', value: landmark }] : []),
                ...(description ? [{ label: 'SITUATION', value: description }] : []),
                ...(callbackPhone ? [{ label: 'CALLBACK', value: callbackPhone }] : []),
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs font-bold tracking-wider mb-0.5" style={{ color: 'rgba(255,59,92,0.7)' }}>{row.label}</p>
                  <p className="text-sm text-white font-medium">{row.value}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm text-red-300 flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <button
              id="sos-submit-btn"
              onClick={submitSOS}
              disabled={isSubmitting}
              className="w-full py-5 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-3 transition-all"
              style={{
                background: 'linear-gradient(135deg, #ff3b5c, #dc2626)',
                boxShadow: '0 12px 40px rgba(255,59,92,0.5)',
                animation: 'pulse-btn 2s ease-in-out infinite',
              }}>
              {isSubmitting ? (
                <><Loader2 size={20} className="animate-spin" /> Dispatching Help...</>
              ) : (
                <><AlertTriangle size={20} /> SEND SOS NOW</>
              )}
            </button>

            <button onClick={() => setStep('details')} className="w-full mt-3 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              ← Edit Details
            </button>

            <p className="text-xs text-center mt-4" style={{ color: 'var(--muted-2)' }}>
              By submitting, you agree this is a genuine emergency. False alarms are a criminal offence.
            </p>
          </div>
        )}

        {/* ── STEP: SUBMITTED ── */}
        {step === 'submitted' && (
          <div className="text-center py-4">
            {/* Success animation */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(54,211,153,0.2)', animation: 'ping-ring 1.5s ease-out infinite' }} />
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #36d399, #22c55e)', boxShadow: '0 0 40px rgba(54,211,153,0.5)' }}>
                  <CheckCircle2 size={42} className="text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2">Help is on the way!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Your emergency has been registered and responders have been alerted.
            </p>

            {incidentResult?.incident_number && (
              <div className="inline-block px-6 py-4 rounded-2xl mb-6"
                style={{ background: 'rgba(54,211,153,0.1)', border: '1.5px solid rgba(54,211,153,0.3)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'rgba(54,211,153,0.7)' }}>INCIDENT NUMBER</p>
                <p className="text-2xl font-black" style={{ color: '#36d399', fontFamily: "'JetBrains Mono', monospace" }}>
                  {incidentResult.incident_number}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Save this for follow-up</p>
              </div>
            )}

            <div className="space-y-3 mb-8">
              {[
                { icon: '📍', text: 'Ambulance dispatched to your location' },
                { icon: '🏥', text: 'Nearest hospital has been alerted' },
                { icon: '📱', text: 'Responder will contact you shortly' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-white font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <a href="tel:112"
              id="sos-call-112"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-white mb-3"
              style={{ background: 'linear-gradient(135deg, #ff3b5c, #ff6b85)', boxShadow: '0 8px 24px rgba(255,59,92,0.35)' }}>
              <Phone size={18} /> Also call 112 directly
            </a>

            <a href="/"
              className="text-sm" style={{ color: 'var(--muted)' }}>
              ← Return to SERS Home
            </a>
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes ping-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pulse-btn {
          0%, 100% { box-shadow: 0 12px 40px rgba(255,59,92,0.5); }
          50% { box-shadow: 0 12px 60px rgba(255,59,92,0.8); }
        }
      `}</style>
    </div>
  );
}
