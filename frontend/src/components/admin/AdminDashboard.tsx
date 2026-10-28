import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { UserRole } from '../../types/index.js';
import { Shield, Key, Truck, Hospital, Activity, Database, Clock, Copy, Check, UserCheck, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invites' | 'fleet' | 'hospitals' | 'audit' | 'health'>('invites');

  // Invites state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('AMBULANCE_CREW');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Fleet state
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [newRegNumber, setNewRegNumber] = useState('');
  const [newCallSign, setNewCallSign] = useState('');
  const [newAmbType, setNewAmbType] = useState('BASIC');

  // Hospital state
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [newHospName, setNewHospName] = useState('');
  const [newHospAddress, setNewHospAddress] = useState('');
  const [newHospPhone, setNewHospPhone] = useState('');
  const [newHospTrauma, setNewHospTrauma] = useState('2');
  const [newHospLat, setNewHospLat] = useState('13.0827');
  const [newHospLng, setNewHospLng] = useState('80.2707');

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Health state
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const loadData = async () => {
    try {
      if (activeTab === 'fleet') {
        const res = await api.getAmbulances();
        setAmbulances(res.ambulances || []);
      } else if (activeTab === 'hospitals') {
        const res = await api.getHospitals();
        setHospitals(res.hospitals || []);
      } else if (activeTab === 'audit') {
        const res = await api.getAuditLogs(1, 50, auditActionFilter);
        setAuditLogs(res.logs || []);
      } else if (activeTab === 'health') {
        const res = await api.getSystemHealth();
        setSystemHealth(res);
      }
    } catch (err) {
      console.error('Failed to load admin tab data', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, auditActionFilter]);

  // Generate privileged invitation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: inviteOrgId.trim() || undefined,
      });
      setGeneratedToken(res.invitation.invitationToken);
      setInviteEmail('');
    } catch (err: any) {
      alert(`Invitation generation failed: ${err.message}`);
    }
  };

  // Add ambulance
  const handleAddAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAmbulance({
        registrationNumber: newRegNumber.trim().toUpperCase(),
        callSign: newCallSign.trim().toUpperCase(),
        type: newAmbType,
        equipmentList: ['DEFIBRILLATOR', 'OXYGEN_CYLINDER', 'STRETCHER', 'IV_KIT'],
      });
      setNewRegNumber('');
      setNewCallSign('');
      loadData();
      alert('Ambulance registered successfully.');
    } catch (err: any) {
      alert(`Ambulance registration failed: ${err.message}`);
    }
  };

  // Add hospital
  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHospital({
        name: newHospName.trim(),
        address: newHospAddress.trim(),
        contactPhone: newHospPhone.trim(),
        traumaLevel: parseInt(newHospTrauma, 10),
        latitude: parseFloat(newHospLat),
        longitude: parseFloat(newHospLng),
        verified: true,
      });
      setNewHospName('');
      setNewHospAddress('');
      setNewHospPhone('');
      loadData();
      alert('Hospital registered and verified.');
    } catch (err: any) {
      alert(`Hospital registration failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Admin Nav Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-800 pb-3">
        <button
          onClick={() => setActiveTab('invites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'invites' ? 'bg-cyan-500 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Key className="w-4 h-4" /> Role Invitations
        </button>
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'fleet' ? 'bg-cyan-500 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Truck className="w-4 h-4" /> Fleet Registry
        </button>
        <button
          onClick={() => setActiveTab('hospitals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'hospitals' ? 'bg-cyan-500 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Hospital className="w-4 h-4" /> Hospital Facilities
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'audit' ? 'bg-cyan-500 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Immutable Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'health' ? 'bg-cyan-500 text-navy-950' : 'bg-navy-900 text-slate-300 hover:bg-navy-800'
          }`}
        >
          <Activity className="w-4 h-4" /> System Health Diagnostics
        </button>
      </div>

      {/* Tab 1: Privileged Invitation Generator */}
      {activeTab === 'invites' && (
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Provision Privileged Personnel</h3>
            <p className="text-xs text-slate-400">
              Rule 3 Compliance: Public registration cannot create privileged accounts. Authorized invitations must be cryptographically generated and securely provided to vetted crew, hospital staff, and dispatchers.
            </p>
          </div>

          <form onSubmit={handleCreateInvite} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Work Email *</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="paramedic.kumar@ems.gov"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Privileged Role *</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="AMBULANCE_CREW">Ambulance Crew (Paramedic/Driver)</option>
                  <option value="HOSPITAL_STAFF">Hospital Medical Staff</option>
                  <option value="DISPATCHER">Emergency CAD Dispatcher</option>
                  <option value="SYSTEM_ADMIN">System Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Affiliated Organization ID</label>
                <input
                  type="text"
                  value={inviteOrgId}
                  onChange={(e) => setInviteOrgId(e.target.value)}
                  placeholder="Optional Hospital / Agency UUID"
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 uppercase tracking-wider transition-colors"
            >
              Generate Cryptographic Invitation
            </button>
          </form>

          {generatedToken && (
            <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-700/60 space-y-2">
              <span className="text-xs font-bold text-cyan-300">Generated Invitation Token (One-Time Display):</span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedToken}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg p-2 font-mono text-xs text-cyan-400 select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedToken);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 3000);
                  }}
                  className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-navy-950"
                  title="Copy Token"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Provide this token to the recipient along with the application link: <span className="font-mono text-slate-300">/accept-invitation</span>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Fleet Registry */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">Register New Ambulance Unit</h3>
            <form onSubmit={handleAddAmbulance} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Registration #</label>
                <input
                  type="text"
                  required
                  value={newRegNumber}
                  onChange={(e) => setNewRegNumber(e.target.value)}
                  placeholder="TN-01-EM-2026"
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Radio Call Sign</label>
                <input
                  type="text"
                  required
                  value={newCallSign}
                  onChange={(e) => setNewCallSign(e.target.value)}
                  placeholder="MEDIC-04"
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Type</label>
                <select
                  value={newAmbType}
                  onChange={(e) => setNewAmbType(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="BASIC">BASIC (BLS)</option>
                  <option value="ADVANCED">ADVANCED (ALS)</option>
                  <option value="ICU">ICU (Mobile Critical Care)</option>
                  <option value="NEONATAL">NEONATAL (Pediatric)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 uppercase"
                >
                  Add Unit
                </button>
              </div>
            </form>
          </div>

          <div className="bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 uppercase font-mono border-b border-navy-800">
                <tr>
                  <th className="py-3 px-4">Call Sign</th>
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Active Crew</th>
                  <th className="py-3 px-4">Last GPS Coordinate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60 text-slate-300">
                {ambulances.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 px-4 font-mono font-bold text-white">{a.callSign}</td>
                    <td className="py-3 px-4 font-mono">{a.registrationNumber}</td>
                    <td className="py-3 px-4">{a.type}</td>
                    <td className="py-3 px-4 font-bold text-cyan-400">{a.status}</td>
                    <td className="py-3 px-4">
                      {a.crewAssignments?.[0]?.user?.fullName || <span className="text-slate-500">Uncrewed</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {a.currentLatitude && a.currentLongitude
                        ? `[${a.currentLatitude.toFixed(4)}, ${a.currentLongitude.toFixed(4)}]`
                        : 'No GPS stream yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Hospital Facilities */}
      {activeTab === 'hospitals' && (
        <div className="space-y-6">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">Register Verified Trauma Facility</h3>
            <form onSubmit={handleAddHospital} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Hospital Name</label>
                  <input
                    type="text"
                    required
                    value={newHospName}
                    onChange={(e) => setNewHospName(e.target.value)}
                    placeholder="Apollo Trauma Specialty Hospital"
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={newHospPhone}
                    onChange={(e) => setNewHospPhone(e.target.value)}
                    placeholder="+914428290200"
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Trauma Level</label>
                  <select
                    value={newHospTrauma}
                    onChange={(e) => setNewHospTrauma(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="1">Level 1 (Full Comprehensive Surgical & ICU)</option>
                    <option value="2">Level 2 (Emergency Surgical & ICU)</option>
                    <option value="3">Level 3 (Community Resuscitation)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Physical Address</label>
                  <input
                    type="text"
                    required
                    value={newHospAddress}
                    onChange={(e) => setNewHospAddress(e.target.value)}
                    placeholder="21 Greams Lane, Thousand Lights, Chennai"
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newHospLat}
                      onChange={(e) => setNewHospLat(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newHospLng}
                      onChange={(e) => setNewHospLng(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="py-2 px-5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 uppercase"
              >
                Register & Verify Facility
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hospitals.map((h) => (
              <div key={h.id} className="bg-navy-900 border border-navy-700 rounded-xl p-4 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{h.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                    Trauma L{h.traumaLevel ?? 2}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{h.address}</p>
                <div className="pt-2 border-t border-navy-800 text-xs flex justify-between text-slate-300">
                  <span>Available Beds: <strong className="text-emerald-400">{h.hospitalCapacity?.availableBeds ?? 0}</strong></span>
                  <span>ICU Available: <strong className="text-cyan-400">{h.hospitalCapacity?.icuBedsAvailable ?? 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Immutable Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden shadow-xl space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Immutable Operational Audit Trail</span>
            </h3>
            <input
              type="text"
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              placeholder="Filter by action (e.g. ALLOCATE)..."
              className="bg-navy-950 border border-navy-700 rounded-lg px-3 py-1 text-xs text-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 font-mono uppercase border-b border-navy-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No audit records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-navy-800/40">
                      <td className="py-2.5 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-400">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-300">{log.entityType} ({log.entityId?.slice(0, 8) || 'N/A'})</td>
                      <td className="py-2.5 px-3">{log.user?.fullName || log.userId?.slice(0, 8) || 'System'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{log.ipAddress || 'Internal'}</td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{JSON.stringify(log.metadata || {})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: System Health Diagnostics */}
      {activeTab === 'health' && (
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-navy-800">
            <div>
              <h3 className="text-base font-bold text-white">Production System Health Diagnostics</h3>
              <p className="text-xs text-slate-400">Live inspection of infrastructure, database, and telemetry services</p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-800 hover:bg-navy-700 text-cyan-400 border border-navy-700"
            >
              Run Diagnostic Probe
            </button>
          </div>

          {systemHealth ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">PostgreSQL Database</span>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${systemHealth.database?.connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
                  <span className="text-sm font-mono font-bold text-white">
                    {systemHealth.database?.connected ? 'CONNECTED (ACID Safe)' : 'DISCONNECTED'}
                  </span>
                </div>
                {systemHealth.database?.error && (
                  <p className="text-[11px] text-red-400">{systemHealth.database.error}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Routing & ETA Provider</span>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${systemHealth.routingProvider?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-sm font-mono font-bold text-white">
                    {systemHealth.routingProvider?.provider} ({systemHealth.routingProvider?.status})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate">{systemHealth.routingProvider?.endpoint}</p>
              </div>

              <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Node.js Process & Memory</span>
                <p className="text-sm font-mono font-bold text-white">
                  Uptime: {systemHealth.uptimeSeconds}s • Heap: {systemHealth.memory?.heapUsedMb} MB
                </p>
                <p className="text-[11px] text-slate-400">Environment: {systemHealth.environment}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Loading system diagnostic telemetry...</p>
          )}
        </div>
      )}
    </div>
  );
};
