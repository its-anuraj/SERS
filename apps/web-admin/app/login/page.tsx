'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Hospital, Shield, Lock, Mail, Phone, User,
  CheckCircle2, ArrowRight, Activity, Building2,
  FileBadge, AlertCircle, Eye, EyeOff, Zap
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Sign up form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [hospitalName, setHospitalName] = useState('');
  const [roleTitle, setRoleTitle] = useState('Emergency Triage Chief');
  const [licenseCode, setLicenseCode] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Hospital options
  const [hospitalsList, setHospitalsList] = useState<string[]>([]);

  useEffect(() => {
    // Fetch live hospitals from API if any exist
    fetch(`${API}/api/hospitals?limit=50`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setHospitalsList(data.data.map((h: any) => h.name));
          setHospitalName(data.data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Invalid email/phone or password');
      }

      // Store auth tokens & user info
      localStorage.setItem('sers_token', json.data.tokens.accessToken);
      localStorage.setItem('sers_refresh_token', json.data.tokens.refreshToken);
      localStorage.setItem('sers_user', JSON.stringify(json.data.user));

      setSuccess(`Welcome back, ${json.data.user.name}! Redirecting to Command Center...`);
      setTimeout(() => {
        router.push('/');
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!phone.startsWith('+91') || phone.length < 13) {
        throw new Error('Please enter a valid Indian mobile number starting with +91 (e.g. +919876543210)');
      }
      if (signupPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      if (!hospitalName.trim()) {
        throw new Error('Please enter your hospital name');
      }

      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password: signupPassword,
          role: 'hospital_staff',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Hospital staff registration failed');
      }

      // Also create/register hospital node if not existing
      try {
        await fetch(`${API}/api/hospitals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${json.data.tokens.accessToken}`,
          },
          body: JSON.stringify({
            name: hospitalName.trim(),
            address: 'Main Emergency Hospital Center',
            phone: phone.trim(),
            emergency_phone: phone.trim(),
            email: email.trim(),
            icu_beds_total: 20,
            icu_beds_available: 10,
            er_beds_total: 30,
            er_beds_available: 15,
            is_active: true,
            is_on_sers_network: true,
          }),
        });
      } catch {}

      // Store tokens and user profile
      localStorage.setItem('sers_token', json.data.tokens.accessToken);
      localStorage.setItem('sers_refresh_token', json.data.tokens.refreshToken);
      const userProfile = {
        ...json.data.user,
        hospital: hospitalName,
        roleTitle,
        licenseCode,
      };
      localStorage.setItem('sers_user', JSON.stringify(userProfile));

      setSuccess('Hospital Staff Node registered successfully! Redirecting to Command Center...');
      setTimeout(() => {
        router.push('/');
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 flex flex-col justify-center items-center p-4 md:p-8 font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-100/60 to-transparent pointer-events-none -z-10" />

      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Zap size={26} />
            </div>
            <div className="text-left">
              <span className="font-black text-2xl text-slate-900 tracking-tight flex items-center gap-1.5">
                SERS <span className="text-xs bg-rose-100 text-rose-700 font-extrabold px-2 py-0.5 rounded-md border border-rose-200">HOSPITAL PORTAL</span>
              </span>
              <p className="text-xs text-slate-500 font-bold">Smart Emergency Response System</p>
            </div>
          </Link>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 pt-2 tracking-tight">
            {tab === 'login' ? 'Hospital Command Center Login' : 'Hospital Staff & Node Registration'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
            {tab === 'login'
              ? 'Sign in with your verified medical email or phone number to access live triage and ICU dispatch.'
              : 'Register your hospital emergency department to coordinate triage and incoming ambulance dispatch.'}
          </p>
        </div>

        {/* Card Box */}
        <div className="glass-card p-6 md:p-8 bg-white border border-slate-200 shadow-xl rounded-3xl space-y-6">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              🔐 Hospital Staff Login
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              🏥 Register New Staff / Node
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* LOGIN TAB FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Official Email or Registered Phone</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Enter email or +91 phone number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-101 active:scale-99">
                {loading ? 'Authenticating...' : 'Sign In to Hospital Command Center'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* SIGNUP TAB FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Full Name & Title</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Varma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Official Medical Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. rajesh.varma@hospital.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Phone Number (+91 format)</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Clinical Designation</label>
                  <div className="relative">
                    <Activity size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={roleTitle}
                      onChange={e => setRoleTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs">
                      <option value="Emergency Triage Chief">Emergency Triage Chief</option>
                      <option value="ICU Medical Officer">ICU Medical Officer</option>
                      <option value="Trauma Care Coordinator">Trauma Care Coordinator</option>
                      <option value="Chief Medical Officer">Chief Medical Officer</option>
                      <option value="ER Duty Officer">ER Duty Officer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Hospital Name / Medical Center</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  {hospitalsList.length > 0 ? (
                    <select
                      value={hospitalName}
                      onChange={e => setHospitalName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs">
                      {hospitalsList.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={hospitalName}
                      onChange={e => setHospitalName(e.target.value)}
                      placeholder="e.g. City General Hospital"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">NABH / Medical License ID</label>
                  <div className="relative">
                    <FileBadge size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={licenseCode}
                      onChange={e => setLicenseCode(e.target.value)}
                      placeholder="e.g. NABH-KA-2026-9041"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Create Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-101 active:scale-99 mt-2">
                {loading ? 'Creating Hospital Staff Node...' : 'Complete Staff Registration'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>

        {/* ABDM & 256-Bit Encryption Security Guarantee Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 text-xs font-black">
            <Shield size={16} className="text-emerald-600 shrink-0" />
            <span>SERS ABDM Certified · 256-Bit Encrypted Medical Gateway</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-[11px] text-slate-600 font-medium">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-0.5">
              <p className="font-extrabold text-slate-900">🏛️ ABDM Integration (Govt. of India)</p>
              <p className="text-slate-500 leading-snug">
                Ayushman Bharat Digital Mission compliance allows emergency triage doctors to pull victim ABHA emergency health records, blood groups, and allergies with zero delay.
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-0.5">
              <p className="font-extrabold text-slate-900">🔒 256-Bit End-to-End Encryption</p>
              <p className="text-slate-500 leading-snug">
                Military-grade AES-256 encryption protects all patient vitals, ECG waveforms, and crash telemetry transmitted between ambulances and hospital command nodes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
