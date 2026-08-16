'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UserCheck, Stethoscope, Ambulance, Clock, Plus, Search,
  Filter, CheckCircle2, AlertCircle, Phone, Building2,
  Calendar, Shield, RefreshCw, X, ArrowLeft, Activity,
  ChevronRight, Sparkles, Trash2, Edit3, HeartPulse, Brain,
  Bone, Baby, Syringe, Eye, LogOut, Bed
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AttendanceRecord {
  id: string;
  user_id?: string;
  hospital_id?: string;
  hospital_name?: string;
  staff_type: 'doctor' | 'driver' | 'paramedic' | 'nurse';
  name: string;
  phone?: string;
  department?: string;
  specialization?: string;
  assigned_vehicle_reg?: string;
  shift: string;
  status: 'on_duty' | 'in_ot' | 'on_call' | 'off_duty';
  duty_date: string;
  check_in_time: string;
  check_out_time?: string;
  notes?: string;
}

const DEPARTMENTS = [
  'All Departments',
  'Emergency & Trauma',
  'Cardiology & Cardiac Care',
  'Neurology & Neuro-Trauma',
  'Orthopedics & Spine Trauma',
  'Critical Care / ICU',
  'General & Trauma Surgery',
  'Anesthesiology & OT',
  'Pediatrics & Neonatology',
  'Radiology & CT Scan',
];

