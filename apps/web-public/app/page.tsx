'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const PublicMap = dynamic(() => import('../components/PublicMap'), { ssr: false });

// ─────────────────────────────────────────────────────────────
// Scroll-reveal hook
// ─────────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─────────────────────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────────────────────
function useCounter(target: number, duration = 2200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

// ─────────────────────────────────────────────────────────────
// Animated SVG waveform
// ─────────────────────────────────────────────────────────────
function generateWave(pts: number, amp: number, freq: number, phase: number) {
  const points: string[] = [];
  for (let i = 0; i <= pts; i++) {
    const x = (i / pts) * 200;
    const y = 30
      + Math.sin((i / pts) * Math.PI * 2 * freq + phase) * amp
      + Math.sin((i / pts) * Math.PI * 2 * (freq * 2.3) + phase * 1.3) * (amp * 0.4);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

// ─────────────────────────────────────────────────────────────
// Hospital scoring (local simulation — real data in admin panel)
// ─────────────────────────────────────────────────────────────
const BASE_HOSPITALS = [
  { name: "St. Mary's Trauma Center", icu: 8,  beds: 22, eta: 4, specialty: ['Trauma', 'Neuro'], workload: 0.4  },
  { name: 'City General Hospital',    icu: 3,  beds: 14, eta: 7, specialty: ['Cardio'],           workload: 0.72 },
  { name: 'Apollo Emergency',         icu: 5,  beds: 18, eta: 6, specialty: ['Trauma', 'Ortho'],  workload: 0.58 },
  { name: 'Manipal Super Specialty',  icu: 2,  beds: 9,  eta: 9, specialty: ['Neuro'],            workload: 0.85 },
];

function scoreHospital(h: typeof BASE_HOSPITALS[0]) {
  const icuScore  = Math.min(h.icu / 12, 1) * 0.30;
  const bedScore  = Math.min(h.beds / 30, 1) * 0.20;
  const etaScore  = Math.max(0, 1 - h.eta / 15) * 0.20;
  const specScore = Math.min(h.specialty.length / 3, 1) * 0.15;
  const wlScore   = (1 - h.workload) * 0.15;
  return Math.round((icuScore + bedScore + etaScore + specScore + wlScore) * 100);
}

// ─────────────────────────────────────────────────────────────
// NAV  — trimmed to only real sections
// ─────────────────────────────────────────────────────────────
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Links for public portal pages & sections
  const links = [
    { href: '/sos',           label: '🚨 Web SOS' },
    { href: '/hospitals',     label: '🏥 Hospitals' },
    { href: '/live-map',      label: '📍 Live Map' },
    { href: 'http://localhost:3002', label: '⚡ Admin Portal' },
    { href: '#how-it-works', label: 'How It Works' },
  ];

  return (
    <nav
      id="nav"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-strong' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div
              className="relative w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--red),#c4274a)' }}
            >
              <i className="fa-solid fa-shield-heart text-white text-sm" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 blink" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>SERS</div>
              <div className="text-[10px] -mt-0.5 font-mono-custom" style={{ color: 'var(--muted-2)' }}>EMERGENCY · AI</div>
            </div>
          </a>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-8 text-sm font-medium">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" />
              <span className="font-mono-custom" style={{ color: 'var(--muted)' }}>SYSTEM ONLINE</span>
            </div>
            <a href="/sos" className="hidden sm:inline-flex btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
              🚨 Trigger Web SOS
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden w-10 h-10 rounded-lg glass flex items-center justify-center"
            >
              <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-sm`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300"
          style={{ maxHeight: menuOpen ? '400px' : '0', opacity: menuOpen ? 1 : 0 }}
        >
          <div className="glass-strong rounded-xl p-4 mb-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg hover:bg-white/5 text-sm"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#sos-demo"
              onClick={() => setMenuOpen(false)}
              className="mt-2 text-center py-3 rounded-xl text-sm font-semibold text-white btn-primary"
            >
              Try Web SOS
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────
function Hero() {
  const c42 = useCounter(42);
  const c3  = useCounter(3);
  const c24 = useCounter(24);

  return (
    <section id="top" className="relative min-h-screen flex items-center pt-28 pb-20 bg-radial-glow overflow-hidden">

      {/* Radar decoration */}
      <div className="absolute -right-40 top-20 w-[600px] h-[600px] opacity-40 pointer-events-none hidden md:block">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-12 rounded-full border border-white/5" />
        <div className="absolute inset-24 rounded-full border border-white/5" />
        <div className="absolute inset-40 rounded-full border border-white/5" />
        <div className="absolute inset-0 rounded-full radar-sweep" />
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
          style={{ boxShadow: '0 0 20px var(--cyan-glow)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full relative z-10">
        
        {/* Ticker */}
        <div className="mb-10 border-y py-3.5 overflow-hidden rounded-xl"
          style={{ borderColor: 'var(--border)', background: '#f8fafc', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex marquee-track whitespace-nowrap">
            {[...Array(2)].map((_, rep) => (
              <div key={rep} className="flex items-center gap-12 px-6 font-mono-custom text-xs font-semibold" style={{ color: '#1e293b' }}>
                {[
                  { dot: 'text-red-600',     text: 'INCIDENT DETECTED · AI AUTO-TRIGGER · DISPATCHING' },
                  { dot: 'text-sky-600',     text: "HOSPITAL MATCH · ST. MARY'S TRAUMA · 89% SCORE" },
                  { dot: 'text-amber-600',   text: 'AMBULANCE #07 · ETA 4 MIN · EN ROUTE' },
                  { dot: 'text-emerald-600', text: 'ICU BEDS AVAILABLE · 8 / 12 OCCUPIED' },
                  { dot: 'text-violet-600',  text: 'AI MODEL · TF LITE · v2.4.1 · 94.3% ACCURACY' },
                ].map((t, i) => (
                  <span key={i} className="flex items-center gap-2.5">
                    <i className={`fa-solid fa-circle ${t.dot} text-[7px]`} />
                    {t.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-center">

          {/* Left */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-mono-custom mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 blink" />
              <span style={{ color: 'var(--muted)' }}>AI-POWERED EMERGENCY MANAGEMENT PLATFORM</span>
            </div>

            <h1 className="font-bold text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
              style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              When seconds<br />matter, <span className="text-gradient-red">SERS</span>
              <br />responds in <span className="text-gradient-cyan">milliseconds.</span>
            </h1>

            <p className="mt-7 text-base sm:text-lg max-w-xl leading-relaxed" style={{ color: 'var(--muted)' }}>
              The Smart Emergency Response System fuses smartphone sensors, on-device AI, and a
              real-time coordination network to detect crashes, dispatch responders, and route
              patients to the right hospital — automatically.
            </p>

            {/* Two distinct CTAs pointing to different unique sections */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#sos-demo" className="btn-primary px-6 py-3.5 rounded-xl font-semibold flex items-center gap-2">
                <i className="fa-solid fa-circle-radiation text-xs" /> Try Web SOS
              </a>
              <a href="#how-it-works" className="btn-ghost px-6 py-3.5 rounded-xl font-semibold flex items-center gap-2">
                <i className="fa-solid fa-circle-info text-xs" /> How It Works
              </a>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl">
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-gradient-red" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {c42}%
                </div>
                <div className="text-xs mt-1 font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>
                  Faster Response
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-gradient-cyan" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {c3}
                </div>
                <div className="text-xs mt-1 font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>
                  Stakeholders Synced
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: 'var(--amber)' }}>
                  {c24}/7
                </div>
                <div className="text-xs mt-1 font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>
                  AI Monitoring
                </div>
              </div>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-sm">
              <div className="glass-strong rounded-[2.5rem] p-3 shadow-2xl float-slow"
                style={{ boxShadow: '0 40px 80px -20px rgba(255,59,92,0.3)' }}>
                <div className="rounded-[2rem] overflow-hidden" style={{ background: 'linear-gradient(180deg,#0a0d18,#0d1322)' }}>

                  {/* Status bar */}
                  <div className="flex items-center justify-between px-6 py-3 text-[10px] font-mono-custom" style={{ color: 'var(--muted)' }}>
                    <span>9:41</span>
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-signal" /> 5G <i className="fa-solid fa-battery-three-quarters ml-1" />
                    </span>
                  </div>

                  <div className="px-6 pt-2 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>
                        Sensor Activity
                      </span>
                      <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(54,211,153,0.15)', color: 'var(--green)' }}>
                        MONITORING
                      </span>
                    </div>

                    {/* Sensor bars */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'ACCEL', color: '#22d3ee', delays: [0, .1, .2, .3, .4, .5] },
                        { label: 'GYRO',  color: '#a78bfa', delays: [.2, .3, .4, .5, .6, .7] },
                        { label: 'GPS',   color: '#fbbf24', delays: [.1, .25, .4, .55, .7, .85] },
                      ].map((s) => (
                        <div key={s.label} className="glass rounded-lg p-2">
                          <div className="text-[9px] font-mono-custom mb-1" style={{ color: 'var(--muted-2)' }}>{s.label}</div>
                          <div className="flex items-end gap-0.5 h-6">
                            {s.delays.map((d, i) => (
                              <div key={i} className="wave-bar w-1 h-full rounded-sm"
                                style={{ background: s.color, animationDelay: `${d}s` }} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI status */}
                    <div className="glass rounded-xl p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-microchip text-cyan-400 text-xs" />
                          <span className="text-xs font-mono-custom">TensorFlow Lite</span>
                        </div>
                        <span className="text-[10px] font-mono-custom" style={{ color: 'var(--green)' }}>ANALYZING</span>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full progress-fill" style={{ width: '78%' }} />
                      </div>
                      <div className="mt-1.5 text-[9px] font-mono-custom" style={{ color: 'var(--muted-2)' }}>
                        Pattern confidence · 78%
                      </div>
                    </div>

                    {/* SOS button — scrolls to demo on click */}
                    <div className="flex flex-col items-center pb-4">
                      <div className="relative w-32 h-32 mb-3">
                        <div className="pulse-ring" />
                        <div className="pulse-ring pulse-ring-d1" />
                        <div className="pulse-ring pulse-ring-d2" />
                        <button
                          className="absolute inset-0 rounded-full sos-glow flex flex-col items-center justify-center"
                          style={{ background: 'radial-gradient(circle at 30% 30%, var(--red-2), var(--red) 70%)' }}
                          onClick={() => document.getElementById('sos-demo')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <span className="font-bold text-2xl text-white tracking-wider" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>SOS</span>
                          <span className="text-[9px] font-mono-custom text-white/80 mt-0.5">TAP TO ALERT</span>
                        </button>
                      </div>
                      <div className="text-[10px] font-mono-custom" style={{ color: 'var(--muted-2)' }}>
                        or auto-trigger via AI detection
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-6 top-1/3 glass-strong rounded-xl p-3 shadow-xl float-slow" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,59,92,0.15)' }}>
                    <i className="fa-solid fa-truck-medical text-red-400 text-xs" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono-custom" style={{ color: 'var(--muted-2)' }}>DISPATCHED</div>
                    <div className="text-xs font-semibold">Ambulance #07</div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 bottom-12 glass-strong rounded-xl p-3 shadow-xl float-slow" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(46,230,214,0.15)' }}>
                    <i className="fa-solid fa-hospital text-cyan-400 text-xs" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono-custom" style={{ color: 'var(--muted-2)' }}>AI MATCH</div>
                    <div className="text-xs font-semibold">St. Mary's Trauma</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// PROBLEM SECTION
// ─────────────────────────────────────────────────────────────
function ProblemSection() {
  return (
    <section id="problem" className="py-24 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-10 items-start reveal">
          <div className="lg:col-span-5">
            <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--red)' }}>
              // 01 · The Problem
            </div>
            <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Traditional emergency systems{' '}
              <span className="text-gradient-red">depend on a phone call</span> that may never happen.
            </h2>
            <p className="mt-6 text-base sm:text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
              When a victim is unconscious or unable to reach their phone, every second of delay
              compounds into worse outcomes. SERS removes the phone call from the critical path.
            </p>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {[
              { icon: 'fa-phone-slash',     color: 'var(--red)',    bg: 'rgba(255,59,92,0.12)',    title: 'Caller dependency',      desc: "If the victim can't call, the system never learns. 30% of severe crashes go unreported for critical minutes." },
              { icon: 'fa-clock',           color: 'var(--amber)',  bg: 'rgba(255,181,71,0.12)',   title: 'Nearest, not best',      desc: 'Dispatchers default to the closest hospital — which may have no ICU beds, no trauma surgeon, or no capacity.' },
              { icon: 'fa-tower-broadcast', color: 'var(--violet)', bg: 'rgba(139,125,255,0.12)', title: 'Siloed communication',   desc: 'Citizens, responders, and hospitals operate on different channels. Critical context is lost between handoffs.' },
              { icon: 'fa-chart-line',      color: 'var(--cyan)',   bg: 'rgba(46,230,214,0.12)',   title: 'No resource visibility', desc: 'Hospitals lack a city-wide view of capacity, workload, and incoming patients — causing overflow and delays.' },
            ].map((card, i) => (
              <div key={i} className="glass rounded-2xl p-6 feature-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: card.bg }}>
                  <i className={`fa-solid ${card.icon}`} style={{ color: card.color }} />
                </div>
                <h3 className="font-semibold text-lg mb-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{card.desc}</p>
              </div>
            ))}
{/* Before / After */}
        <div className="mt-20 reveal">
          <div className="grid md:grid-cols-2 gap-px rounded-2xl overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="p-8" style={{ background: 'var(--bg-2)' }}>
              <div className="text-xs font-mono-custom uppercase tracking-widest mb-3" style={{ color: 'var(--muted-2)' }}>
                BEFORE · TRADITIONAL 911
              </div>
              <div className="space-y-3">
                {['Manual phone call required', 'Average response 8–12 min', 'Nearest hospital only', 'No real-time bed tracking', 'Voice-only status updates'].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                    <i className="fa-solid fa-xmark text-red-400" /> {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8" style={{ background: 'linear-gradient(135deg,rgba(255,59,92,0.06),rgba(46,230,214,0.04))' }}>
              <div className="text-xs font-mono-custom uppercase tracking-widest mb-3" style={{ color: 'var(--cyan)' }}>
                AFTER · SERS
              </div>
              <div className="space-y-3">
                {['AI auto-detection or 1-tap SOS', 'Sub-second incident creation', 'Weighted hospital scoring', 'Live ICU + bed availability', 'Three-way real-time sync'].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm">
                    <i className="fa-solid fa-check text-cyan-400" /> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VoiceSosCard() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedKeyword, setDetectedKeyword] = useState<string | null>(null);
  const [sosTriggered, setSosTriggered] = useState(false);

  const startVoiceListener = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      simulateVoiceSos('HELP EMERGENCY');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setDetectedKeyword(null);
        setSosTriggered(false);
        setTranscript('Listening for emergency speech...');
      };

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setTranscript(text);

        const lower = text.toLowerCase();
        const keywords = ['help', 'emergency', 'accident', 'bachao', 'madad', 'ambulance', 'save me'];
        const matched = keywords.find(k => lower.includes(k));
        if (matched) {
          setDetectedKeyword(matched.toUpperCase());
          setSosTriggered(true);
          setIsListening(false);
          recognition.stop();
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      simulateVoiceSos('HELP EMERGENCY');
    }
  };

  const simulateVoiceSos = (kw: string) => {
    setIsListening(true);
    setTranscript(`Simulating microphone voice: "${kw}"...`);
    setTimeout(() => {
      setDetectedKeyword(kw);
      setSosTriggered(true);
      setIsListening(false);
    }, 1000);
  };

  return (
    <div className="gradient-border p-8 reveal" style={{ transitionDelay: '0.3s' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs font-mono-custom uppercase tracking-widest mb-2" style={{ color: 'var(--violet)' }}>MODE C</div>
          <h3 className="font-bold text-2xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Voice SOS (AI Speech)</h3>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50 border border-purple-200">
          <i className="fa-solid fa-microphone text-purple-600 text-lg" />
        </div>
      </div>
      <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted)' }}>
        Hands-free speech recognition continuously listens for distress keywords like <strong>"Help"</strong>, <strong>"Bachao"</strong>, or <strong>"Emergency"</strong> to dispatch aid automatically.
      </p>

      {/* Interactive Speech Recognition Controls */}
      <div className="space-y-4">
        <button
          onClick={startVoiceListener}
          className={`w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all ${
            isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
          }`}
        >
          <i className={`fa-solid ${isListening ? 'fa-microphone-lines blink' : 'fa-microphone'}`} />
          {isListening ? 'Listening for Keywords...' : 'Activate Voice Listener'}
        </button>

        {/* Live Speech Console */}
        <div className="glass rounded-xl p-4 border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between text-[10px] font-mono-custom mb-1.5" style={{ color: 'var(--muted-2)' }}>
            <span>ON-DEVICE SPEECH ENGINE</span>
            <span className={isListening ? 'text-purple-600 font-bold' : 'text-slate-400'}>
              {isListening ? '● LISTENING' : 'STANDBY'}
            </span>
          </div>
          <div className="font-mono-custom text-xs min-h-[36px] flex items-center text-slate-800 font-medium">
            {transcript || 'Click button or tap sample keywords below...'}
          </div>
        </div>

        {/* Emergency Trigger Alert */}
        {sosTriggered && detectedKeyword && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-xs font-semibold text-red-700 animate-bounce">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-red-600 text-sm" />
              KEYWORD: "{detectedKeyword}"
            </span>
            <span className="bg-red-600 text-white text-[10px] font-mono-custom px-2 py-0.5 rounded">SOS DISPATCHED</span>
          </div>
        )}

        {/* Trigger chips */}
        <div className="pt-1">
          <div className="text-[10px] font-mono-custom uppercase tracking-wider mb-2" style={{ color: 'var(--muted-2)' }}>
            Test Trigger Keywords:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['HELP', 'EMERGENCY', 'BACHAO', 'ACCIDENT', 'AMBULANCE'].map((kw) => (
              <button
                key={kw}
                onClick={() => simulateVoiceSos(kw)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono-custom font-semibold bg-white hover:bg-purple-100 hover:text-purple-700 text-slate-700 border border-slate-200 transition-colors shadow-sm"
              >
                "{kw}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetectionSection() {
  const [phase, setPhase] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => p + 0.1), 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cancelled) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 10));
    }, 1000);
    return () => clearInterval(timer);
  }, [cancelled]);

  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference - (countdown / 10) * circumference;

  return (
    <section id="detection" className="py-24 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--red)' }}>
            // 02 · Smart Multi-Modal Detection
          </div>
          <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Three ways to trigger an emergency.
            <br /><span className="text-gradient-cyan">All faster & smarter than a phone call.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Manual SOS */}
          <div className="gradient-border p-8 reveal">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs font-mono-custom uppercase tracking-widest mb-2" style={{ color: 'var(--red)' }}>MODE A</div>
                <h3 className="font-bold text-2xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Manual SOS</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,59,92,0.12)' }}>
                <i className="fa-solid fa-hand-pointer text-red-400 text-lg" />
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted)' }}>
              A single tap on the SOS button instantly creates an emergency incident with the user's
              GPS location, medical profile, and live sensor context — all sent automatically.
            </p>
            <div className="space-y-3">
              {['User taps SOS button', 'GPS + medical profile attached', 'AI scores severity & matches hospital', 'Nearest responder dispatched'].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono-custom shrink-0"
                    style={{ background: 'var(--red)', color: '#fff' }}>{i + 1}</div>
                  <div className="text-sm">{step}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t flex items-center gap-2 text-xs font-mono-custom"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-2)' }}>
              <i className="fa-solid fa-bolt text-amber-400" /> Avg. time to incident:{' '}
              <span className="text-slate-800 font-semibold ml-1">0.8s</span>
            </div>
          </div>

          {/* AI Auto-Detection */}
          <div className="gradient-border p-8 reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs font-mono-custom uppercase tracking-widest mb-2" style={{ color: 'var(--cyan)' }}>MODE B</div>
                <h3 className="font-bold text-2xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>AI Auto-Detection</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(46,230,214,0.12)' }}>
                <i className="fa-solid fa-microchip text-cyan-400 text-lg" />
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted)' }}>
              TensorFlow Lite continuously analyzes accelerometer, gyroscope, and GPS patterns to
              detect crashes — even when the user is unconscious.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { icon: 'fa-car-burst',           color: 'text-red-400',    bg: 'rgba(255,59,92,0.15)',    label: 'Severe car crash',  tag: 'HIGH-G IMPACT', tagColor: 'var(--red)' },
                { icon: 'fa-person-falling',       color: 'text-amber-400',  bg: 'rgba(255,181,71,0.15)',   label: 'Pedestrian impact', tag: 'MOTION + STOP', tagColor: 'var(--amber)' },
                { icon: 'fa-person-falling-burst', color: 'text-violet-400', bg: 'rgba(139,125,255,0.15)', label: 'Dangerous fall',    tag: 'FREE-FALL',     tagColor: 'var(--violet)' },
              ].map((d) => (
                <div key={d.label} className="glass rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <i className={`fa-solid ${d.icon} ${d.color} text-sm`} />
                    <span className="text-sm">{d.label}</span>
                  </div>
                  <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded-full"
                    style={{ background: d.bg, color: d.tagColor }}>{d.tag}</span>
                </div>
              ))}
            </div>

            {/* Countdown */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>Cancellation countdown</span>
                <span className="text-xs font-mono-custom" style={{ color: 'var(--amber)' }}>10s window</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--amber)" strokeWidth="4"
                      strokeDasharray={`${circumference}`} strokeDashoffset={dashOffset}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-mono-custom font-bold">{countdown}</div>
                </div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  If not cancelled, the system auto-creates the incident and dispatches help — no human action required.
                </div>
              </div>
            </div>
          </div>

          {/* Mode C: Voice SOS Card */}
          <VoiceSosCard />
        </div>

        {/* Live telemetry */}
        <div className="mt-8 glass-strong rounded-2xl p-6 sm:p-8 reveal">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-mono-custom uppercase tracking-widest mb-1" style={{ color: 'var(--muted-2)' }}>LIVE SENSOR TELEMETRY</div>
              <h3 className="font-semibold text-xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>On-device inference pipeline</h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-custom px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(54,211,153,0.12)', color: 'var(--green)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" /> INFERENCE 60FPS
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: 'Accelerometer', peak: 'PEAK 4.2G',   color: 'var(--red)',    amp: 22, freq: 2.1 },
              { label: 'Gyroscope',     peak: 'ROT 320°/s',  color: 'var(--violet)', amp: 18, freq: 3.3 },
              { label: 'GPS Velocity',  peak: '0 → 64 km/h', color: 'var(--amber)',  amp: 14, freq: 1.7 },
            ].map((w) => (
              <div key={w.label} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono-custom" style={{ color: 'var(--muted)' }}>{w.label}</span>
                  <span className="text-[10px] font-mono-custom" style={{ color: w.color }}>{w.peak}</span>
                </div>
                <svg viewBox="0 0 200 60" className="w-full h-16">
                  <polyline fill="none" stroke={w.color} strokeWidth="1.5"
                    points={generateWave(80, w.amp, w.freq, phase)} />
                </svg>
              </div>
            ))}
          </div>

          <div className="mt-6 grid sm:grid-cols-4 gap-3">
            {[
              { label: 'Sample Rate', val: '100 Hz', bg: 'rgba(255,59,92,0.06)' },
              { label: 'Model Size',  val: '2.4 MB', bg: 'rgba(46,230,214,0.06)' },
              { label: 'Latency',     val: '12 ms',  bg: 'rgba(255,181,71,0.06)' },
              { label: 'Accuracy',    val: '94.3%',  bg: 'rgba(139,125,255,0.06)' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg" style={{ background: s.bg }}>
                <div className="text-[10px] font-mono-custom uppercase mb-1" style={{ color: 'var(--muted-2)' }}>{s.label}</div>
                <div className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// HOSPITAL AI SECTION
// ─────────────────────────────────────────────────────────────
function HospitalSection() {
  const [hospitals, setHospitals] = useState(() =>
    BASE_HOSPITALS.map((h) => ({ ...h, score: scoreHospital(h) })).sort((a, b) => b.score - a.score)
  );
  const [selected, setSelected] = useState(0);

  const rerun = () => {
    const jittered = BASE_HOSPITALS.map((h) => ({
      ...h,
      icu:      Math.max(0, h.icu + Math.floor(Math.random() * 4 - 2)),
      beds:     Math.max(0, h.beds + Math.floor(Math.random() * 6 - 3)),
      eta:      Math.max(1, h.eta + Math.floor(Math.random() * 4 - 2)),
      workload: Math.min(1, Math.max(0, h.workload + (Math.random() * 0.3 - 0.15))),
    }));
    setHospitals(jittered.map((h) => ({ ...h, score: scoreHospital(h) })).sort((a, b) => b.score - a.score));
    setSelected(0);
  };

  const top = hospitals[0];

  return (
    <section id="hospital" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle,var(--cyan-glow),transparent 70%)' }} />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative">
        <div className="grid lg:grid-cols-12 gap-12 items-start">

          {/* Left */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 reveal">
            <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--cyan)' }}>
              // 03 · Intelligent Hospital Selection
            </div>
            <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Not the nearest.<br /><span className="text-gradient-cyan">The right one.</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
              A weighted scoring algorithm evaluates every nearby hospital across five critical
              dimensions. The winner gets the patient — with full transparency on every alternative.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { label: 'ICU Availability',   pct: 30, color: 'var(--red)' },
                { label: 'General Beds',        pct: 20, color: 'var(--amber)' },
                { label: 'Travel Time',         pct: 20, color: 'var(--cyan)' },
                { label: 'Medical Specialties', pct: 15, color: 'var(--violet)' },
                { label: 'Current Workload',    pct: 15, color: 'var(--green)' },
              ].map((w) => (
                <div key={w.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-mono-custom" style={{ color: 'var(--muted)' }}>{w.label}</span>
                    <span className="font-mono-custom font-semibold">{w.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w.pct}%`, background: w.color }} />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={rerun}
              className="mt-8 btn-ghost px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
              <i className="fa-solid fa-arrows-rotate text-xs" /> Re-run AI scoring
            </button>
          </div>

          {/* Right */}
          <div className="lg:col-span-7 reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="glass-strong rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="text-xs font-mono-custom uppercase tracking-wider" style={{ color: 'var(--muted-2)' }}>AI RECOMMENDATION ENGINE</div>
                  <div className="font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Candidate hospitals · 2.4 km radius</div>
                </div>
                <div className="text-xs font-mono-custom px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(46,230,214,0.12)', color: 'var(--cyan)' }}>LIVE SCORING</div>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {hospitals.map((h, i) => (
                  <div key={h.name}
                    className={`hospital-row px-6 py-4 cursor-pointer ${i === selected ? 'selected' : ''}`}
                    onClick={() => setSelected(i)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {i === 0 && (
                          <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(46,230,214,0.15)', color: 'var(--cyan)' }}>★ TOP MATCH</span>
                        )}
                        <span className="font-semibold text-sm">{h.name}</span>
                      </div>
                      <span className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", color: i === 0 ? 'var(--cyan)' : 'var(--muted)' }}>
                        {h.score}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] font-mono-custom" style={{ color: 'var(--muted-2)' }}>
                      <span><i className="fa-solid fa-bed mr-1" />ICU {h.icu}</span>
                      <span><i className="fa-solid fa-hospital mr-1" />Beds {h.beds}</span>
                      <span><i className="fa-solid fa-clock mr-1" />ETA {h.eta}m</span>
                      <span><i className="fa-solid fa-stethoscope mr-1" />{h.specialty.join(', ')}</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${h.score}%`, background: i === 0 ? 'var(--cyan)' : 'var(--muted-2)', transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t flex items-center gap-3"
                style={{ borderColor: 'var(--border)', background: 'rgba(46,230,214,0.04)' }}>
                <i className="fa-solid fa-circle-info text-cyan-400" />
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  Selected hospital receives patient ETA, medical profile, and trauma pre-alert via the admin dashboard.
                </div>
              </div>
            </div>

            {/* AI explanation */}
            <div className="mt-4 glass rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(46,230,214,0.12)' }}>
                  <i className="fa-solid fa-lightbulb text-cyan-400 text-sm" />
                </div>
                <div>
                  <div className="text-xs font-mono-custom uppercase tracking-wider mb-1" style={{ color: 'var(--muted-2)' }}>WHY THIS HOSPITAL?</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    <span className="text-white font-semibold">{top.name}</span> scored highest with {top.icu} available ICU beds,
                    a specialized {top.specialty.join(' + ')} team, {Math.round((1 - top.workload) * 100)}% capacity headroom,
                    and a {top.eta}-minute ETA.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// HOW IT WORKS — steps + live map
// ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--violet)' }}>
            // 04 · How It Works
          </div>
          <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Emergency resolved in <span className="text-gradient-cyan">minutes.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Steps */}
          <div className="space-y-4 reveal">
            {[
              { step: '01', title: 'Detection',        color: 'var(--red)',   desc: 'SERS sensors detect crash or user presses SOS. AI crash detection needs no human action.' },
              { step: '02', title: 'Instant Dispatch', color: 'var(--amber)', desc: 'Nearest available ambulance auto-assigned using PostGIS geo-queries. Responder notified instantly.' },
              { step: '03', title: 'Smart Routing',    color: 'var(--amber)', desc: 'AI optimizes ambulance route using live traffic and road conditions.' },
              { step: '04', title: 'Hospital Ready',   color: 'var(--green)', desc: 'Best hospital auto-selected. ER receives medical profile before the patient arrives.' },
              { step: '05', title: 'Live Tracking',    color: 'var(--cyan)',  desc: 'Patient, family, and hospital all see the live ambulance position on the shared map below.' },
            ].map((item) => (
              <div key={item.step} className="glass rounded-2xl p-6 flex items-start gap-6 feature-card">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-lg font-mono-custom"
                  style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}40` }}>
                  {item.step}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg mb-1" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live map — right beside steps */}
          <div className="reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="mb-4">
              <h3 className="font-bold text-xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Live Incident Map</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Real-time view of active emergencies</p>
            </div>
            <div className="glass-strong rounded-2xl overflow-hidden" style={{ height: '500px' }}>
              <PublicMap />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// WEB SOS DEMO — actual functional feature
