import { describe, it, expect } from 'vitest';
import { updateCapacitySchema, respondCoordinationSchema } from '../src/schemas/hospital.schema.js';

describe('Hospital Coordination & Bed Capacity Validation Tests', () => {
  const hospitalUuid = '222e4567-e89b-12d3-a456-426614174000';
  const caseUuid = '333e4567-e89b-12d3-a456-426614174000';

  it('should validate capacity schema: reject when available beds exceed total beds', () => {
    const invalidCapacity = updateCapacitySchema.safeParse({
      params: { hospitalId: hospitalUuid },
      body: {
        totalBeds: 50,
        availableBeds: 60, // Invalid: exceeds total beds
        icuBedsTotal: 10,
        icuBedsAvailable: 4,
        oxygenAvailable: true,
        ventilatorAvailable: true,
      },
    });
    expect(invalidCapacity.success).toBe(false);

    const validCapacity = updateCapacitySchema.safeParse({
      params: { hospitalId: hospitalUuid },
      body: {
        totalBeds: 50,
        availableBeds: 12,
        icuBedsTotal: 10,
        icuBedsAvailable: 3,
        oxygenAvailable: true,
        ventilatorAvailable: true,
      },
    });
    expect(validCapacity.success).toBe(true);
  });

  it('should validate coordination response: require valid decision and clinical reasoning', () => {
    // Valid Acceptance
    const validAccept = respondCoordinationSchema.safeParse({
      params: { caseId: caseUuid, hospitalId: hospitalUuid },
      body: {
        status: 'ACCEPTED',
        bedsReserved: 1,
        responseReason: 'Trauma Bay 2 prepped, neurosurgeon and blood bank notified.',
      },
    });
    expect(validAccept.success).toBe(true);

    // Rejected: Missing clinical reason for diversion
    const noReasonDecline = respondCoordinationSchema.safeParse({
      params: { caseId: caseUuid, hospitalId: hospitalUuid },
      body: {
        status: 'DECLINED',
        responseReason: 'No', // Too short
      },
    });
    expect(noReasonDecline.success).toBe(false);
  });
});
