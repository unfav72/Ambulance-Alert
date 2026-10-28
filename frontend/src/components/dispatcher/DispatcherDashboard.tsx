import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useSocket } from '../../context/SocketContext.js';
import { EmergencyMap } from '../map/EmergencyMap.js';
import { PriorityBadge, CaseStatusBadge, VehicleStatusBadge } from '../common/StatusBadge.js';
import { EmergencyCase, Ambulance, Organization } from '../../types/index.js';
import { Siren, Shield, Radio, AlertTriangle, Hospital, Truck, RefreshCw, Zap, Clock, User } from 'lucide-react';

export const DispatcherDashboard: React.FC = () => {
  const { socket } = useSocket();
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [hospitals, setHospitals] = useState<Organization[]>([]);
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideAmbulanceId, setOverrideAmbulanceId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [casesRes, ambRes, hospRes] = await Promise.all([
        api.getCases(),
        api.getAmbulances(),
        api.getHospitals(),
      ]);
      setCases(casesRes.cases || []);
      setAmbulances(ambRes.ambulances || []);
      setHospitals(hospRes.hospitals || []);

      if (casesRes.cases?.length > 0 && !selectedCase) {
        setSelectedCase(casesRes.cases[0]);
      }
    } catch (err) {
      console.error('Failed to load dispatch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time socket events for CAD
  useEffect(() => {
    if (!socket) return;

    const handleNewEmergency = (newCase: EmergencyCase) => {
      setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    };

    const handleStatusChange = (data: any) => {
      setCases((prev) =>
        prev.map((c) => (c.id === data.caseId ? { ...c, status: data.status } : c))
      );
    };

    const handleGpsUpdate = (data: any) => {
      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === data.ambulanceId
            ? {
                ...a,
                currentLatitude: data.latitude,
                currentLongitude: data.longitude,
                lastGpsUpdate: data.deviceTimestamp,
                isTrackingActive: true,
              }
            : a
        )
      );
    };

    const handleCapacityUpdate = (data: any) => {
      setHospitals((prev) =>
        prev.map((h) =>
          h.id === data.hospitalId && h.hospitalCapacity
            ? {
                ...h,
                hospitalCapacity: {
                  ...h.hospitalCapacity,
                  availableBeds: data.availableBeds,
                  icuBedsAvailable: data.icuBedsAvailable,
                  updatedAt: data.updatedAt,
                },
              }
            : h
        )
      );
    };

    socket.on('emergency:new', handleNewEmergency);
    socket.on('emergency:status_change', handleStatusChange);
    socket.on('tracking:update', handleGpsUpdate);
    socket.on('hospital:capacity_update', handleCapacityUpdate);

    return () => {
      socket.off('emergency:new', handleNewEmergency);
      socket.off('emergency:status_change', handleStatusChange);
      socket.off('tracking:update', handleGpsUpdate);
      socket.off('hospital:capacity_update', handleCapacityUpdate);
    };
  }, [socket]);

  // Execute manual override
  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !overrideAmbulanceId || !overrideReason.trim()) return;

    try {
      await api.manualAllocate(selectedCase.id, overrideAmbulanceId, overrideReason);
      setIsOverrideModalOpen(false);
      setOverrideReason('');
      setOverrideAmbulanceId('');
      loadData();
    } catch (err: any) {
      alert(`Manual override failed: ${err.message}`);
    }
  };

  // Compile map markers
  const markers: any[] = [];

  // 1. Ambulances
  ambulances.forEach((a) => {
    if (a.currentLatitude && a.currentLongitude) {
      markers.push({
        id: a.id,
        lat: a.currentLatitude,
        lng: a.currentLongitude,
        title: a.callSign,
        type: 'AMBULANCE',
        details: `Unit: ${a.callSign} (${a.type}) • Status: ${a.status}`,
      });
    }
  });

  // 2. Emergencies
  cases.forEach((c) => {
    if (c.status !== 'HANDED_OVER' && c.status !== 'CANCELLED') {
      markers.push({
        id: c.id,
        lat: c.pickupLatitude,
        lng: c.pickupLongitude,
        title: `${c.caseNumber} (${c.triagePriority})`,
        type: 'PICKUP',
        details: `${c.pickupAddress} • ${c.chiefComplaint}`,
      });
    }
  });

  // 3. Hospitals
  hospitals.forEach((h) => {
    markers.push({
      id: h.id,
      lat: h.latitude,
      lng: h.longitude,
      title: h.name,
      type: 'HOSPITAL',
      details: `Beds: ${h.hospitalCapacity?.availableBeds ?? 'N/A'} (ICU: ${h.hospitalCapacity?.icuBedsAvailable ?? 'N/A'})`,
    });
  });

  const availableAmbulancesCount = ambulances.filter((a) => a.status === 'AVAILABLE').length;
  const activeMissionsCount = ambulances.filter((a) => a.status !== 'AVAILABLE' && a.status !== 'OFFLINE' && a.status !== 'MAINTENANCE').length;

  return (
    <div className="space-y-6">
      {/* Top CAD Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-900 border border-navy-800 p-4 rounded-xl shadow-md">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Emergencies</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white font-mono">{cases.filter((c) => c.status !== 'HANDED_OVER' && c.status !== 'CANCELLED').length}</span>
            <span className="text-xs text-red-400 font-semibold font-mono">
              ({cases.filter((c) => c.triagePriority === 'CRITICAL_P1' && c.status !== 'HANDED_OVER').length} P1 Critical)
            </span>
          </div>
        </div>

        <div className="bg-navy-900 border border-navy-800 p-4 rounded-xl shadow-md">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Fleet Units</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">{availableAmbulancesCount}</span>
            <span className="text-xs text-slate-400 font-mono">/ {ambulances.length} Units</span>
          </div>
        </div>

        <div className="bg-navy-900 border border-navy-800 p-4 rounded-xl shadow-md">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Units On Mission</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-cyan-400 font-mono">{activeMissionsCount}</span>
            <span className="text-xs text-cyan-500 font-mono animate-pulse">Dispatched</span>
          </div>
        </div>

        <div className="bg-navy-900 border border-navy-800 p-4 rounded-xl shadow-md">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Trauma Centers</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white font-mono">{hospitals.length}</span>
            <span className="text-xs text-emerald-400 font-mono">Ready</span>
          </div>
        </div>
      </div>

      {/* Main CAD Split: Operational Map (Top) & Emergency Queue + Fleet (Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Operational Map (2 Cols) */}
        <div className="lg:col-span-2 min-h-[460px] rounded-2xl overflow-hidden border border-navy-700 shadow-2xl relative">
          <EmergencyMap
            markers={markers}
            className="w-full h-full min-h-[460px]"
          />
          <div className="absolute top-3 right-3 z-[1000] flex gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-navy-900/90 hover:bg-navy-800 border border-navy-700 text-slate-300 transition-colors shadow-lg"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Case / Quick CAD Action Panel (1 Col) */}
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-navy-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CAD Action Console</span>
              {selectedCase && <PriorityBadge priority={selectedCase.triagePriority} />}
            </div>

            {selectedCase ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-extrabold text-white font-mono">{selectedCase.caseNumber}</h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">{selectedCase.chiefComplaint}</p>
                </div>

                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Caller:</span>
                    <span className="font-semibold text-white">{selectedCase.requesterName} ({selectedCase.requesterPhone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Address:</span>
                    <span className="text-slate-200 text-right max-w-[200px] truncate">{selectedCase.pickupAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <CaseStatusBadge status={selectedCase.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Unit:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {selectedCase.allocations?.[0]?.ambulance?.callSign || 'None / Pending'}
                    </span>
                  </div>
                </div>

                {selectedCase.status === 'ESCALATED' && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-700/60 text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Escalated Alert:</strong> Automatic allocation was unable to assign an available unit. Immediate manual override or secondary tier dispatch required.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">Select an emergency from the queue below to inspect or override.</p>
            )}
          </div>

          {selectedCase && (
            <div className="pt-4 border-t border-navy-800 space-y-2">
              <button
                onClick={() => setIsOverrideModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-navy-950 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>Manual Dispatch Override</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Cases Active Queue Table */}
      <div className="bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-navy-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Active CAD Emergency Queue</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">{cases.length} Total Incidents</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Case Number</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Caller & Location</th>
                <th className="py-3 px-4">Assigned Unit</th>
                <th className="py-3 px-4">Logged Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60 text-slate-300">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No active emergency incidents reported.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`hover:bg-navy-800/40 cursor-pointer transition-colors ${
                      selectedCase?.id === c.id ? 'bg-navy-800/60 border-l-4 border-cyan-400' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white">{c.caseNumber}</td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={c.triagePriority} />
                    </td>
                    <td className="py-3 px-4">
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{c.requesterName}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.pickupAddress}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {c.allocations?.[0]?.ambulance?.callSign || '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCase(c);
                          setIsOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Dispatch Override Modal */}
      {isOverrideModalOpen && selectedCase && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Manual Dispatch Override</h3>
            <p className="text-xs text-slate-400 mb-4">
              Override concurrent algorithm for incident <span className="font-mono text-cyan-400 font-bold">{selectedCase.caseNumber}</span>.
              Action is immutably audited.
            </p>

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Unit</label>
                <select
                  required
                  value={overrideAmbulanceId}
                  onChange={(e) => setOverrideAmbulanceId(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Unit --</option>
                  {ambulances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.callSign} ({a.type}) • {a.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Dispatch Justification Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Clinical reason, geographical obstacle, or secondary tier allocation..."
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-800 text-slate-300 hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 transition-colors"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
