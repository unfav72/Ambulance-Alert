import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useSocket } from '../../context/SocketContext.js';
import { EmergencyMap } from '../map/EmergencyMap.js';
import { PriorityBadge, CaseStatusBadge } from '../common/StatusBadge.js';
import { EmergencyCase } from '../../types/index.js';
import { Phone, Navigation, Shield, Clock, Hospital, CheckCircle2, Siren, ArrowLeft } from 'lucide-react';

interface CaseLiveTrackerProps {
  caseId: string;
  onBackToIntake?: () => void;
}

export const CaseLiveTracker: React.FC<CaseLiveTrackerProps> = ({ caseId, onBackToIntake }) => {
  const { socket, subscribeToCase, unsubscribeFromCase } = useSocket();
  const [caseData, setCaseData] = useState<EmergencyCase | null>(null);
  const [ambulanceGps, setAmbulanceGps] = useState<{ lat: number; lng: number; lastUpdate: string } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    const fetchCase = async () => {
      try {
        const response = await api.getCaseById(caseId);
        setCaseData(response.case);

        // Check if vehicle assigned
        const activeAlloc = response.case.allocations?.[0];
        if (activeAlloc?.ambulance?.currentLatitude && activeAlloc?.ambulance?.currentLongitude) {
          setAmbulanceGps({
            lat: activeAlloc.ambulance.currentLatitude,
            lng: activeAlloc.ambulance.currentLongitude,
            lastUpdate: activeAlloc.ambulance.lastGpsUpdate || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load emergency case', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCase();
    subscribeToCase(caseId);

    return () => {
      unsubscribeFromCase(caseId);
    };
  }, [caseId, subscribeToCase, unsubscribeFromCase]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (data: any) => {
      if (data.caseId === caseId) {
        setCaseData((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    };

    const handleAssigned = (data: any) => {
      if (data.caseId === caseId) {
        if (data.etaMinutes) setEtaMinutes(data.etaMinutes);
        if (data.ambulance?.currentLatitude && data.ambulance?.currentLongitude) {
          setAmbulanceGps({
            lat: data.ambulance.currentLatitude,
            lng: data.ambulance.currentLongitude,
            lastUpdate: new Date().toISOString(),
          });
        }
        // Refresh full case details
        api.getCaseById(caseId).then((res) => setCaseData(res.case));
      }
    };

    const handleGpsUpdate = (data: any) => {
      if (data.caseId === caseId || (caseData?.allocations?.[0]?.ambulance?.id === data.ambulanceId)) {
        setAmbulanceGps({
          lat: data.latitude,
          lng: data.longitude,
          lastUpdate: data.deviceTimestamp,
        });
      }
    };

    const handleHospitalResponse = (data: any) => {
      if (data.caseId === caseId) {
        api.getCaseById(caseId).then((res) => setCaseData(res.case));
      }
    };

    socket.on('emergency:status_change', handleStatusChange);
    socket.on('emergency:assigned', handleAssigned);
    socket.on('tracking:update', handleGpsUpdate);
    socket.on('hospital:response', handleHospitalResponse);

    return () => {
      socket.off('emergency:status_change', handleStatusChange);
      socket.off('emergency:assigned', handleAssigned);
      socket.off('tracking:update', handleGpsUpdate);
      socket.off('hospital:response', handleHospitalResponse);
    };
  }, [socket, caseId, caseData]);

  if (isLoading || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Siren className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-sm">Connecting to secure dispatch telemetry...</p>
      </div>
    );
  }

  const activeAlloc = caseData.allocations?.[0];
  const assignedVehicle = activeAlloc?.ambulance;
  const crewMember = assignedVehicle?.crewAssignments?.[0]?.user;
  const acceptedCoordination = caseData.coordinations?.find((c) => c.status === 'ACCEPTED');

  // Build map markers
  const markers: any[] = [
    {
      id: 'pickup',
      lat: caseData.pickupLatitude,
      lng: caseData.pickupLongitude,
      title: 'Emergency Scene (You)',
      type: 'PICKUP',
      details: caseData.pickupAddress,
    },
  ];

  if (ambulanceGps) {
    markers.push({
      id: 'ambulance',
      lat: ambulanceGps.lat,
      lng: ambulanceGps.lng,
      title: assignedVehicle?.callSign || 'Assigned Ambulance',
      type: 'AMBULANCE',
      details: `Live GPS Position • Unit ${assignedVehicle?.callSign || ''}`,
    });
  }

  if (acceptedCoordination?.hospital) {
    markers.push({
      id: 'hospital',
      lat: acceptedCoordination.hospital.latitude,
      lng: acceptedCoordination.hospital.longitude,
      title: acceptedCoordination.hospital.name,
      type: 'HOSPITAL',
      details: `Destination Trauma Center • ${acceptedCoordination.hospital.address}`,
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          {onBackToIntake && (
            <button
              onClick={onBackToIntake}
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mb-2 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Intake
            </button>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white font-mono">{caseData.caseNumber}</h1>
            <PriorityBadge priority={caseData.triagePriority} />
            <CaseStatusBadge status={caseData.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pickup: <span className="text-slate-200">{caseData.pickupAddress}</span>
          </p>
        </div>

        {/* ETA Widget */}
        <div className="bg-navy-950 px-5 py-3 rounded-xl border border-navy-800 text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Estimated Unit Arrival</p>
          <div className="flex items-baseline justify-end gap-1 text-cyan-400">
            <span className="text-3xl font-black font-mono">{etaMinutes ?? (assignedVehicle ? '5-8' : '--')}</span>
            <span className="text-sm font-bold">MINS</span>
          </div>
          <p className="text-[10px] text-slate-400">OSRM traffic-aware routing</p>
        </div>
      </div>

      {/* Main Grid: Live Map + Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Panel (2 Cols) */}
        <div className="lg:col-span-2 min-h-[420px] rounded-2xl overflow-hidden border border-navy-700 shadow-2xl relative">
          <EmergencyMap
            center={[caseData.pickupLatitude, caseData.pickupLongitude]}
            zoom={14}
            markers={markers}
            className="w-full h-full min-h-[420px]"
          />
          {ambulanceGps && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-navy-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/30 text-xs text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Live Vehicle Telemetry: {new Date(ambulanceGps.lastUpdate).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Response Unit & Hospital Coordination Card (1 Col) */}
        <div className="space-y-4">
          {/* Assigned Ambulance Card */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-navy-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dispatched Unit</span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {assignedVehicle ? assignedVehicle.callSign : 'Allocating...'}
              </span>
            </div>

            {assignedVehicle ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Unit Type:</span>
                  <span className="font-bold text-white px-2 py-0.5 rounded bg-navy-950 border border-navy-800">
                    {assignedVehicle.type} AMBULANCE
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Vehicle Reg:</span>
                  <span className="font-mono text-slate-300">{assignedVehicle.registrationNumber}</span>
                </div>
                {crewMember && (
                  <div className="pt-2 border-t border-navy-800/80">
                    <p className="text-[11px] text-slate-400">Lead Paramedic:</p>
                    <p className="text-sm font-semibold text-white">{crewMember.fullName}</p>
                    {crewMember.phone && (
                      <a
                        href={`tel:${crewMember.phone}`}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 border border-cyan-500/30 transition-colors w-full justify-center"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call Paramedic
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                <Siren className="w-6 h-6 text-orange-400 animate-spin mx-auto mb-2" />
                <span>Running atomic concurrent allocation engine...</span>
              </div>
            )}
          </div>

          {/* Coordinated Hospital Card */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-navy-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hospital Coordination</span>
              <Hospital className="w-4 h-4 text-emerald-400" />
            </div>

            {acceptedCoordination?.hospital ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <h4 className="text-sm font-bold text-white">{acceptedCoordination.hospital.name}</h4>
                </div>
                <p className="text-xs text-slate-400">{acceptedCoordination.hospital.address}</p>
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-xs text-emerald-300">
                  Confirmed: Emergency bay prepped & trauma staff standing by.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Hospital discovery active. Nearest verified trauma centers being evaluated for capacity and ETA.
              </p>
            )}
          </div>

          {/* Operational Timeline Progress */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 shadow-lg">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Operational Milestones</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Emergency intake validated & logged</span>
              </div>
              <div className={`flex items-center gap-2 ${assignedVehicle ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Unit dispatched ({assignedVehicle?.callSign || 'Pending'})</span>
              </div>
              <div className={`flex items-center gap-2 ${caseData.status === 'AT_SCENE' || caseData.status === 'TRANSPORTING' ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Arrived at emergency scene</span>
              </div>
              <div className={`flex items-center gap-2 ${caseData.status === 'HANDED_OVER' ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Hospital handover completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