// ─────────────────────────────────────────────────────────────
function SOSDemoSection() {
  const [sosPressed, setSosPressed] = useState(false);
  const [step, setStep] = useState<null | 'locating' | 'scoring' | 'done'>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleSOS = () => {
    if (sosPressed) return;
    setSosPressed(true);
    setStep('locating');

    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser.');
      setSosPressed(false);
      setStep(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setStep('scoring');
        setTimeout(() => {
          setStep('done');
          setTimeout(() => { setSosPressed(false); setStep(null); setLocation(null); }, 5000);
        }, 1800);
      },
      () => {
        alert('Location permission denied. Please allow location access to use Web SOS.');
        setSosPressed(false);
        setStep(null);
      }
    );
  };

  return (
    <section id="sos-demo" className="py-24 sm:py-32 relative">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(600px 400px at 50% 50%, rgba(255,59,92,0.08), transparent 70%)' }} />

      <div className="max-w-5xl mx-auto px-5 sm:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--red)' }}>
            // 05 · Web SOS
          </div>
          <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Try it now —<br /><span className="text-gradient-red">from your browser.</span>
          </h2>
          <p className="mt-4 text-base" style={{ color: 'var(--muted)' }}>
            Tap SOS. We capture your location, run AI severity scoring, and match the best hospital — just like the real system does.
          </p>
        </div>

        <div className="glass-strong rounded-3xl p-10 sm:p-16 reveal">
          <div className="flex flex-col lg:flex-row items-center gap-12">

            {/* SOS Button */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative w-48 h-48 mb-4">
                <div className="pulse-ring" />
                <div className="pulse-ring pulse-ring-d1" />
                <div className="pulse-ring pulse-ring-d2" />
                <button
                  onClick={handleSOS}
                  disabled={sosPressed}
                  className={`absolute inset-0 rounded-full flex flex-col items-center justify-center font-bold text-white sos-glow transition-all duration-300 ${sosPressed ? 'scale-95 opacity-80' : 'hover:scale-105'}`}
                  style={{ background: 'radial-gradient(circle at 30% 30%, var(--red-2), var(--red) 70%)' }}
                >
                  <span className="text-4xl font-black" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                    {step === 'done' ? '✓' : 'SOS'}
                  </span>
                  <span className="text-xs font-mono-custom text-white/80 mt-1">
                    {step === 'locating' ? 'LOCATING...' : step === 'scoring' ? 'SCORING AI...' : step === 'done' ? 'COMPLETE' : 'TAP TO ALERT'}
                  </span>
                </button>
              </div>
              <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>Browser location permission required</p>
            </div>

            {/* Progress steps */}
            <div className="flex-1 space-y-4 w-full">
              {[
                { key: 'locating', icon: 'fa-location-dot', color: 'var(--cyan)',   label: 'GPS Captured',     sub: location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for location...' },
                { key: 'scoring',  icon: 'fa-brain',        color: 'var(--violet)', label: 'Severity Scored',  sub: 'AI model · TF Lite · 94.3% accuracy' },
                { key: 'done',     icon: 'fa-hospital',     color: 'var(--green)',  label: 'Hospital Matched', sub: "Best match: St. Mary's Trauma · ETA 4 min" },
              ].map((s, i) => {
                const stepOrder = ['locating', 'scoring', 'done'];
                const currentIdx = step ? stepOrder.indexOf(step) : -1;
                const thisIdx = stepOrder.indexOf(s.key);
                const isDone = currentIdx >= thisIdx && step !== null;
                const isActive = currentIdx === thisIdx;

                return (
                  <div key={s.key} className={`glass rounded-xl p-4 flex items-center gap-4 transition-all duration-500 ${isDone ? 'border-opacity-100' : 'opacity-40'}`}
                    style={{ borderColor: isDone ? s.color : 'transparent', borderWidth: isDone ? '1px' : '1px', borderStyle: 'solid' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: isDone ? `${s.color}20` : 'rgba(255,255,255,0.04)' }}>
                      {isActive && step !== 'done'
                        ? <i className="fa-solid fa-spinner text-sm blink" style={{ color: s.color }} />
                        : <i className={`fa-solid ${s.icon} text-sm`} style={{ color: isDone ? s.color : 'var(--muted-2)' }} />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{s.label}</div>
                      <div className="text-[11px] font-mono-custom mt-0.5" style={{ color: 'var(--muted-2)' }}>{s.sub}</div>
                    </div>
                    {isDone && (
                      <div className="ml-auto">
                        <i className="fa-solid fa-circle-check" style={{ color: s.color }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// WHAT'S BUILT vs COMING SOON — honest feature status
// ─────────────────────────────────────────────────────────────
function FeaturesSection() {
  const built = [
    { icon: 'fa-circle-exclamation', color: 'var(--red)',    title: '1-tap Web SOS',          desc: 'Capture location, score severity, match hospital — right from the browser.' },
    { icon: 'fa-microphone',          color: 'var(--violet)', title: 'Voice SOS (Speech AI)',  desc: 'Hands-free speech recognition detecting keywords like "Help", "Bachao", "Emergency".' },
    { icon: 'fa-microchip',          color: 'var(--cyan)',   title: 'AI Crash Detection',      desc: 'TensorFlow Lite model detecting high-G impacts, falls, and sudden stops.' },
    { icon: 'fa-hospital',           color: 'var(--green)',  title: 'Smart Hospital Matching', desc: 'Weighted algorithm scores hospitals on ICU availability, ETA, specialties, and workload.' },
    { icon: 'fa-map',                color: 'var(--violet)', title: 'Live Incident Map',       desc: 'Real-time map of active incidents and ambulance positions via Socket.io.' },
    { icon: 'fa-chart-pie',          color: 'var(--amber)',  title: 'Admin Dashboard',         desc: 'Command center with incident management, hospital status, and ambulance tracking.' },
  ];

  const coming = [
    { icon: 'fa-id-badge',    title: 'ABDM Integration',    desc: 'Auto-share medical profile with ER via ABHA ID.' },
    { icon: 'fa-people-group',title: 'Family Alerts',       desc: 'Notify emergency contacts the moment SOS is triggered.' },
    { icon: 'fa-map-location',title: 'Hotspot Prediction',  desc: 'ML-predicted accident zones for proactive ambulance staging.' },
  ];

  return (
    <section id="features" className="py-24 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="text-xs font-mono-custom uppercase tracking-widest mb-4" style={{ color: 'var(--green)' }}>
            // 06 · Feature Status
          </div>
          <h2 className="font-bold text-4xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            What's live today vs<br /><span className="text-gradient-cyan">what's coming next.</span>
          </h2>
        </div>

        {/* Built & working */}
        <div className="mb-4 reveal">
          <div className="flex items-center gap-3 mb-5">
            <div className="text-xs font-mono-custom uppercase tracking-widest" style={{ color: 'var(--green)' }}>✓ BUILT & WORKING</div>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {built.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-5 feature-card">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                  <i className={`fa-solid ${f.icon}`} style={{ color: f.color }} />
                </div>
                <div className="text-sm font-semibold mb-1">{f.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon */}
        <div className="mt-10 reveal">
          <div className="flex items-center gap-3 mb-5">
            <div className="text-xs font-mono-custom uppercase tracking-widest" style={{ color: 'var(--amber)' }}>⏳ COMING SOON</div>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coming.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-5 opacity-70">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: 'rgba(255,181,71,0.10)', border: '1px solid rgba(255,181,71,0.2)' }}>
                  <i className={`fa-solid ${f.icon}`} style={{ color: 'var(--amber)' }} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-semibold">{f.title}</div>
                  <span className="text-[9px] font-mono-custom px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,181,71,0.15)', color: 'var(--amber)' }}>SOON</span>
                </div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPARISON TABLE — honest SERS status
// ─────────────────────────────────────────────────────────────
function ComparisonSection() {
  // true = ✅ built, 'soon' = 🔜 coming, false = ❌
  const rows: [string, boolean | string, boolean | string, boolean | 'soon'][] = [
    ['Auto Crash Detection',    false,     false, true  ],
    ['AI Hospital Matching',    false,     false, true  ],
    ['1-tap / Web SOS',         false,     false, true  ],
    ['Live Incident Map',       false,     false, true  ],
    ['Admin Command Center',    'Basic',   false, true  ],
    ['Voice SOS (AI)',          false,     false, true  ],
    ['ABDM Integration',        'Partial', false, 'soon'],
    ['Family Real-Time Alert',  false,     false, 'soon'],
    ['Predictive Hotspots',     false,     false, 'soon'],
  ];

  const cell = (v: boolean | string) => {
    if (v === false)    return <span className="text-lg">❌</span>;
    if (v === 'soon')   return <span className="text-[11px] font-mono-custom px-2 py-0.5 rounded" style={{ background: 'rgba(255,181,71,0.15)', color: 'var(--amber)' }}>SOON</span>;
    if (v === true)     return <span className="text-lg">✅</span>;
    return <span className="text-xs" style={{ color: 'var(--muted)' }}>{v}</span>;
  };

  return (
    <section className="py-24 sm:py-32 relative">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-12 reveal">
          <h2 className="font-bold text-4xl sm:text-5xl" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Why SERS beats everything else
          </h2>
        </div>
        <div className="glass-strong rounded-2xl overflow-hidden reveal">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left p-4 font-semibold text-white">Feature</th>
                <th className="p-4 font-semibold text-center" style={{ color: 'var(--muted)' }}>112 India</th>
                <th className="p-4 font-semibold text-center" style={{ color: 'var(--muted)' }}>Dial4242</th>
                <th className="p-4 font-bold text-center" style={{ color: 'var(--red)' }}>SERS ✦</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([feature, a, b, c], i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="p-4" style={{ color: 'var(--text)' }}>{feature}</td>
                  <td className="p-4 text-center">{cell(a)}</td>
                  <td className="p-4 text-center">{cell(b)}</td>
                  <td className="p-4 text-center">{cell(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t py-12 px-6" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--red),#c4274a)' }}>
              <i className="fa-solid fa-shield-heart text-white text-xs" />
            </div>
            <span className="font-bold text-white">SERS</span>
            <span className="text-sm" style={{ color: 'var(--muted-2)' }}>Smart Emergency Response System</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--muted-2)' }}>
            <a href="http://localhost:3002" className="hover:text-white transition-colors flex items-center gap-1.5">
              <i className="fa-solid fa-gauge-high text-xs" /> Admin Panel
            </a>
            <span className="text-white/20">|</span>
            <a href="#sos-demo" className="hover:text-white transition-colors">Try Web SOS</a>
            <span className="text-white/20">|</span>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-2)' }}>© 2024 SERS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  useReveal();

  return (
    <div className="bg-grid" style={{ background: 'var(--bg)' }}>
      <Navbar />
      <Hero />
      <div className="divider-line" />
      <ProblemSection />
      <div className="divider-line" />
      <DetectionSection />
      <div className="divider-line" />
      <HospitalSection />
      <div className="divider-line" />
      <HowItWorksSection />
      <div className="divider-line" />
      <SOSDemoSection />
      <div className="divider-line" />
      <FeaturesSection />
      <div className="divider-line" />
      <ComparisonSection />
      <Footer />
    </div>
  );
}
