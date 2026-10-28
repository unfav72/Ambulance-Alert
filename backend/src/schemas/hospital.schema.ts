import { z } from 'zod';

export const updateCapacitySchema = z.object({
  params: z.object({
    hospitalId: z.string().uuid(),
  }),
  body: z.object({
    totalBeds: z.number().int().min(0),
    availableBeds: z.number().int().min(0),
    icuBedsTotal: z.number().int().min(0),
    icuBedsAvailable: z.number().int().min(0),
    oxygenAvailable: z.boolean(),
    ventilatorAvailable: z.boolean(),
  }).refine((data) => data.availableBeds <= data.totalBeds, {
    message: 'Available beds cannot exceed total beds',
    path: ['availableBeds'],
  }).refine((data) => data.icuBedsAvailable <= data.icuBedsTotal, {
    message: 'Available ICU beds cannot exceed total ICU beds',
    path: ['icuBedsAvailable'],
  }),
});

export const respondCoordinationSchema = z.object({
  params: z.object({
    caseId: z.string().uuid(),
    hospitalId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['ACCEPTED', 'DECLINED', 'REDIRECTED']),
    bedsReserved: z.number().int().min(0).default(1),
    responseReason: z.string().min(3, 'Clinical acceptance/decline reason is required').max(500),
  }),
});

export const createHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(150),
    address: z.string().min(5).max(300),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    contactPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
    traumaLevel: z.number().int().min(1).max(4).optional(),
    verified: z.boolean().default(false),
  }),
});
