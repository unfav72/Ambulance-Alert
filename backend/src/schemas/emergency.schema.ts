import { z } from 'zod';

export const createEmergencySchema = z.object({
  body: z.object({
    requesterName: z.string().min(2, 'Requester name is required').max(100),
    requesterPhone: z
      .string()
      .transform((val) => val.replace(/[\s\-\(\)]/g, ''))
      .pipe(z.string().min(7, 'Valid phone number is required for emergency dispatch').max(18)),
    requesterEmail: z.string().email().optional().or(z.literal('')),
    pickupLatitude: z.number().min(-90).max(90),
    pickupLongitude: z.number().min(-180).max(180),
    pickupAddress: z.string().min(3, 'Physical pickup address or landmark is required'),
    triagePriority: z.enum(['CRITICAL_P1', 'URGENT_P2', 'STANDARD_P3', 'NON_URGENT_P4']).default('URGENT_P2'),
    chiefComplaint: z.string().min(2, 'Description of emergency is required').max(500),
    patientAge: z.number().int().min(0).max(130).optional(),
    patientGender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
    notes: z.string().max(1000).optional(),
    idempotencyKey: z.string().uuid().optional(),
  }),
});

export const updateEmergencyStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum([
      'PENDING',
      'ALLOCATING',
      'ASSIGNED',
      'CREW_EN_ROUTE',
      'AT_SCENE',
      'TRANSPORTING',
      'ARRIVED_HOSPITAL',
      'HANDED_OVER',
      'CANCELLED',
      'ESCALATED',
    ]),
    notes: z.string().max(500).optional(),
  }),
});

export const manualAllocationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    ambulanceId: z.string().uuid('Valid ambulance ID is required'),
    reason: z.string().min(5, 'Dispatch override reason is required for auditability'),
  }),
});

export const patientHandoverSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    hospitalId: z.string().uuid(),
    receivingDoctorName: z.string().min(2),
    receivingNurseName: z.string().optional(),
    vitalsSummary: z.string().min(5, 'Vitals summary is required (BP, Pulse, SpO2, GCS)'),
    handoverNotes: z.string().min(5, 'Clinical handover narrative is required'),
  }),
});
