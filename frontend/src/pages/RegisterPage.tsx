import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { UserRole } from '../types/index.js';
import {
  User,
  Lock,
  Mail,
  Phone,
  AlertCircle,
  ArrowLeft,
  Radio,
  Building2,
  ShieldCheck,
  Ambulance,
  HeartPulse,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface RegisterPageProps {
  initialRole?: UserRole;
  onSuccess: (role: UserRole) => void;
  onNavigateLogin: () => void;
}

interface RoleConfig {
  id: UserRole;
  title: string;
  shortName: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  badgeColor: string;
}

const ROLES: RoleConfig[] = [
  {
    id: 'PATIENT_REQUESTER',
    title: 'Patient / Citizen Requester',
    shortName: 'Patient',
    badge: 'Public',
    description: 'Report medical emergencies and track dispatched ambulances with real-time GPS routing.',
    icon: User,
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/60',
    bgColor: 'bg-cyan-950/40',
    badgeColor: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
  },
  {
    id: 'DISPATCHER',
    title: 'Emergency Dispatcher',
    shortName: 'Dispatcher',
    badge: 'CAD Command',
    description: 'Computer-Aided Dispatch operations: triage queues, concurrent allocation, and fleet routing.',
    icon: Radio,
    accentColor: 'text-sky-400',
    borderColor: 'border-sky-500/60',
    bgColor: 'bg-sky-950/40',
    badgeColor: 'bg-sky-900/60 text-sky-300 border-sky-700',
  },
  {
    id: 'AMBULANCE_CREW',
    title: 'Paramedic / Ambulance Crew',
    shortName: 'Ambulance Crew',
    badge: 'MDT Field Unit',
    description: 'In-vehicle Mobile Data Terminal: live GPS broadcasts, run sheets, and patient handovers.',
    icon: Ambulance,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60',
    bgColor: 'bg-emerald-950/40',
    badgeColor: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  },
  {
    id: 'HOSPITAL_STAFF',
    title: 'Hospital Clinical Staff',
    shortName: 'Hospital Staff',
    badge: 'Trauma Center',
    description: 'Emergency department bed management, ICU capacity tracking, and inbound trauma triage.',
    icon: Building2,
    accentColor: 'text-purple-400',
    borderColor: 'border-purple-500/60',
    bgColor: 'bg-purple-950/40',
    badgeColor: 'bg-purple-900/60 text-purple-300 border-purple-700',
  },
  {
    id: 'SYSTEM_ADMIN',
    title: 'System Administrator',
    shortName: 'Admin',
    badge: 'SecOps',
    description: 'System-wide governance: immutable audit logs, personnel provisioning, and fleet management.',
    icon: ShieldCheck,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/60',
    bgColor: 'bg-amber-950/40',
    badgeColor: 'bg-amber-900/60 text-amber-300 border-amber-700',
  },
];

export const RegisterPage: React.FC<RegisterPageProps> = ({ initialRole = 'PATIENT_REQUESTER', onSuccess, onNavigateLogin }) => {
  const { register } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [crewSpecialization, setCrewSpecialization] = useState('PARAMEDIC');
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string; traumaLevel?: number }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available hospital facilities if registering as hospital staff
  useEffect(() => {
    api.getHospitals()
      .then((res) => {
        if (res.hospitals && Array.isArray(res.hospitals)) {
          setHospitals(res.hospitals);
          if (res.hospitals.length > 0 && !organizationId) {
            setOrganizationId(res.hospitals[0].id);
          }
        }
      })
      .catch(() => {
        // Non-critical: allow manual hospital entry or empty
      });
  }, []);

  const activeRoleConfig = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  // Password requirements validation
  const hasMinLength = password.length >= 10;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setErrorMessage('Password must satisfy all security requirements (min 10 chars, uppercase, lowercase, number, special char).');
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role: selectedRole,
      };

      if (selectedRole === 'HOSPITAL_STAFF' && organizationId) {
        payload.organizationId = organizationId;
      }

      await register(payload);
      onSuccess(selectedRole);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-6 p-4 sm:p-6 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateLogin}
            className="p-2 rounded-xl bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
            title="Back to Sign In"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Account Registration</span>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${activeRoleConfig.badgeColor}`}>
                {activeRoleConfig.badge}
              </span>
            </h2>
            <p className="text-xs text-slate-400">Select your operational role to configure access permissions</p>
          </div>
        </div>

        <button
          onClick={onNavigateLogin}
          className="text-xs font-semibold text-cyan-400 hover:underline hidden sm:block"
        >
          Already have an account? Sign In
        </button>
      </div>

      {/* Role Selector Tabs */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
          Select Registration Role:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ROLES.map((role) => {
            const IconComponent = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedRole(role.id);
                  setErrorMessage(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1.5 ${
                  isSelected
                    ? `${role.bgColor} ${role.borderColor} shadow-lg ring-1 ring-cyan-500/30 text-white font-bold`
                    : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-navy-900 text-white shadow' : 'bg-navy-900/60 text-slate-400'}`}>
                  <IconComponent className={`w-4 h-4 ${isSelected ? role.accentColor : ''}`} />
                </div>
                <span className="text-[11px] font-bold leading-tight line-clamp-1">{role.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role Description Banner */}
      <div className={`p-3.5 rounded-xl border ${activeRoleConfig.bgColor} ${activeRoleConfig.borderColor} flex items-start gap-3`}>
        <div className="p-1.5 rounded-lg bg-navy-900/80 border border-navy-700 mt-0.5">
          <activeRoleConfig.icon className={`w-4 h-4 ${activeRoleConfig.accentColor}`} />
        </div>
        <div>
          <h4 className={`text-xs font-bold ${activeRoleConfig.accentColor}`}>{activeRoleConfig.title}</h4>
          <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">{activeRoleConfig.description}</p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-700 text-red-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Conditional Role-Specific Fields */}
          {selectedRole === 'HOSPITAL_STAFF' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Affiliated Hospital / Center</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select affiliated trauma facility...</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.traumaLevel ? `(Trauma Level ${h.traumaLevel})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {selectedRole === 'AMBULANCE_CREW' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Crew Specialty</label>
              <div className="relative">
                <HeartPulse className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <select
                  value={crewSpecialization}
                  onChange={(e) => setCrewSpecialization(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="PARAMEDIC">Lead Paramedic (ALS / Critical Care)</option>
                  <option value="EMT">Emergency Medical Technician (BLS)</option>
                  <option value="DRIVER">Emergency Response Driver</option>
                </select>
              </div>
            </div>
          )}

          {selectedRole !== 'HOSPITAL_STAFF' && selectedRole !== 'AMBULANCE_CREW' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Security Verification</label>
              <div className="p-2 rounded-xl bg-navy-950 border border-navy-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Direct account provisioning with immediate access</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Security Checklist */}
        <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1 text-[11px]">
          <span className="font-semibold text-slate-400 block mb-1">Password Security Standards:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-slate-400">
            <span className={hasMinLength ? 'text-emerald-400 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
              {hasMinLength ? '✓' : '•'} At least 10 chars
            </span>
            <span className={hasUpper ? 'text-emerald-400 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
              {hasUpper ? '✓' : '•'} 1 Uppercase (A-Z)
            </span>
            <span className={hasLower ? 'text-emerald-400 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
              {hasLower ? '✓' : '•'} 1 Lowercase (a-z)
            </span>
            <span className={hasNumber ? 'text-emerald-400 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
              {hasNumber ? '✓' : '•'} 1 Number (0-9)
            </span>
            <span className={hasSpecial ? 'text-emerald-400 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
              {hasSpecial ? '✓' : '•'} 1 Special symbol
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
            selectedRole === 'PATIENT_REQUESTER'
              ? 'bg-cyan-500 hover:bg-cyan-400 text-navy-950'
              : selectedRole === 'DISPATCHER'
              ? 'bg-sky-500 hover:bg-sky-400 text-navy-950'
              : selectedRole === 'AMBULANCE_CREW'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
              : selectedRole === 'HOSPITAL_STAFF'
              ? 'bg-purple-500 hover:bg-purple-400 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-navy-950'
          }`}
        >
          {isLoading ? (
            <span>Creating Account...</span>
          ) : (
            <>
              <activeRoleConfig.icon className="w-4 h-4" />
              <span>Register {activeRoleConfig.shortName} Account</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-3 border-t border-navy-800 text-center text-xs">
        <p className="text-slate-400">
          Already registered?{' '}
          <button onClick={onNavigateLogin} className="text-cyan-400 hover:underline font-semibold">
            Sign In here
          </button>
        </p>
      </div>
    </div>
  );
};
