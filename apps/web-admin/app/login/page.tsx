'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Hospital, Shield, Lock, Mail, Phone, User,
  CheckCircle2, ArrowRight, Activity, Building2,
  FileBadge, AlertCircle, Eye, EyeOff, Zap, Stethoscope,
  Clock, HeartPulse, UserCheck
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const DEPARTMENTS = [
  'Emergency & Trauma',
  'Cardiology & Cardiac Care',
  'Neurology & Neuro-Trauma',
  'Orthopedics & Spine Trauma',
  'Critical Care & ICU',
  'General & Trauma Surgery',
  'Anesthesiology & OT',
  'Pediatric Emergency',
  'Radiology & Imaging',
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [roleType, setRoleType] = useState<'hospital_admin' | 'doctor'>('hospital_admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Sign up form state — Hospital Desk / Admin
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('+91');
  const [adminEmail, setAdminEmail] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCity, setHospitalCity] = useState('Bengaluru');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [icuBedsTotal, setIcuBedsTotal] = useState(15);
  const [icuBedsAvailable, setIcuBedsAvailable] = useState(8);
  const [erBedsTotal, setErBedsTotal] = useState(25);
  const [erBedsAvailable, setErBedsAvailable] = useState(12);

  // Sign up form state — Doctor / Medical Personnel
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('+91');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDept, setSelectedDept] = useState('Emergency & Trauma');
  const [staffTitle, setStaffTitle] = useState('Trauma & Emergency Specialist');
  const [medicalLicense, setMedicalLicense] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Live hospitals list from DB for doctors to link to
  const [hospitalsList, setHospitalsList] = useState<{ id: string; name: string; city: string }[]>([]);

  useEffect(() => {
    fetch(`${API}/api/hospitals?limit=100`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setHospitalsList(data.data);
          setSelectedHospital(data.data[0].id);
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

      const isDoc = json.data.user.staffTitle || json.data.user.department || roleType === 'doctor';
      setSuccess(`Welcome back, ${json.data.user.name}! Accessing ${json.data.user.hospitalName || 'Hospital'} ${isDoc ? 'Doctor Roster' : 'Command Center'}...`);
      
      setTimeout(() => {
        if (isDoc && !json.data.user.role?.includes('admin')) {
          router.push('/attendance');
        } else {
          router.push('/');
        }
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupHospitalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!adminPhone.startsWith('+91') || adminPhone.length < 13) {
        throw new Error('Please enter a valid Indian mobile number starting with +91 (e.g. +919876543210)');
      }
      if (signupPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (!hospitalName.trim()) {
        throw new Error('Please enter your hospital name');
      }

      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminName.trim(),
          phone: adminPhone.trim(),
          email: adminEmail.trim() || undefined,
          password: signupPassword,
          role: 'hospital_staff',
          staffTitle: 'Emergency Command Chief',
          hospitalName: hospitalName.trim(),
          hospitalCity: hospitalCity.trim(),
          hospitalAddress: hospitalAddress.trim() || `${hospitalName.trim()}, ${hospitalCity.trim()}`,
          icuBedsTotal: parseInt(String(icuBedsTotal)) || 15,
          icuBedsAvailable: parseInt(String(icuBedsAvailable)) || 8,
          erBedsTotal: parseInt(String(erBedsTotal)) || 25,
          erBedsAvailable: parseInt(String(erBedsAvailable)) || 12,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Hospital registration failed');
      }

      localStorage.setItem('sers_token', json.data.tokens.accessToken);
      localStorage.setItem('sers_refresh_token', json.data.tokens.refreshToken);
      localStorage.setItem('sers_user', JSON.stringify(json.data.user));

      setSuccess(`Hospital Node for "${hospitalName}" registered successfully! Redirecting...`);
      setTimeout(() => router.push('/'), 800);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!doctorPhone.startsWith('+91') || doctorPhone.length < 13) {
        throw new Error('Please enter a valid mobile number starting with +91 (e.g. +919876543210)');
      }
      if (signupPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // If user selected a hospital from list or entered hospital name
      const matchedHosp = hospitalsList.find(h => h.id === selectedHospital);

      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: doctorName.trim(),
          phone: doctorPhone.trim(),
          email: doctorEmail.trim() || undefined,
          password: signupPassword,
          role: 'hospital_staff',
          hospitalId: selectedHospital || undefined,
          hospitalName: matchedHosp ? matchedHosp.name : (hospitalName.trim() || 'General Emergency Hospital'),
          staffTitle: staffTitle.trim() || 'Attending Physician',
          department: selectedDept,
          specialization: `${staffTitle.trim()} · Reg #${medicalLicense || 'VERIFIED'}`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Medical staff registration failed');
      }

      localStorage.setItem('sers_token', json.data.tokens.accessToken);
      localStorage.setItem('sers_refresh_token', json.data.tokens.refreshToken);
      localStorage.setItem('sers_user', JSON.stringify(json.data.user));

      setSuccess(`Dr. ${doctorName} registered & marked On-Duty! Redirecting to Duty Attendance Portal...`);
      setTimeout(() => router.push('/attendance'), 800);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 flex flex-col justify-center items-center p-4 md:p-8 font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-100/60 to-transparent pointer-events-none -z-10" />

      <div className="w-full max-w-2xl space-y-6">
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
            {tab === 'login' ? 'Hospital Emergency Portal Login' : 'Hospital & Medical Staff Registration'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold max-w-lg mx-auto">
            {tab === 'login'
              ? 'Multi-tenant emergency portal: Sign in to your hospital command desk or doctor attendance roster.'
              : 'Register your hospital emergency department or join as on-duty medical personnel.'}
          </p>
        </div>

        {/* Card Box */}
        <div className="glass-card p-6 md:p-8 bg-white border border-slate-200 shadow-xl rounded-3xl space-y-6">
          {/* Main Tab Switcher (Login vs Register) */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              🔐 Sign In to Portal
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              🏥 Register Hospital / Doctor
            </button>
          </div>

          {/* Role Type Selector for Signup */}
          {tab === 'signup' && (
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setRoleType('hospital_admin')}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 border ${
                  roleType === 'hospital_admin'
                    ? 'bg-white text-rose-700 border-rose-300 shadow-sm'
                    : 'border-transparent text-slate-600 hover:bg-slate-100'
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${roleType === 'hospital_admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-xs font-black">Hospital Command Desk</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Triage & Bed Manager</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRoleType('doctor')}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 border ${
                  roleType === 'doctor'
                    ? 'bg-white text-indigo-700 border-indigo-300 shadow-sm'
                    : 'border-transparent text-slate-600 hover:bg-slate-100'
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${roleType === 'doctor' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                  <Stethoscope size={16} />
                </div>
                <div>
                  <p className="text-xs font-black">Doctor / Medical Staff</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Duty Attendance & OT</p>
                </div>
              </button>
            </div>
          )}

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

          {/* ─────────────────────────────────────────────────── */}
          {/* TAB 1: LOGIN FORM                                  */}
          {/* ─────────────────────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Registered Email or Mobile Number</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="e.g. drmeera@demo.sers.in or +919876500005"
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
                {loading ? 'Authenticating...' : 'Sign In to Hospital Portal'}
                <ArrowRight size={16} />
              </button>

              {/* Demo Credentials Helper */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    🔑 Test Logins (Password: Test@1234)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('drmeera@demo.sers.in');
                      setPassword('Test@1234');
                      setRoleType('hospital_admin');
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-rose-400 bg-slate-50 hover:bg-rose-50/50 text-left transition-all cursor-pointer group shadow-xs">
                    <p className="text-xs font-black text-slate-900 group-hover:text-rose-700">🏥 Dr. Meera (Hospital Desk)</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">drmeera@demo.sers.in</p>
                    <span className="inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                      Command Center Access
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('admin@sers.in');
                      setPassword('Test@1234');
                      setRoleType('hospital_admin');
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 text-left transition-all cursor-pointer group shadow-xs">
                    <p className="text-xs font-black text-slate-900 group-hover:text-purple-700">⚡ SERS Command Chief</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">admin@sers.in</p>
                    <span className="inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      Full Dispatch Access
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ─────────────────────────────────────────────────── */}
          {/* TAB 2A: REGISTER HOSPITAL COMMAND DESK             */}
          {/* ─────────────────────────────────────────────────── */}
          {tab === 'signup' && roleType === 'hospital_admin' && (
            <form onSubmit={handleSignupHospitalAdmin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Hospital / Center Name</label>
                  <input
                    type="text"
                    required
                    value={hospitalName}
                    onChange={e => setHospitalName(e.target.value)}
                    placeholder="e.g. City Life Trauma Center"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">City / Region</label>
                  <input
                    type="text"
                    required
                    value={hospitalCity}
                    onChange={e => setHospitalCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Full Address</label>
                <input
                  type="text"
                  required
                  value={hospitalAddress}
                  onChange={e => setHospitalAddress(e.target.value)}
                  placeholder="e.g. 14, Main Ring Road, Koramangala, Bengaluru"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                />
              </div>

              {/* Initial Bed Capacity */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Total ICU Beds</label>
                  <input
                    type="number"
                    min="0"
                    value={icuBedsTotal}
                    onChange={e => setIcuBedsTotal(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Avail. ICU Beds</label>
                  <input
                    type="number"
                    min="0"
                    value={icuBedsAvailable}
                    onChange={e => setIcuBedsAvailable(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Total ER Beds</label>
                  <input
                    type="number"
                    min="0"
                    value={erBedsTotal}
                    onChange={e => setErBedsTotal(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Avail. ER Beds</label>
                  <input
                    type="number"
                    min="0"
                    value={erBedsAvailable}
                    onChange={e => setErBedsAvailable(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-blue-700"
                  />
                </div>
              </div>

              {/* Admin Staff Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Desk Officer / Admin Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Verma"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Emergency Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={adminPhone}
                    onChange={e => setAdminPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Hospital Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="emergency@hospital.org"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Set Password</label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all">
                {loading ? 'Creating Hospital Emergency Node...' : 'Register Hospital Emergency Node'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ─────────────────────────────────────────────────── */}
          {/* TAB 2B: REGISTER DOCTOR / MEDICAL PERSONNEL        */}
          {/* ─────────────────────────────────────────────────── */}
          {tab === 'signup' && roleType === 'doctor' && (
            <form onSubmit={handleSignupDoctor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Doctor / Staff Full Name</label>
                  <input
                    type="text"
                    required
                    value={doctorName}
                    onChange={e => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Priya Sen"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Mobile Number (For Emergency Duty SMS)</label>
                  <input
                    type="text"
                    required
                    value={doctorPhone}
                    onChange={e => setDoctorPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  />
                </div>
              </div>

              {/* Hospital Affiliation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Hospital Working At</label>
                {hospitalsList.length > 0 ? (
                  <select
                    value={selectedHospital}
                    onChange={e => setSelectedHospital(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600">
                    {hospitalsList.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.city})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={hospitalName}
                    onChange={e => setHospitalName(e.target.value)}
                    placeholder="Enter hospital name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                )}
              </div>

              {/* Department & Specialty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Department / Specialty</label>
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600">
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Designation / Role Title</label>
                  <input
                    type="text"
                    required
                    value={staffTitle}
                    onChange={e => setStaffTitle(e.target.value)}
                    placeholder="e.g. Senior Trauma Surgeon / ER Nurse"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={doctorEmail}
                    onChange={e => setDoctorEmail(e.target.value)}
                    placeholder="doctor@hospital.org"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Password</label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all">
                {loading ? 'Registering Medical Personnel...' : 'Register as On-Duty Doctor / Nurse'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
