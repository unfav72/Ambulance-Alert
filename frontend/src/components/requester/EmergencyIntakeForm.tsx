import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { TriagePriority } from '../../types/index.js';
import { MapPin, AlertCircle, Phone, User, Clock, CheckCircle, Navigation, Loader2, Mail } from 'lucide-react';

interface EmergencyIntakeFormProps {
  onCaseCreated: (createdCase: any) => void;
}

export const EmergencyIntakeForm: React.FC<EmergencyIntakeFormProps> = ({ onCaseCreated }) => {
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(13.0827);
  const [pickupLng, setPickupLng] = useState<number | null>(80.2707);
  const [triagePriority, setTriagePriority] = useState<TriagePriority>('CRITICAL_P1');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<string>('UNKNOWN');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Acquire current GPS location from browser
  const handleAcquireLocation = () => {
    if (!('geolocation' in navigator)) {
      setErrorMessage('Geolocation API is not available on this device.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(pos.coords.latitude);
        setPickupLng(pos.coords.longitude);
        setIsLocating(false);
        if (!pickupAddress) {
          setPickupAddress(`GPS Coordinates: [${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}]`);
        }
      },
      (err) => {
        setIsLocating(false);
        setErrorMessage(`Location request failed: ${err.message}. Please enter address manually.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!requesterName.trim() || !requesterPhone.trim() || !pickupAddress.trim() || !chiefComplaint.trim()) {
      setErrorMessage('Please fill in all required emergency fields (Name, Phone, Address, and Emergency details).');
      return;
    }

    if (pickupLat === null || pickupLng === null) {
      setErrorMessage('Valid pickup location coordinates are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate client-side RFC4122 v4 UUID idempotency key to prevent double dispatch on network timeout
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      const idempotencyKey = generateUUID();

      const payload = {
        requesterName: requesterName.trim(),
        requesterPhone: requesterPhone.trim(),
        requesterEmail: requesterEmail.trim() || undefined,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        pickupAddress: pickupAddress.trim(),
        triagePriority,
        chiefComplaint: chiefComplaint.trim(),
        patientAge: patientAge ? parseInt(patientAge, 10) : undefined,
        patientGender: patientGender || undefined,
        idempotencyKey,
      };

      const result = await api.createEmergency(payload);
      onCaseCreated(result.case);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit emergency dispatch request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl">
      {/* Header Banner */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-navy-800">
        <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-700/80 flex items-center justify-center text-red-400">
          <AlertCircle className="w-7 h-7 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-white">Emergency Assistance Request</h2>
          <p className="text-xs text-slate-400">Direct connection to nearest available ambulance & verified hospital trauma center</p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/70 border border-red-700 text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Triage Priority Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Emergency Urgency Classification *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTriagePriority('CRITICAL_P1')}
              className={`p-3 rounded-xl border text-left transition-all ${
                triagePriority === 'CRITICAL_P1'
                  ? 'bg-red-950/80 border-red-500 shadow-lg shadow-red-950/50 text-white'
                  : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-red-400">CRITICAL (Priority 1)</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">Immediate</span>
              </div>
              <p className="text-xs text-slate-400">Unconscious, Cardiac Arrest, Severe Trauma, Heavy Bleeding</p>
            </button>

            <button
              type="button"
              onClick={() => setTriagePriority('URGENT_P2')}
              className={`p-3 rounded-xl border text-left transition-all ${
                triagePriority === 'URGENT_P2'
                  ? 'bg-orange-950/80 border-orange-500 shadow-lg shadow-orange-950/50 text-white'
                  : 'bg-navy-950/60 border-navy-800 hover:border-navy-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-orange-400">URGENT (Priority 2)</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300">&lt; 15 Mins</span>
              </div>
              <p className="text-xs text-slate-400">Chest Pain, Stroke Signs, Severe Asthmatic Attack, Major Fracture</p>
            </button>
          </div>
        </div>

        {/* Requester Contact Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contact / Caller Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Callback Phone *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                required
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email (Brevo Tracking)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Pickup Location & Landmark *
            </label>
            <button
              type="button"
              onClick={handleAcquireLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-lg transition-colors"
            >
              {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current GPS'}</span>
            </button>
          </div>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Building name, street, nearby landmark..."
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          {pickupLat && pickupLng && (
            <p className="mt-1 text-[11px] font-mono text-cyan-500">
              GPS Verified: Lat {pickupLat.toFixed(5)}, Lng {pickupLng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Chief Complaint Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Patient Condition & Symptoms *
          </label>
          <textarea
            required
            rows={3}
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Describe what happened, patient consciousness, breathing status, visible injuries..."
            className="w-full bg-navy-950 border border-navy-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Patient Age & Gender */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Approx. Age</label>
            <input
              type="number"
              min="0"
              max="125"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="e.g. 52"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender</label>
            <select
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="UNKNOWN">Unspecified / Unknown</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Submission Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 via-emergency-orange to-red-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-base tracking-wide uppercase transition-all shadow-xl shadow-red-950/60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Dispatching Concurrent Allocation Engine...</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5" />
              <span>Dispatch Emergency Response Now</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
