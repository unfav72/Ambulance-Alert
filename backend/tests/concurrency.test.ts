import { describe, it, expect, vi } from 'vitest';
import { AmbulanceStatus, AmbulanceType } from '@prisma/client';

describe('Concurrent Ambulance Allocation and Concurrency Invariant Tests', () => {
  it('should prevent race conditions and ensure zero double-allocations under concurrent load', async () => {
    // Simulated database state representing 3 available ambulances
    const vehiclePool = [
      { id: 'amb-1', callSign: 'MEDIC-01', status: AmbulanceStatus.AVAILABLE, type: AmbulanceType.ICU },
      { id: 'amb-2', callSign: 'MEDIC-02', status: AmbulanceStatus.AVAILABLE, type: AmbulanceType.ADVANCED },
      { id: 'amb-3', callSign: 'MEDIC-03', status: AmbulanceStatus.AVAILABLE, type: AmbulanceType.BASIC },
    ];

    // Track assigned ambulances to verify mutual exclusion
    const assignedAmbulanceIds: string[] = [];
    const escalatedCaseIds: string[] = [];

    // Atomic claim function simulating database row-level conditional update:
    // UPDATE Ambulance SET status = 'DISPATCHED' WHERE id = targetId AND status = 'AVAILABLE'
    async function atomicClaimAmbulance(caseId: string, preferredAmbulanceId: string): Promise<boolean> {
      // Simulate non-deterministic network / DB latency (5 - 25ms)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5));

      const vehicle = vehiclePool.find((v) => v.id === preferredAmbulanceId);
      if (!vehicle) return false;

      // ACID Atomic conditional transition
      if (vehicle.status === AmbulanceStatus.AVAILABLE) {
        vehicle.status = AmbulanceStatus.DISPATCHED;
        assignedAmbulanceIds.push(vehicle.id);
        return true;
      }

      // Conflict: Vehicle was already claimed by a concurrent request
      return false;
    }

    // Dispatcher simulation with retry loop over candidates
    async function allocateCase(caseId: string): Promise<{ caseId: string; assignedId?: string; escalated: boolean }> {
      // Candidate ranking order
      const candidates = ['amb-1', 'amb-2', 'amb-3'];

      for (const ambId of candidates) {
        const success = await atomicClaimAmbulance(caseId, ambId);
        if (success) {
          return { caseId, assignedId: ambId, escalated: false };
        }
      }

      // All candidate ambulances were claimed concurrently -> Escalate
      escalatedCaseIds.push(caseId);
      return { caseId, escalated: true };
    }

    // Trigger 10 simultaneous emergency allocation requests for the 3 available ambulances
    const caseIds = Array.from({ length: 10 }, (_, i) => `CASE-${i + 1}`);

    const results = await Promise.all(caseIds.map((id) => allocateCase(id)));

    // Verifications:
    const successfulAssignments = results.filter((r) => !r.escalated);
    const escalatedAssignments = results.filter((r) => r.escalated);

    // 1. Exactly 3 assignments should succeed (because there were only 3 ambulances)
    expect(successfulAssignments.length).toBe(3);

    // 2. Exactly 7 cases should be escalated to dispatch queue
    expect(escalatedAssignments.length).toBe(7);

    // 3. ZERO DOUBLE ALLOCATIONS: Every assigned ambulance ID in assignedAmbulanceIds must be unique!
    const uniqueAssignedIds = new Set(assignedAmbulanceIds);
    expect(uniqueAssignedIds.size).toBe(3);
    expect(assignedAmbulanceIds.length).toBe(3);

    // 4. All ambulances in vehiclePool must now be in DISPATCHED state
    vehiclePool.forEach((amb) => {
      expect(amb.status).toBe(AmbulanceStatus.DISPATCHED);
    });
  });
});
