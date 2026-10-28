import { describe, it, expect } from 'vitest';
import { createEmergencySchema } from '../src/schemas/emergency.schema.js';

describe('Emergency Intake Idempotency Tests', () => {
  it('should accept valid idempotency UUID keys to protect against double dispatch on network retry', () => {
    const idempotencyKey = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';

    const validSubmission = createEmergencySchema.safeParse({
      body: {
        requesterName: 'Kavitha R',
        requesterPhone: '+919876543210',
        pickupLatitude: 13.0827,
        pickupLongitude: 80.2707,
        pickupAddress: 'Block 4, Anna Nagar West, Chennai',
        triagePriority: 'CRITICAL_P1',
        chiefComplaint: 'Severe acute chest pain radiating to left arm, shortness of breath',
        idempotencyKey,
      },
    });

    expect(validSubmission.success).toBe(true);
    if (validSubmission.success) {
      expect(validSubmission.data.body.idempotencyKey).toBe(idempotencyKey);
    }
  });

  it('should reject invalid UUID format in idempotencyKey', () => {
    const invalidSubmission = createEmergencySchema.safeParse({
      body: {
        requesterName: 'Kavitha R',
        requesterPhone: '+919876543210',
        pickupLatitude: 13.0827,
        pickupLongitude: 80.2707,
        pickupAddress: 'Block 4, Anna Nagar West, Chennai',
        triagePriority: 'CRITICAL_P1',
        chiefComplaint: 'Severe acute chest pain',
        idempotencyKey: 'not-a-valid-uuid',
      },
    });

    expect(invalidSubmission.success).toBe(false);
  });
});
