export type UserRole =
  | 'PATIENT_REQUESTER'
  | 'AMBULANCE_CREW'
  | 'HOSPITAL_STAFF'
  | 'DISPATCHER'
  | 'SYSTEM_ADMIN';

export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'REVOKED';

export type AmbulanceType = 'BASIC' | 'ADVANCED' | 'ICU' | 'NEONATAL';

export type AmbulanceStatus =
  | 'AVAILABLE'
  | 'DISPATCHED'
  | 'EN_ROUTE_SCENE'
  | 'AT_SCENE'
  | 'EN_ROUTE_HOSPITAL'
  | 'AT_HOSPITAL'
  | 'MAINTENANCE'
  | 'OFFLINE';

export type TriagePriority = 'CRITICAL_P1' | 'URGENT_P2' | 'STANDARD_P3' | 'NON_URGENT_P4';

export type CaseStatus =
  | 'PENDING'
  | 'ALLOCATING'
  | 'ASSIGNED'
  | 'CREW_EN_ROUTE'
  | 'AT_SCENE'
  | 'TRANSPORTING'
  | 'ARRIVED_HOSPITAL'
  | 'HANDED_OVER'
  | 'CANCELLED'
  | 'ESCALATED';

export type HospitalCoordinationStatus =
  | 'RECOMMENDED'
  | 'CONTACTED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REDIRECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface Ambulance {
  id: string;
  registrationNumber: string;
  callSign: string;
  type: AmbulanceType;
  equipmentList: string[];
  status: AmbulanceStatus;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastGpsUpdate?: string | null;
  isTrackingActive?: boolean;
  crewAssignments?: {
    id: string;
    user: {
      id: string;
      fullName: string;
      phone?: string | null;
      role: string;
    };
    roleOnCrew: string;
    status: string;
  }[];
}

export interface EmergencyCase {
  id: string;
  caseNumber: string;
  requesterName: string;
  requesterPhone: string;
  requesterUserId?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  triagePriority: TriagePriority;
  chiefComplaint: string;
  patientAge?: number | null;
  patientGender?: string | null;
  status: CaseStatus;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  allocations?: {
    id: string;
    status: string;
    assignedAt: string;
    arrivedSceneAt?: string | null;
    departedSceneAt?: string | null;
    arrivedHospitalAt?: string | null;
    handoverAt?: string | null;
    ambulance: Ambulance;
  }[];
  coordinations?: {
    id: string;
    status: HospitalCoordinationStatus;
    distanceMeters?: number | null;
    etaSeconds?: number | null;
    responseReason?: string | null;
    respondedAt?: string | null;
    hospital: Organization;
  }[];
  handover?: PatientHandover | null;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  traumaLevel?: number | null;
  verified: boolean;
  hospitalCapacity?: HospitalCapacity | null;
}

export interface HospitalCapacity {
  id: string;
  organizationId: string;
  totalBeds: number;
  availableBeds: number;
  icuBedsTotal: number;
  icuBedsAvailable: number;
  oxygenAvailable: boolean;
  ventilatorAvailable: boolean;
  updatedAt: string;
  lastUpdatedBy?: {
    fullName: string;
  } | null;
}

export interface PatientHandover {
  id: string;
  caseId: string;
  hospitalId: string;
  receivingDoctorName: string;
  receivingNurseName?: string | null;
  vitalsSummary: string;
  handoverNotes: string;
  completedAt: string;
}

export interface RoutingStatus {
  provider: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastChecked: string;
  endpoint: string;
  lastError?: string;
}