const SHIFTS = [
  'Morning (08:00 - 16:00)',
  'Evening (16:00 - 00:00)',
  'Night Emergency (00:00 - 08:00)',
];

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  on_duty: { label: '🟢 On-Duty / Ready', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  in_ot: { label: '🟡 In OT / Surgery', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  on_call: { label: '🔵 On-Call Emergency', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  off_duty: { label: '⚪ Off-Duty', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'doctors' | 'drivers'>('doctors');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Doctor Personal Live Status
  const [myStatus, setMyStatus] = useState<string>('on_duty');
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);

  // Form State for Manual Entry
  const [formType, setFormType] = useState<'doctor' | 'driver'>('doctor');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('+91');
  const [formDept, setFormDept] = useState('Emergency & Trauma');
  const [formSpecialization, setFormSpecialization] = useState('');
  const [formVehicleReg, setFormVehicleReg] = useState('');
  const [formShift, setFormShift] = useState('Morning (08:00 - 16:00)');
  const [formStatus, setFormStatus] = useState<'on_duty' | 'in_ot' | 'on_call' | 'off_duty'>('on_duty');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('sers_user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const uStr = typeof window !== 'undefined' ? localStorage.getItem('sers_user') : null;
      const u = uStr ? JSON.parse(uStr) : null;
      const hospParam = u?.hospitalId ? `?hospital_id=${u.hospitalId}` : '';

      const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
      const res = await fetch(`${API}/api/attendance${hospParam}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch attendance:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Load current doctor's personal status
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
    if (token) {
      fetch(`${API}/api/attendance/my-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.status) {
            setMyStatus(data.data.status);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleToggleMyStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    setMsg(null);
    try {
      const token = localStorage.getItem('sers_token');
      const res = await fetch(`${API}/api/attendance/toggle-my-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setMyStatus(newStatus);
        setMsg({ type: 'success', text: json.message || 'Status updated successfully!' });
        await fetchAttendance();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error updating status' });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const token = localStorage.getItem('sers_token');
      const res = await fetch(`${API}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          hospital_id: currentUser?.hospitalId || undefined,
          staff_type: formType,
          name: formName.trim(),
          phone: formPhone.trim(),
          department: formType === 'doctor' ? formDept : 'Emergency Fleet',
          specialization: formType === 'doctor' ? formSpecialization : 'Emergency Driver / EMT',
          assigned_vehicle_reg: formType === 'driver' ? formVehicleReg.trim() : null,
          shift: formShift,
          status: formStatus,
          notes: formNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to mark attendance');
      }

      setMsg({ type: 'success', text: `Duty attendance for ${formName} recorded successfully!` });
      setShowModal(false);
      // Reset form
      setFormName('');
      setFormPhone('+91');
      setFormSpecialization('');
      setFormVehicleReg('');
      setFormNotes('');
      await fetchAttendance();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error recording attendance' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('sers_token');
      await fetch(`${API}/api/attendance/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchAttendance();
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this duty record?')) return;
    try {
      const token = localStorage.getItem('sers_token');
      await fetch(`${API}/api/attendance/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      await fetchAttendance();
    } catch (e) {
      console.error('Error deleting record:', e);
    }
  };

  // Filtered lists
  const doctorsList = records.filter(r => r.staff_type === 'doctor' || r.staff_type === 'nurse');
  const driversList = records.filter(r => r.staff_type === 'driver' || r.staff_type === 'paramedic');

  const activeTabList = tab === 'doctors' ? doctorsList : driversList;
  const filtered = activeTabList.filter(r => {
    const matchesSearch =
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase()) ||
      r.specialization?.toLowerCase().includes(search.toLowerCase()) ||
      r.assigned_vehicle_reg?.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      selectedDept === 'All Departments' ||
      r.department?.toLowerCase().includes(selectedDept.toLowerCase());

    const matchesStatus =
      selectedStatus === 'all' || r.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const onDutyCount = activeTabList.filter(r => r.status === 'on_duty').length;
  const inOtCount = activeTabList.filter(r => r.status === 'in_ot').length;
  const onCallCount = activeTabList.filter(r => r.status === 'on_call').length;

  const isDoctorUser = currentUser?.staffTitle || currentUser?.department || currentUser?.role === 'doctor';

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors cursor-pointer">
              <ArrowLeft size={18} />
            </Link>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
              <UserCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {currentUser?.hospitalName || currentUser?.hospital || 'Hospital Emergency Medical Roster'}
              </h1>
              <p className="text-xs text-slate-500 font-semibold">
                Live attendance & OT readiness for emergency trauma intake
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchAttendance}
              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Check-in Personnel
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {msg && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2.5 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {msg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
              <span>{msg.text}</span>
            </div>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
          </div>
        )}

        {/* Doctor Personal Live Shift Status Card */}
        {isDoctorUser && (
          <div className="glass-card p-5 bg-gradient-to-r from-indigo-50 via-white to-blue-50 border border-indigo-200/90 rounded-3xl space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 shrink-0">
                  <Stethoscope size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-slate-900">Dr. {currentUser?.name}</h2>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {currentUser?.department || 'Emergency & Trauma'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {currentUser?.staffTitle || 'Attending Specialist'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Toggle your real-time shift status below to notify the trauma desk of your readiness for incoming emergencies.
                  </p>
                </div>
              </div>

              {/* Status Selector Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleToggleMyStatus('on_duty')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                    myStatus === 'on_duty'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20 scale-102'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  🟢 On-Duty / Ready
                </button>

                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleToggleMyStatus('in_ot')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                    myStatus === 'in_ot'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-md shadow-amber-600/20 scale-102'
                      : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  }`}>
                  🟡 In OT / Surgery
                </button>

                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleToggleMyStatus('on_call')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                    myStatus === 'on_call'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-600/20 scale-102'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}>
                  🔵 On-Call
                </button>

                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleToggleMyStatus('off_duty')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                    myStatus === 'off_duty'
                      ? 'bg-slate-700 text-white border-slate-800 shadow-md shadow-slate-700/20 scale-102'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  ⚪ Off-Duty
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800">On-Duty / Ready</p>
            <p className="text-2xl font-black text-emerald-950 mt-1">{onDutyCount}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Available for Emergency Trauma</p>
          </div>

          <div className="glass-card p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">In OT / Surgery</p>
            <p className="text-2xl font-black text-amber-950 mt-1">{inOtCount}</p>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Currently Operating</p>
          </div>

          <div className="glass-card p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-800">On-Call Specialists</p>
            <p className="text-2xl font-black text-blue-950 mt-1">{onCallCount}</p>
            <p className="text-[10px] text-blue-700 font-semibold mt-0.5">Ready for Mobilization</p>
          </div>

          <div className="glass-card p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">Total Shift Personnel</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeTabList.length}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Logged on Today's Roster</p>
          </div>
        </div>

        {/* Tab & Search Controls */}
        <div className="glass-card p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Tab switch */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTab('doctors')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  tab === 'doctors'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}>
                <Stethoscope size={15} />
                Doctors & Specialists ({doctorsList.length})
              </button>

              <button
                type="button"
                onClick={() => setTab('drivers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  tab === 'drivers'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}>
                <Ambulance size={15} />
                Ambulance Drivers & EMTs ({driversList.length})
              </button>
            </div>

            {/* Department Filter (Only for doctors) */}
            {tab === 'doctors' && (
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600">
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600">
              <option value="all">All Duty Statuses</option>
              <option value="on_duty">On-Duty / Available</option>
              <option value="in_ot">In OT / Surgery</option>
              <option value="on_call">On-Call</option>
              <option value="off_duty">Off-Duty</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, specialty..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Attendance Roster Table */}
        <div className="glass-card bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-bold">
              <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600 mb-2" />
              Loading duty roster...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <UserCheck size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-black text-slate-800">No personnel found on duty matching filters</p>
              <p className="text-xs text-slate-400">Click &quot;Check-in Personnel&quot; above to log on-duty medical staff for this shift.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Staff Name & Role</th>
                    <th className="py-3.5 px-4">Department / Vehicle</th>
                    <th className="py-3.5 px-4">Shift</th>
                    <th className="py-3.5 px-4">Duty Status</th>
                    <th className="py-3.5 px-4">Check-in Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.map((r) => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP.off_duty;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                              {r.name?.charAt(0) || 'S'}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 text-xs">{r.name}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">{r.specialization || (r.staff_type === 'doctor' ? 'Medical Staff' : 'Emergency EMT')}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{r.department || '—'}</p>
                          {r.assigned_vehicle_reg && (
                            <span className="text-[10px] font-mono font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              🚑 {r.assigned_vehicle_reg}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-bold">
                          {r.shift}
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={r.status}
                            onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                            className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${st.bg} ${st.text} ${st.border} focus:outline-none cursor-pointer`}>
                            <option value="on_duty">🟢 On-Duty / Ready</option>
                            <option value="in_ot">🟡 In OT / Surgery</option>
                            <option value="on_call">🔵 On-Call</option>
                            <option value="off_duty">⚪ Off-Duty</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 font-semibold text-[11px]">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {new Date(r.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove Record">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Manual Check-in Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Check-in On-Duty Personnel</h3>
                  <p className="text-[11px] text-slate-500 font-bold">{currentUser?.hospitalName || 'Hospital Duty Desk'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Personnel Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900">
                    <option value="doctor">Doctor / Specialist</option>
                    <option value="driver">Ambulance Driver / EMT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Shift</label>
                  <select
                    value={formShift}
                    onChange={e => setFormShift(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900">
                    {SHIFTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={formType === 'doctor' ? 'e.g. Dr. Rohan Mehta' : 'e.g. Suresh Kumar'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                />
              </div>

              {formType === 'doctor' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Department</label>
                    <select
                      value={formDept}
                      onChange={e => setFormDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900">
                      {DEPARTMENTS.filter(d => d !== 'All Departments').map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Specialization / Title</label>
                    <input
                      type="text"
                      value={formSpecialization}
                      onChange={e => setFormSpecialization(e.target.value)}
                      placeholder="e.g. Chief Trauma Surgeon"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Assigned Vehicle Reg Number</label>
                  <input
                    type="text"
                    value={formVehicleReg}
                    onChange={e => setFormVehicleReg(e.target.value)}
                    placeholder="e.g. KA-01-AB-1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Initial Duty Status</label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900">
                  <option value="on_duty">🟢 On-Duty / Ready for Emergencies</option>
                  <option value="in_ot">🟡 In OT / Surgery</option>
                  <option value="on_call">🔵 On-Call Emergency</option>
                  <option value="off_duty">⚪ Off-Duty</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2">
                  <Plus size={14} />
                  {submitting ? 'Recording...' : 'Record Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
