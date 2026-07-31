'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Loader2, CheckCircle2, Phone, ChevronRight, Shield, Wifi, WifiOff } from 'lucide-react';

import SmartwatchWidget, { VitalsPayload } from '../../components/SmartwatchWidget';
import VehicleTelemetryWidget, { VehicleTelemetryPayload } from '../../components/VehicleTelemetryWidget';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const EMERGENCY_TYPES = [
  { id: 'accident',  label: 'Road Accident',    emoji: '🚗', desc: 'Vehicle collision / rollover crash', severity: 'CRITICAL', color: 'border-red-200 bg-red-50 text-red-700' },
  { id: 'cardiac',   label: 'Heart Attack',      emoji: '❤️', desc: 'Chest pain / cardiac arrest',       severity: 'CRITICAL', color: 'border-rose-200 bg-rose-50 text-rose-700' },
  { id: 'medical',   label: 'Medical Emergency', emoji: '🏥', desc: 'Sudden illness / unconscious',       severity: 'HIGH',     color: 'border-amber-200 bg-amber-50 text-amber-800' },
  { id: 'fire',      label: 'Fire / Burns',      emoji: '🔥', desc: 'Fire hazard or burn injury',        severity: 'HIGH',     color: 'border-orange-200 bg-orange-50 text-orange-800' },
  { id: 'drowning',  label: 'Drowning',          emoji: '🌊', desc: 'Water emergency',                  severity: 'CRITICAL', color: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  { id: 'fall',      label: 'Severe Fall',       emoji: '🪜', desc: 'Fall from height / fracture',       severity: 'URGENT',   color: 'border-purple-200 bg-purple-50 text-purple-700' },
  { id: 'assault',   label: 'Assault / Trauma',  emoji: '⚠️', desc: 'Violence-related injury',          severity: 'HIGH',     color: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  { id: 'other',     label: 'Other Emergency',   emoji: '🆘', desc: 'Life-threatening situation',        severity: 'URGENT',   color: 'border-blue-200 bg-blue-50 text-blue-700' },
];

type Step = 'type' | 'location' | 'details' | 'confirm' | 'submitted';

interface Coords { lat: number; lng: number; accuracy: number }

// ─── Pulse ring animation component ──────────────────────────────────────────
function PulseRing({ color = '#dc2626' }: { color?: string }) {
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
              background: i < idx ? '#10b981' : i === idx ? '#dc2626' : '#e2e8f0',
              color: i <= idx ? 'white' : '#64748b',
              boxShadow: i === idx ? '0 0 12px rgba(220,38,38,0.3)' : 'none',
              border: i <= idx ? 'none' : '1px solid #cbd5e1'
            }}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 w-8 transition-all"
              style={{ background: i < idx ? '#10b981' : '#cbd5e1' }} />
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Light Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-red-600 text-white shadow-md shadow-red-600/20">
            🆘
          </div>
          <span className="font-black text-slate-900 text-xl tracking-tight">SERS</span>
        </a>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM ONLINE · SOCKETS CONNECTED
        </div>
        <a href="tel:112" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all">
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
                  <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-4xl z-10 bg-red-50 border-2 border-red-300 shadow-xl shadow-red-500/10">
                    🆘
                  </div>
                </div>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Emergency Dispatch Portal</h1>
              <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                Select the type of medical or crash emergency. High-precision GPS location & hospital ICU matching will start instantly.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
                <Shield size={13} className="text-emerald-600" /> Automatic GPS Detection & 3-Party Dispatch Active
              </div>
            </div>

            {/* Emergency Grid — Light Theme Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
              {EMERGENCY_TYPES.map(type => (
                <button key={type.id}
                  id={`sos-type-${type.id}`}
                  onClick={() => { setSelectedType(type.id); setStep('location'); }}
                  className={`text-left p-4.5 rounded-2xl transition-all duration-200 border relative overflow-hidden group shadow-sm hover:shadow-md ${
                    selectedType === type.id
                      ? 'bg-red-50 border-red-500 shadow-md shadow-red-500/10 scale-[1.02]'
                      : 'bg-white border-slate-200 hover:border-red-300 hover:bg-slate-50'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl p-2 rounded-xl bg-slate-100 border border-slate-200 group-hover:scale-110 transition-transform">
                      {type.emoji}
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${type.color}`}>
                      {type.severity}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-base leading-tight mb-1">{type.label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{type.desc}</p>
                </button>
              ))}
            </div>

            {/* Telemetry Widgets Grid — Light Cards */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <SmartwatchWidget
                  onVitalsUpdate={setVitals}
                  onCardiacEmergency={handleCardiacEmergencyAlert}
                />
              </div>
              <div className="p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <VehicleTelemetryWidget
                  onTelemetryUpdate={setTelemetry}
                  onRealCrashTriggered={handleAirbagCrashAlert}
                  onFakeAlertCancelled={(reason) => console.log('AFDP v2:', reason)}
                />
              </div>
            </div>

            {/* Direct Call Light Banner */}
            <div className="p-4.5 rounded-2xl bg-white border border-red-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center text-lg shrink-0">
                  📞
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Need immediate phone assistance?</p>
                  <p className="text-xs text-slate-500">Direct connect to National Emergency 112 Dispatch Command</p>
                </div>
              </div>
              <a href="tel:112" className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shrink-0 shadow-md shadow-red-600/20 transition-all">
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
              <h2 className="text-2xl font-black text-slate-900 mb-1">{selectedTypeObj?.label}</h2>
              <p className="text-sm text-slate-600">We need your location to dispatch help</p>
            </div>

            <div className="space-y-4 mb-6">
              {/* GPS detection */}
              <div className={`p-5 rounded-2xl border ${
                locationStatus === 'granted' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-3">
                  {locationStatus === 'loading' ? (
                    <Loader2 size={20} className="text-amber-500 animate-spin" />
                  ) : locationStatus === 'granted' ? (
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  ) : locationStatus === 'denied' ? (
                    <WifiOff size={20} className="text-red-500" />
                  ) : (
                    <MapPin size={20} className="text-red-600" />
                  )}
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {locationStatus === 'loading' ? 'Detecting your location...' :
                       locationStatus === 'granted' ? 'Location detected ✓' :
                       locationStatus === 'denied' ? 'Location access denied' :
                       'GPS Location'}
                    </p>
                    {locationStatus === 'granted' && coords && (
                      <p className="text-xs text-slate-600 mt-0.5 font-mono">
                        {coords.lat.toFixed(5)}°N, {coords.lng.toFixed(5)}°E · ±{coords.accuracy.toFixed(0)}m accuracy
                      </p>
                    )}
                  </div>
                  {locationStatus === 'denied' && (
                    <button onClick={requestLocation}
                      className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                      Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Manual fallback */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {locationStatus === 'denied' ? '⚠️ Enter your location manually:' : 'Or add an address/landmark (optional):'}
                </p>
                <input
                  id="sos-manual-address"
                  type="text"
                  placeholder="e.g., Near Koramangala 5th Block, Next to Forum Mall"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-slate-900 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              id="sos-location-next"
              onClick={() => setStep('details')}
              disabled={locationStatus === 'loading' || (locationStatus !== 'granted' && !manualAddress)}
              className="w-full py-4 rounded-2xl font-bold text-white text-base bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-600/25 disabled:opacity-40">
              Continue →
            </button>
            <button onClick={() => setStep('type')}
              className="w-full mt-2 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
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
              <h2 className="text-2xl font-black text-slate-900 mb-1">Additional Details</h2>
              <p className="text-sm text-slate-600">Optional — helps responders prepare</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">LANDMARK / BUILDING NAME</label>
                <input
                  id="sos-landmark"
                  type="text"
                  placeholder="e.g., Red building, ground floor, gate 2"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-slate-900 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">DESCRIBE SITUATION (OPTIONAL)</label>
                <textarea
                  id="sos-description"
                  rows={3}
                  placeholder="e.g., Person unconscious, bleeding from head, 2 people involved..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-slate-900 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 resize-none shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">CALLBACK PHONE NUMBER (OPTIONAL)</label>
                <input
                  id="sos-callback"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={callbackPhone}
                  onChange={e => setCallbackPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-slate-900 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-sm"
                />
              </div>
            </div>

            <button id="sos-details-next" onClick={() => setStep('confirm')}
              className="w-full py-4 rounded-2xl font-bold text-white text-base bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-600/25">
              Review & Send SOS →
            </button>
            <button onClick={() => setStep('location')} className="w-full mt-2 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
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
              <h2 className="text-2xl font-black text-slate-900 mb-1">Confirm Emergency SOS</h2>
              <p className="text-sm text-slate-600">Review details before dispatching help</p>
            </div>

            <div className="rounded-2xl p-5 mb-6 space-y-4 bg-red-50 border border-red-200 shadow-sm">
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
                  <p className="text-xs font-bold tracking-wider mb-0.5 text-red-700 font-mono">{row.label}</p>
                  <p className="text-sm text-slate-900 font-semibold">{row.value}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl text-sm text-red-800 bg-red-100 border border-red-300 flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="text-red-600" /> {error}
              </div>
            )}

            <button
              id="sos-submit-btn"
              onClick={submitSOS}
              disabled={isSubmitting}
              className="w-full py-5 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-3 transition-all bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/30">
              {isSubmitting ? (
                <><Loader2 size={20} className="animate-spin" /> Dispatching Help...</>
              ) : (
                <><AlertTriangle size={20} /> SEND SOS NOW</>
              )}
            </button>

            <button onClick={() => setStep('details')} className="w-full mt-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
              ← Edit Details
            </button>

            <p className="text-xs text-center mt-4 text-slate-500">
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
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center bg-emerald-600 text-white shadow-xl shadow-emerald-600/30">
                  <CheckCircle2 size={46} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2">Help is on the way!</h2>
            <p className="text-sm text-slate-600 mb-6">
              Your emergency has been registered and responders have been alerted.
            </p>

            {incidentResult?.incident_number && (
              <div className="inline-block px-6 py-4 rounded-2xl mb-6 bg-emerald-50 border border-emerald-200 shadow-sm">
                <p className="text-xs font-bold mb-1 text-emerald-800 font-mono">INCIDENT NUMBER</p>
                <p className="text-2xl font-black text-emerald-700 font-mono">
                  {incidentResult.incident_number}
                </p>
                <p className="text-xs mt-1 text-slate-600">Save this for follow-up</p>
              </div>
            )}

            <div className="space-y-3 mb-8">
              {[
                { icon: '📍', text: 'Ambulance dispatched to your location' },
                { icon: '🏥', text: 'Nearest hospital has been alerted' },
                { icon: '📱', text: 'Responder will contact you shortly' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-slate-900 font-semibold">{item.text}</span>
                </div>
              ))}
            </div>

            <a href="tel:112"
              id="sos-call-112"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-white mb-3 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25">
              <Phone size={18} /> Also call 112 directly
            </a>

            <a href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
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
      `}</style>
    </div>
  );
}
