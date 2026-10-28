import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { PriorityBadge, CaseStatusBadge } from '../common/StatusBadge.js';
import { Organization, EmergencyCase } from '../../types/index.js';
import { Hospital, Bed, Activity, Check, X, Clock, AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';

export const HospitalStaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [hospital, setHospital] = useState<Organization | null>(null);
  const [inboundCases, setInboundCases] = useState<EmergencyCase[]>([]);
  const [totalBeds, setTotalBeds] = useState(0);
  const [availableBeds, setAvailableBeds] = useState(0);
  const [icuBedsTotal, setIcuBedsTotal] = useState(0);
  const [icuBedsAvailable, setIcuBedsAvailable] = useState(0);
  const [oxygenAvailable, setOxygenAvailable] = useState(true);
  const [ventilatorAvailable, setVentilatorAvailable] = useState(true);
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'ACCEPTED' | 'DECLINED'>('ACCEPTED');
  const [decisionReason, setDecisionReason] = useState('');

  const loadHospitalData = async () => {
    try {
      const hospRes = await api.getHospitals();
      // Match user's affiliated organization or use the first verified hospital
      const myHosp = hospRes.hospitals?.find((h: Organization) => h.id === user?.organizationId) || hospRes.hospitals?.[0];

      if (myHosp) {
        setHospital(myHosp);
        const cap = myHosp.hospitalCapacity;
        if (cap) {
          setTotalBeds(cap.totalBeds);
          setAvailableBeds(cap.availableBeds);
          setIcuBedsTotal(cap.icuBedsTotal);
          setIcuBedsAvailable(cap.icuBedsAvailable);
          setOxygenAvailable(cap.oxygenAvailable);
          setVentilatorAvailable(cap.ventilatorAvailable);
        }

        // Load cases coordinated with this hospital
        const casesRes = await api.getCases();
        const relevantCases = casesRes.cases?.filter((c: EmergencyCase) =>
          c.coordinations?.some((coord) => coord.hospital?.id === myHosp.id)
        );
        setInboundCases(relevantCases || []);
      }
    } catch (err) {
      console.error('Failed to load hospital portal data', err);
    }
  };

  useEffect(() => {
    loadHospitalData();
  }, [user]);

  // Real-time inbound notice & capacity updates
  useEffect(() => {
    if (!socket || !hospital) return;

    const handleInboundNotice = () => {
      loadHospitalData();
    };

    socket.on('emergency:inbound_notice', handleInboundNotice);
    socket.on('emergency:status_change', handleInboundNotice);

    return () => {
      socket.off('emergency:inbound_notice', handleInboundNotice);
      socket.off('emergency:status_change', handleInboundNotice);
    };
  }, [socket, hospital]);

  // Update Bed Capacity
  const handleCapacitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital) return;

    setIsUpdatingCapacity(true);
    try {
      await api.updateCapacity(hospital.id, {
        totalBeds: Number(totalBeds),
        availableBeds: Number(availableBeds),
        icuBedsTotal: Number(icuBedsTotal),
        icuBedsAvailable: Number(icuBedsAvailable),
        oxygenAvailable,
        ventilatorAvailable,
      });
      alert('Hospital capacity updated and broadcasted to dispatchers.');
      loadHospitalData();
    } catch (err: any) {
      alert(`Capacity update failed: ${err.message}`);
    } finally {
      setIsUpdatingCapacity(false);
    }
  };

  // Submit Coordination Decision (Accept / Decline)
  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital || !selectedCaseId || !decisionReason.trim()) return;

    try {
      await api.respondCoordination(selectedCaseId, hospital.id, {
        status: decisionType,
        bedsReserved: decisionType === 'ACCEPTED' ? 1 : 0,
        responseReason: decisionReason.trim(),
      });

      setIsDecisionModalOpen(false);
      setSelectedCaseId(null);
      setDecisionReason('');
      loadHospitalData();
    } catch (err: any) {
      alert(`Decision recording failed: ${err.message}`);
    }
  };

  if (!hospital) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Hospital className="w-8 h-8 text-cyan-400 mx-auto animate-pulse mb-3" />
        <p className="text-sm">Connecting to Hospital Coordination Network...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hospital Identity Header */}
      <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-600/80 flex items-center justify-center text-emerald-400 shadow-lg">
            <Hospital className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">{hospital.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                Trauma Level {hospital.traumaLevel ?? 'General'}
              </span>
            </div>
            <p className="text-xs text-slate-400">{hospital.address} • Contact: {hospital.contactPhone}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400">Capacity Observation Status:</span>
          <div className="text-xs font-bold text-emerald-400">
            {hospital.hospitalCapacity?.updatedAt
              ? `Verified ${new Date(hospital.hospitalCapacity.updatedAt).toLocaleTimeString()}`
              : 'Observation Pending'}
          </div>
        </div>
      </div>

      {/* Main Grid: Bed Management (Left) + Inbound Ambulance Queue (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bed Capacity Manager (1 Col) */}
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Bed className="w-4 h-4 text-cyan-400" />
            <span>Capacity & Critical Resources</span>
          </h3>

          <form onSubmit={handleCapacitySubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Standard Beds Total</label>
                <input
                  type="number"
                  min="0"
                  value={totalBeds}
                  onChange={(e) => setTotalBeds(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Available Beds</label>
                <input
                  type="number"
                  min="0"
                  max={totalBeds}
                  value={availableBeds}
                  onChange={(e) => setAvailableBeds(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Total ICU Beds</label>
                <input
                  type="number"
                  min="0"
                  value={icuBedsTotal}
                  onChange={(e) => setIcuBedsTotal(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Available ICU</label>
                <input
                  type="number"
                  min="0"
                  max={icuBedsTotal}
                  value={icuBedsAvailable}
                  onChange={(e) => setIcuBedsAvailable(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-1.5 text-xs font-bold text-cyan-400"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-navy-800">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oxygenAvailable}
                  onChange={(e) => setOxygenAvailable(e.target.checked)}
                  className="rounded bg-navy-950 border-navy-700 text-cyan-500"
                />
                <span>Central Medical Oxygen Supply Operational</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ventilatorAvailable}
                  onChange={(e) => setVentilatorAvailable(e.target.checked)}
                  className="rounded bg-navy-950 border-navy-700 text-cyan-500"
                />
                <span>Mechanical Ventilators Ready in Trauma Bay</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isUpdatingCapacity}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-navy-950 uppercase tracking-wider transition-colors shadow-md"
            >
              {isUpdatingCapacity ? 'Broadcasting...' : 'Update & Verify Capacity'}
            </button>
          </form>
        </div>

        {/* Inbound Coordinated Emergencies (2 Cols) */}
        <div className="lg:col-span-2 bg-navy-900 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-navy-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Inbound Emergency Ambulance Coordination Feed</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{inboundCases.length} Coordinated Cases</span>
          </div>

          <div className="space-y-4">
            {inboundCases.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No inbound emergency patient coordinates directed to this trauma facility at present.
              </div>
            ) : (
              inboundCases.map((c) => {
                const coord = c.coordinations?.find((co) => co.hospital?.id === hospital.id);
                const assignedVehicle = c.allocations?.[0]?.ambulance;
                const etaMin = coord?.etaSeconds ? Math.round(coord.etaSeconds / 60) : 8;

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-navy-950 border border-navy-800 hover:border-navy-700 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white text-sm">{c.caseNumber}</span>
                        <PriorityBadge priority={c.triagePriority} />
                        <CaseStatusBadge status={c.status} />
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold">
                        <Clock className="w-3.5 h-3.5" /> ETA: ~{etaMin} mins
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-slate-300">
                        <strong>Patient Symptoms:</strong> {c.chiefComplaint}
                      </p>
                      <p className="text-slate-400">
                        <strong>Responding Vehicle:</strong> {assignedVehicle?.callSign || 'Allocating'} ({assignedVehicle?.type || 'BASIC'})
                      </p>
                      {coord?.responseReason && (
                        <p className="text-[11px] text-cyan-400 font-mono">
                          Algorithmic Routing Recommendation: {coord.responseReason}
                        </p>
                      )}
                    </div>

                    {/* Decision Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-navy-800/80">
                      <div className="text-xs">
                        <span className="text-slate-400">Coordination Status: </span>
                        <strong className="text-white uppercase">{coord?.status || 'RECOMMENDED'}</strong>
                      </div>

                      {coord?.status !== 'ACCEPTED' && coord?.status !== 'DECLINED' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedCaseId(c.id);
                              setDecisionType('DECLINED');
                              setIsDecisionModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-950/70 hover:bg-red-900 text-red-400 border border-red-800 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Divert
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCaseId(c.id);
                              setDecisionType('ACCEPTED');
                              setIsDecisionModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-md"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept Patient
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Decision Confirmed ({coord.status})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {isDecisionModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              {decisionType === 'ACCEPTED' ? 'Accept Incoming Patient' : 'Divert / Decline Patient'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {decisionType === 'ACCEPTED'
                ? 'Confirm trauma bay reservation and prepare clinical receiving team.'
                : 'Provide clinical justification for diversion so dispatchers can immediately reroute unit.'}
            </p>

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Clinical Reason / Preparation Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder={
                    decisionType === 'ACCEPTED'
                      ? 'Trauma Team Beta ready, CT scan cleared, ICU bed #4 prepped.'
                      : 'All adult ICU beds full; CT scanner undergoing urgent calibration.'
                  }
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDecisionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    decisionType === 'ACCEPTED' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  Confirm Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
