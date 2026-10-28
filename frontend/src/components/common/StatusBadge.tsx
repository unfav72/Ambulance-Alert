import React from 'react';
import { TriagePriority, CaseStatus, AmbulanceStatus } from '../../types/index.js';

export const PriorityBadge: React.FC<{ priority: TriagePriority }> = ({ priority }) => {
  switch (priority) {
    case 'CRITICAL_P1':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-950/80 text-red-400 border border-red-700/60 shadow-sm animate-pulse-fast">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          CRITICAL P1
        </span>
      );
    case 'URGENT_P2':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-950/80 text-orange-400 border border-orange-700/60 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          URGENT P2
        </span>
      );
    case 'STANDARD_P3':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          STANDARD P3
        </span>
      );
    case 'NON_URGENT_P4':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          NON-URGENT P4
        </span>
      );
  }
};

export const CaseStatusBadge: React.FC<{ status: CaseStatus }> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-950/60 text-amber-400 border-amber-700/50';
      case 'ALLOCATING':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-600/60 animate-pulse';
      case 'ASSIGNED':
      case 'CREW_EN_ROUTE':
        return 'bg-blue-950/80 text-blue-400 border-blue-600/60';
      case 'AT_SCENE':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/60';
      case 'TRANSPORTING':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-600/60';
      case 'ARRIVED_HOSPITAL':
      case 'HANDED_OVER':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60';
      case 'CANCELLED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'ESCALATED':
        return 'bg-red-950/90 text-red-300 border-red-600 font-bold animate-pulse-fast';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'PENDING': return 'PENDING ALLOCATION';
      case 'ALLOCATING': return 'CONCURRENT ALLOCATING';
      case 'ASSIGNED': return 'UNIT ASSIGNED';
      case 'CREW_EN_ROUTE': return 'CREW EN ROUTE';
      case 'AT_SCENE': return 'AT SCENE';
      case 'TRANSPORTING': return 'TRANSPORTING TO HOSPITAL';
      case 'ARRIVED_HOSPITAL': return 'ARRIVED AT HOSPITAL';
      case 'HANDED_OVER': return 'PATIENT HANDOVER COMPLETE';
      case 'CANCELLED': return 'CASE CANCELLED';
      case 'ESCALATED': return 'ESCALATED TO DISPATCH';
      default: return status;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle()}`}>
      {getLabel()}
    </span>
  );
};

export const VehicleStatusBadge: React.FC<{ status: AmbulanceStatus }> = ({ status }) => {
  switch (status) {
    case 'AVAILABLE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          AVAILABLE
        </span>
      );
    case 'DISPATCHED':
    case 'EN_ROUTE_SCENE':
    case 'AT_SCENE':
    case 'EN_ROUTE_HOSPITAL':
    case 'AT_HOSPITAL':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-600/60">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          ON MISSION ({status.replace(/_/g, ' ')})
        </span>
      );
    case 'MAINTENANCE':
    case 'OFFLINE':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          {status}
        </span>
      );
  }
};
