import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { useGeolocation } from '../../hooks/useGeolocation.js';
import { PriorityBadge, CaseStatusBadge } from '../common/StatusBadge.js';
import { EmergencyCase, Ambulance } from '../../types/index.js';
import {
  Navigation,
  Radio,
  Phone,
  CheckCircle,
  AlertTriangle,
  FileText,
  MapPin,
  Clock,
  Shield,
  Siren,
  Hospital,
  Activity,
  User,
} from 'lucide-react';

export const CrewMdtDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [assignedAmbulance, setAssignedAmbulance] = useState<Ambulance | null>(null);
  const [activeCase, setActiveCase] = useState<EmergencyCase | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [nurseName, setNurseName] = useState('');
  const [vitalsSummary, setVitalsSummary] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  // Hook for real GPS telemetry
  const {
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    timestamp,
    status: trackingStatus,
    errorMessage: gpsError,
    isBackgroundRestricted,
    startTracking,
    stopTracking,
    isTracking,
  } = useGeolocation();

  // Load crew's assigned vehicle, active case, and hospitals
  const loadCrewData = async () => {
    try {
      const [ambRes, casesRes, hospRes] = await Promise.all([
        api.getAmbulances(),
        api.getCases(),
        api.getHospitals().catch(() => ({ hospitals: [] })),
      ]);

      const availableHospitals = hospRes.hospitals || [];
      setHospitals(availableHospitals);

      // Find ambulance where this crew member has an active shift
      const myVehicle = ambRes.ambulances?.find((a: Ambulance) =>
        a.crewAssignments?.some((s) => s.user.id === user?.id && s.status === 'ACTIVE')
      ) || ambRes.ambulances?.[0]; // Fallback to first vehicle for demo testing

      if (myVehicle) {
        setAssignedAmbulance(myVehicle);
        // Find if this vehicle has an active case allocation (excluding already handed over or cancelled cases)
        const curCase = casesRes.cases?.find((c: EmergencyCase) =>
          c.status !== 'HANDED_OVER' &&
          c.status !== 'CANCELLED' &&
          c.allocations?.some((alloc) => alloc.ambulance.id === myVehicle.id && alloc.status !== 'COMPLETED')
        );
        setActiveCase(curCase || null);

        // Pre-select coordinated hospital or first available hospital
        if (curCase?.coordinations?.[0]?.hospital?.id) {
          setSelectedHospitalId(curCase.coordinations[0].hospital.id);
        } else if (availableHospitals[0]?.id) {
          setSelectedHospitalId(availableHospitals[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load crew MDT data', err);
    }
  };

  useEffect(() => {
    loadCrewData();
  }, [user]);

  // Transmit real GPS coordinates to backend when location updates
  useEffect(() => {
    if (!isTracking || !latitude || !longitude || !assignedAmbulance) return;

    const transmitTelemetry = async () => {
      try {
        await api.postLocation({
          ambulanceId: assignedAmbulance.id,
          latitude,
          longitude,
          accuracyMeters: accuracy || 10,
          speed: speed ?? undefined,
          heading: heading ?? undefined,
          deviceTimestamp: timestamp || new Date().toISOString(),
        });
      } catch (err) {
        console.warn('GPS telemetry upload failed', err);
      }
    };

    transmitTelemetry();
  }, [latitude, longitude, isTracking, assignedAmbulance, accuracy, speed, heading, timestamp]);

  // Milestone progression handlers
  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeCase) return;
    try {
      await api.updateCaseStatus(activeCase.id, newStatus);
      setActiveCase((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      loadCrewData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Submit clinical patient handover
  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !doctorName.trim() || !vitalsSummary.trim() || !handoverNotes.trim()) return;

    setIsSubmittingHandover(true);
    try {
      // Determine receiving hospital ID
      const hospitalId = selectedHospitalId || activeCase.coordinations?.[0]?.hospital?.id || hospitals[0]?.id;

      if (!hospitalId) {
        alert('Please select a valid receiving hospital.');
        setIsSubmittingHandover(false);
        return;
      }

      await api.submitHandover(activeCase.id, {
        hospitalId,
        receivingDoctorName: doctorName.trim(),
        receivingNurseName: nurseName.trim() || undefined,
        vitalsSummary: vitalsSummary.trim(),
        handoverNotes: handoverNotes.trim(),
      });

      // Clear form inputs and close modal
      setDoctorName('');
      setNurseName('');
      setVitalsSummary('');
      setHandoverNotes('');
      setIsHandoverModalOpen(false);
      setActiveCase(null);

      alert('✅ Patient handover signed and archived successfully! Unit is now available.');
      await loadCrewData();
    } catch (err: any) {
      alert(`Handover submission failed: ${err.message}`);
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unit Status & GPS Telemetry Control Bar */}
      <div className="bg-navy-900 border border-navy-700 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-600/80 flex items-center justify-center text-cyan-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white font-mono">
                {assignedAmbulance ? assignedAmbulance.callSign : 'MDT Disconnected'}
              </h2>
              {assignedAmbulance && (
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  {assignedAmbulance.type}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Paramedic Crew Member: <span className="text-slate-200 font-semibold">{user?.fullName || 'Active Crew'}</span>
            </p>
          </div>
        </div>

        {/* GPS Watcher Toggle */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  trackingStatus === 'LIVE'
                    ? 'bg-emerald-400 animate-ping'
                    : trackingStatus === 'STALE'
                    ? 'bg-amber-400'
                    : trackingStatus === 'PERMISSION_DENIED'
                    ? 'bg-red-500'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-xs font-mono font-bold text-slate-200">
                GPS: {trackingStatus}
              </span>
            </div>
            {accuracy !== null && (
              <p className="text-[10px] font-mono text-cyan-400">Accuracy: ±{accuracy}m • Speed: {speed ?? 0} km/h</p>
            )}
          </div>

          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              isTracking
                ? 'bg-red-950 hover:bg-red-900 text-red-300 border border-red-700'
                : 'bg-cyan-500 hover:bg-cyan-400 text-navy-950'
            }`}
          >
            {isTracking ? 'Stop GPS Broadcast' : 'Start GPS Broadcast'}
          </button>
        </div>
      </div>

      {/* Critical PWA Background Notice */}
      {isBackgroundRestricted && (
        <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-700 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong>Browser Background Restriction Notice:</strong> The application is currently running in background or screen is locked.
            Web browsers on Android/iOS restrict or throttle `navigator.geolocation` background execution. Keep MDT screen active during transport to maintain continuous live telemetry.
          </div>
        </div>
      )}

      {/* Active Incident Run Sheet */}
      {activeCase ? (
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-navy-800">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Incident</span>
                <span className="text-xl font-black text-white font-mono">{activeCase.caseNumber}</span>
                <PriorityBadge priority={activeCase.triagePriority} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Logged at {new Date(activeCase.createdAt).toLocaleTimeString()}</p>
            </div>
            <CaseStatusBadge status={activeCase.status} />
          </div>

          {/* Patient Details & Pickup Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-400" /> Pickup Location
              </h4>
              <p className="text-sm font-semibold text-white">{activeCase.pickupAddress}</p>
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeCase.pickupLatitude},${activeCase.pickupLongitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 border border-cyan-500/30 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" /> Launch Turn-by-Turn Navigation
                </a>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" /> Patient & Caller Info
              </h4>
              <p className="text-sm font-semibold text-white">{activeCase.requesterName}</p>
              <p className="text-xs text-slate-400">
                Chief Complaint: <span className="text-slate-200">{activeCase.chiefComplaint}</span>
              </p>
              <div className="pt-2">
                <a
                  href={`tel:${activeCase.requesterPhone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-800 text-slate-200 hover:bg-navy-700 border border-navy-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Call {activeCase.requesterPhone}
                </a>
              </div>
            </div>
          </div>

          {/* MDT One-Touch Milestone Progression Controls */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Operational Status Milestones
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => handleUpdateStatus('CREW_EN_ROUTE')}
                className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                  activeCase.status === 'CREW_EN_ROUTE'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                    : 'bg-navy-950 border-navy-800 text-slate-300 hover:border-blue-600'
                }`}
              >
                1. En Route Scene
              </button>

              <button
                onClick={() => handleUpdateStatus('AT_SCENE')}
                className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                  activeCase.status === 'AT_SCENE'
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                    : 'bg-navy-950 border-navy-800 text-slate-300 hover:border-purple-600'
                }`}
              >
                2. At Scene
              </button>

              <button
                onClick={() => handleUpdateStatus('TRANSPORTING')}
                className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                  activeCase.status === 'TRANSPORTING'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-navy-950 border-navy-800 text-slate-300 hover:border-indigo-600'
                }`}
              >
                3. Transporting
              </button>

              <button
                onClick={() => setIsHandoverModalOpen(true)}
                className="py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border bg-emerald-700 hover:bg-emerald-600 border-emerald-500 text-white shadow-lg transition-all"
              >
                4. Patient Handover
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-navy-900 border border-navy-700 rounded-2xl p-12 text-center shadow-xl space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-white">No Active Emergency Run Assigned</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Unit {assignedAmbulance?.callSign || 'MEDIC'} is currently available in the system pool. Telemetry will automatically broadcast when an emergency is allocated.
            </p>
          </div>
        </div>
      )}

      {/* Clinical Handover Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Clinical Patient Handover</h3>
            <p className="text-xs text-slate-400 mb-4">
              Record formal transfer of care to hospital medical team. This will close the incident run sheet and return vehicle to available status.
            </p>

            <form onSubmit={handleSubmitHandover} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Receiving Hospital Facility *
                </label>
                <select
                  required
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.traumaLevel ? `(${h.traumaLevel})` : ''}
                    </option>
                  ))}
                  {hospitals.length === 0 && (
                    <option value="">No hospital facilities loaded</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Receiving Doctor Name *</label>
                  <input
                    type="text"
                    required
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Dr. S. Sundaram"
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Receiving Nurse Name</label>
                  <input
                    type="text"
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    placeholder="Nurse Priya"
                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vitals Summary (BP, HR, SpO2, GCS) *</label>
                <input
                  type="text"
                  required
                  value={vitalsSummary}
                  onChange={(e) => setVitalsSummary(e.target.value)}
                  placeholder="BP 130/85, HR 88, SpO2 97%, GCS 15/15"
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Clinical Handover Narrative *</label>
                <textarea
                  required
                  rows={3}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Patient received oxygen therapy 4L/min, IV access secured, pain reduced..."
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-navy-800 text-slate-300 hover:bg-navy-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHandover}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSubmittingHandover ? 'Completing...' : 'Sign Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
