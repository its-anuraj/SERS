'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UserCheck, Stethoscope, Ambulance, Clock, Plus, Search,
  Filter, CheckCircle2, AlertCircle, Phone, Building2,
  Calendar, Shield, RefreshCw, X, ArrowLeft, Activity,
  ChevronRight, Sparkles, Trash2, Edit3, HeartPulse, Brain,
  Bone, Baby, Syringe, Eye, LogOut
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AttendanceRecord {
  id: string;
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
  'Cardiology',
  'Neurology & Neuro-Trauma',
  'Orthopedics & Spine',
  'Critical Care / ICU',
  'General Surgery',
  'Anesthesiology',
  'Pediatrics & Neonatology',
  'Radiology & CT Scan',
];

const SHIFTS = [
  'Morning (08:00 - 16:00)',
  'Evening (16:00 - 00:00)',
  'Night Emergency (00:00 - 08:00)',
];

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  on_duty: { label: 'On-Duty / Available', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  in_ot: { label: 'In OT / Surgery', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  on_call: { label: 'On-Call', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  off_duty: { label: 'Off-Duty', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
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

  // Form State
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
      const res = await fetch(`${API}/api/attendance`);
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

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      setMsg({ type: 'success', text: `Attendance for ${formName} recorded successfully!` });
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
      await fetch(`${API}/api/attendance/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API}/api/attendance/${id}`, { method: 'DELETE' });
      await fetchAttendance();
    } catch (e) {
      console.error('Error deleting record:', e);
    }
  };

  // Filtered lists
  const doctorsList = records.filter(r => r.staff_type === 'doctor');
  const driversList = records.filter(r => r.staff_type === 'driver' || r.staff_type === 'paramedic');

  const activeTabList = tab === 'doctors' ? doctorsList : driversList;
  const filtered = activeTabList.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone && r.phone.includes(search)) ||
      (r.specialization && r.specialization.toLowerCase().includes(search.toLowerCase())) ||
      (r.assigned_vehicle_reg && r.assigned_vehicle_reg.toLowerCase().includes(search.toLowerCase()));

    const matchesDept =
      selectedDept === 'All Departments' ||
      (r.department && r.department.toLowerCase() === selectedDept.toLowerCase());

    const matchesStatus =
      selectedStatus === 'all' || r.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Metrics
  const onDutyDoctors = doctorsList.filter(d => d.status === 'on_duty').length;
  const inOtDoctors = doctorsList.filter(d => d.status === 'in_ot').length;
  const onDutyDrivers = driversList.filter(d => d.status === 'on_duty').length;
  const onCallSpecialists = doctorsList.filter(d => d.status === 'on_call').length;

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 font-sans flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all">
            <ArrowLeft size={14} /> Back to Command Center
          </Link>
          <div className="hidden sm:block">
            <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck size={18} className="text-rose-600" />
              Duty Attendance & Specialist Roster
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormType('doctor');
              setShowModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-101 active:scale-99">
            <Plus size={15} /> Check-In Doctor
          </button>
          <button
            onClick={() => {
              setFormType('driver');
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-101 active:scale-99">
            <Plus size={15} /> Check-In Driver
          </button>
          <button
            onClick={fetchAttendance}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
        {/* Messages */}
        {msg && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 ${
              msg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
            {msg.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Doctors On-Duty</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{loading ? '—' : onDutyDoctors}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Available for Emergency / Triage</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Stethoscope size={22} />
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Surgeons in OT</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{loading ? '—' : inOtDoctors}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">In Emergency Operations</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity size={22} />
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Ambulance Drivers</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{loading ? '—' : onDutyDrivers}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active on Shift / Ready</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Ambulance size={22} />
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">On-Call Specialists</p>
              <p className="text-2xl font-black text-purple-600 mt-1">{loading ? '—' : onCallSpecialists}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Standby for Critical Trauma</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Phone size={22} />
            </div>
          </div>
        </div>

        {/* Tab Selector & Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          {/* Main Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('doctors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                tab === 'doctors'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              <Stethoscope size={15} className={tab === 'doctors' ? 'text-emerald-600' : ''} />
              On-Duty Doctors & Specialists ({doctorsList.length})
            </button>
            <button
              onClick={() => setTab('drivers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                tab === 'drivers'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              <Ambulance size={15} className={tab === 'drivers' ? 'text-blue-600' : ''} />
              Ambulance Drivers & EMTs ({driversList.length})
            </button>
          </div>

          {/* Search & Select Filters */}
          <div className="flex items-center gap-2 flex-wrap flex-1 md:justify-end">
            <div className="relative min-w-[200px] flex-1 md:flex-initial">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'doctors' ? 'Search by doctor name or specialty...' : 'Search by driver name or vehicle...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            {tab === 'doctors' && (
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none">
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none">
              <option value="all">All Statuses</option>
              <option value="on_duty">On-Duty / Available</option>
              <option value="in_ot">In OT / Surgery</option>
              <option value="on_call">On-Call</option>
              <option value="off_duty">Off-Duty</option>
            </select>
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 font-extrabold text-sm">
            Loading today's live duty roster...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-14 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <UserCheck size={26} />
            </div>
            <p className="text-base font-extrabold text-slate-800">
              {tab === 'doctors'
                ? 'No doctors or clinical specialists checked in yet for today'
                : 'No ambulance drivers checked in yet for today'}
            </p>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              {tab === 'doctors'
                ? 'Check in your attending physicians, cardiologists, neuro-trauma surgeons, and critical care specialists to coordinate emergency arrivals.'
                : 'Check in your emergency ambulance drivers and first-responder paramedics with their assigned vehicle numbers.'}
            </p>
            <button
              onClick={() => {
                setFormType(tab === 'doctors' ? 'doctor' : 'driver');
                setShowModal(true);
              }}
              className="mt-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer">
              <Plus size={15} /> Check-In First {tab === 'doctors' ? 'Doctor' : 'Driver'}
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(record => {
              const statusCfg = STATUS_MAP[record.status] || STATUS_MAP.on_duty;
              return (
                <div
                  key={record.id}
                  className="glass-card p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4 hover:border-slate-300 transition-all">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          record.staff_type === 'doctor'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}>
                        {record.staff_type === 'doctor' ? <Stethoscope size={20} /> : <Ambulance size={20} />}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">{record.name}</h3>
                        <p className="text-[11px] font-extrabold text-slate-500">
                          {record.staff_type === 'doctor' ? record.department : `Vehicle: ${record.assigned_vehicle_reg || 'Unassigned'}`}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                      ● {statusCfg.label}
                    </span>
                  </div>

                  {/* Details Body */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs space-y-1.5">
                    {record.specialization && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">Specialty:</span>
                        <span className="font-extrabold text-slate-800">{record.specialization}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold">Shift:</span>
                      <span className="font-extrabold text-slate-800">{record.shift}</span>
                    </div>
                    {record.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">Direct Contact:</span>
                        <a href={`tel:${record.phone}`} className="font-extrabold text-rose-600 hover:underline">
                          {record.phone}
                        </a>
                      </div>
                    )}
                    {record.notes && (
                      <div className="pt-1 border-t border-slate-200/40 text-[11px] text-slate-500 italic">
                        "{record.notes}"
                      </div>
                    )}
                  </div>

                  {/* Quick Action Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateStatus(record.id, 'on_duty')}
                        className={`text-[10px] font-black px-2 py-1 rounded-lg border transition-all ${
                          record.status === 'on_duty'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}>
                        On-Duty
                      </button>
                      {record.staff_type === 'doctor' && (
                        <button
                          onClick={() => handleUpdateStatus(record.id, 'in_ot')}
                          className={`text-[10px] font-black px-2 py-1 rounded-lg border transition-all ${
                            record.status === 'in_ot'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                          }`}>
                          In OT
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(record.id, 'off_duty')}
                        className={`text-[10px] font-black px-2 py-1 rounded-lg border transition-all ${
                          record.status === 'off_duty'
                            ? 'bg-slate-700 text-white border-slate-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}>
                        Off-Duty
                      </button>
                    </div>

                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors"
                      title="Delete entry">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CHECK-IN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-rose-600" />
                {formType === 'doctor' ? 'Check-In Doctor / Specialist' : 'Check-In Ambulance Driver / EMT'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Type selector inside modal */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFormType('doctor')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  formType === 'doctor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}>
                🩺 Doctor / Specialist
              </button>
              <button
                type="button"
                onClick={() => setFormType('driver')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  formType === 'driver' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}>
                🚑 Ambulance Driver / EMT
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={formType === 'doctor' ? 'e.g. Ramesh Kumar' : 'e.g. Suresh Paramedic'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Shift</label>
                  <select
                    value={formShift}
                    onChange={e => setFormShift(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none">
                    {SHIFTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formType === 'doctor' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Clinical Department</label>
                    <select
                      value={formDept}
                      onChange={e => setFormDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none">
                      {DEPARTMENTS.filter(d => d !== 'All Departments').map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Specialization / Role</label>
                    <input
                      type="text"
                      value={formSpecialization}
                      onChange={e => setFormSpecialization(e.target.value)}
                      placeholder="e.g. Interventional Cardiologist"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Assigned Ambulance Number</label>
                  <input
                    type="text"
                    required
                    value={formVehicleReg}
                    onChange={e => setFormVehicleReg(e.target.value)}
                    placeholder="e.g. KA-01-EA-1001 (ALS Unit)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Current Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none">
                    <option value="on_duty">On-Duty / Available</option>
                    {formType === 'doctor' && <option value="in_ot">In OT / Surgery</option>}
                    <option value="on_call">On-Call</option>
                    <option value="off_duty">Off-Duty</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Notes (Optional)</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="e.g. ER Room 4 / Desk"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-md shadow-rose-600/20">
                  {submitting ? 'Saving...' : 'Confirm Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
