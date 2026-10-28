import { z } from 'zod';

export const createAmbulanceSchema = z.object({
  body: z.object({
    registrationNumber: z.string().min(3).max(20).toUpperCase(),
    callSign: z.string().min(2).max(30),
    type: z.enum(['BASIC', 'ADVANCED', 'ICU', 'NEONATAL']).default('BASIC'),
    equipmentList: z.array(z.string()).default([]),
  }),
});

export const updateAmbulanceStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum([
      'AVAILABLE',
      'DISPATCHED',
      'EN_ROUTE_SCENE',
      'AT_SCENE',
      'EN_ROUTE_HOSPITAL',
      'AT_HOSPITAL',
      'MAINTENANCE',
      'OFFLINE',
    ]),
  }),
});

export const assignCrewShiftSchema = z.object({
  body: z.object({
    ambulanceId: z.string().uuid(),
    userId: z.string().uuid(),
    roleOnCrew: z.enum(['PARAMEDIC', 'DRIVER', 'EMT']),
  }),
});
