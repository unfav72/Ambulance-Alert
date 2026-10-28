import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { EmergencyController } from '../controllers/emergency.controller.js';
import { AmbulanceController } from '../controllers/ambulance.controller.js';
import { HospitalController } from '../controllers/hospital.controller.js';
import { TrackingController } from '../controllers/tracking.controller.js';
import { AdminController } from '../controllers/admin.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  authLimiter,
  emergencyIntakeLimiter,
  telemetryLimiter,
} from '../middleware/rateLimiter.middleware.js';

import {
  registerSchema,
  loginSchema,
  createInvitationSchema,
  acceptInvitationSchema,
} from '../schemas/auth.schema.js';
import {
  createEmergencySchema,
  updateEmergencyStatusSchema,
  manualAllocationSchema,
  patientHandoverSchema,
} from '../schemas/emergency.schema.js';
import {
  createAmbulanceSchema,
  updateAmbulanceStatusSchema,
  assignCrewShiftSchema,
} from '../schemas/ambulance.schema.js';
import {
  createHospitalSchema,
  updateCapacitySchema,
  respondCoordinationSchema,
} from '../schemas/hospital.schema.js';
import { locationUpdateSchema } from '../schemas/tracking.schema.js';

const router = Router();

// ==========================================
// Authentication & Identity Routes
// ==========================================
router.post(
  '/auth/register',
  authLimiter,
  validate(registerSchema),
  AuthController.register
);

router.post(
  '/auth/login',
  authLimiter,
  validate(loginSchema),
  AuthController.login
);

router.get('/auth/me', authenticate, AuthController.getMe);

router.post(
  '/auth/invitations',
  authenticate,
  requireRoles('SYSTEM_ADMIN', 'DISPATCHER'),
  validate(createInvitationSchema),
  AuthController.createInvitation
);

router.post(
  '/auth/invitations/accept',
  validate(acceptInvitationSchema),
  AuthController.acceptInvitation
);

// ==========================================
// Emergency Case Management Routes
// ==========================================
// Public or authenticated intake
router.post(
  '/emergencies',
  emergencyIntakeLimiter,
  // Optional auth middleware so authenticated patients attach their userId
  (req, res, next) => {
    if (req.headers.authorization) {
      return authenticate(req, res, next);
    }
    next();
  },
  validate(createEmergencySchema),
  EmergencyController.createEmergency
);

router.get('/emergencies', authenticate, EmergencyController.getCases);
router.get('/emergencies/:id', authenticate, EmergencyController.getCaseById);
router.get('/emergencies/track/:caseNumber', EmergencyController.trackByCaseNumber);

router.patch(
  '/emergencies/:id/status',
  authenticate,
  requireRoles('AMBULANCE_CREW', 'DISPATCHER', 'SYSTEM_ADMIN'),
  validate(updateEmergencyStatusSchema),
  EmergencyController.updateStatus
);

router.post(
  '/emergencies/:id/allocate-manual',
  authenticate,
  requireRoles('DISPATCHER', 'SYSTEM_ADMIN'),
  validate(manualAllocationSchema),
  EmergencyController.manualAllocate
);

router.post(
  '/emergencies/:id/handover',
  authenticate,
  requireRoles('AMBULANCE_CREW', 'HOSPITAL_STAFF', 'DISPATCHER', 'SYSTEM_ADMIN'),
  validate(patientHandoverSchema),
  EmergencyController.submitHandover
);

// ==========================================
// Ambulance Fleet & Crew Shift Routes
// ==========================================
router.get('/ambulances', authenticate, AmbulanceController.getAmbulances);
router.get('/ambulances/:id', authenticate, AmbulanceController.getAmbulanceById);

router.post(
  '/ambulances',
  authenticate,
  requireRoles('SYSTEM_ADMIN', 'DISPATCHER'),
  validate(createAmbulanceSchema),
  AmbulanceController.createAmbulance
);

router.patch(
  '/ambulances/:id/status',
  authenticate,
  requireRoles('AMBULANCE_CREW', 'DISPATCHER', 'SYSTEM_ADMIN'),
  validate(updateAmbulanceStatusSchema),
  AmbulanceController.updateStatus
);

router.post(
  '/ambulances/shifts',
  authenticate,
  requireRoles('DISPATCHER', 'SYSTEM_ADMIN'),
  validate(assignCrewShiftSchema),
  AmbulanceController.assignCrewShift
);

router.post(
  '/ambulances/:id/shifts/end',
  authenticate,
  requireRoles('AMBULANCE_CREW', 'DISPATCHER', 'SYSTEM_ADMIN'),
  AmbulanceController.endShift
);

// ==========================================
// Hospital Facility & Capacity Routes
// ==========================================
router.get('/hospitals', HospitalController.getHospitals);
router.get('/hospitals/:id', HospitalController.getHospitalById);

router.post(
  '/hospitals',
  authenticate,
  requireRoles('SYSTEM_ADMIN'),
  validate(createHospitalSchema),
  HospitalController.createHospital
);

router.put(
  '/hospitals/:hospitalId/capacity',
  authenticate,
  requireRoles('HOSPITAL_STAFF', 'SYSTEM_ADMIN'),
  validate(updateCapacitySchema),
  HospitalController.updateCapacity
);

router.post(
  '/hospitals/coordination/:caseId/:hospitalId/respond',
  authenticate,
  requireRoles('HOSPITAL_STAFF', 'DISPATCHER', 'SYSTEM_ADMIN'),
  validate(respondCoordinationSchema),
  HospitalController.respondCoordination
);

// ==========================================
// GPS Telemetry & Routing Service Routes
// ==========================================
router.post(
  '/tracking/location',
  authenticate,
  telemetryLimiter,
  requireRoles('AMBULANCE_CREW', 'DISPATCHER', 'SYSTEM_ADMIN'),
  validate(locationUpdateSchema),
  TrackingController.postLocationUpdate
);

router.get(
  '/tracking/history/:ambulanceId',
  authenticate,
  requireRoles('AMBULANCE_CREW', 'DISPATCHER', 'SYSTEM_ADMIN'),
  TrackingController.getLocationHistory
);

router.get('/tracking/routing-status', TrackingController.getRoutingStatus);

// ==========================================
// System Administration & Health Routes
// ==========================================
router.get(
  '/admin/audit-logs',
  authenticate,
  requireRoles('SYSTEM_ADMIN', 'DISPATCHER'),
  AdminController.getAuditLogs
);

router.get(
  '/admin/users',
  authenticate,
  requireRoles('SYSTEM_ADMIN'),
  AdminController.getUsers
);

router.patch(
  '/admin/users/:id/status',
  authenticate,
  requireRoles('SYSTEM_ADMIN'),
  AdminController.updateUserStatus
);

router.get('/admin/system-health', AdminController.getSystemHealth);

export default router;
