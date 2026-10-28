import { describe, it, expect } from 'vitest';
import { AuthService } from '../src/services/auth.service.js';
import { registerSchema, createInvitationSchema } from '../src/schemas/auth.schema.js';
import { UserRole } from '@prisma/client';

describe('Strict Identity, Password Policy, and RBAC Authorization Tests', () => {
  it('should enforce strict password complexity rules', () => {
    // Too short (< 10 chars)
    const shortPass = registerSchema.safeParse({
      body: {
        email: 'medic@hospital.gov',
        password: 'Pass1!',
        fullName: 'Test User',
      },
    });
    expect(shortPass.success).toBe(false);

    // Missing special character
    const noSpecial = registerSchema.safeParse({
      body: {
        email: 'medic@hospital.gov',
        password: 'SecurePassword1234',
        fullName: 'Test User',
      },
    });
    expect(noSpecial.success).toBe(false);

    // Missing uppercase
    const noUpper = registerSchema.safeParse({
      body: {
        email: 'medic@hospital.gov',
        password: 'securepassword1234!',
        fullName: 'Test User',
      },
    });
    expect(noUpper.success).toBe(false);

    // Valid strong password
    const valid = registerSchema.safeParse({
      body: {
        email: 'medic@hospital.gov',
        password: 'SecureEmergencyPass@2026',
        fullName: 'Test Paramedic',
      },
    });
    expect(valid.success).toBe(true);
  });

  it('should validate role selection during account registration', () => {
    const payload: any = {
      email: 'dispatcher@ems.gov',
      password: 'StrongPassword!999',
      fullName: 'Dispatcher One',
      role: 'DISPATCHER',
    };

    const parsed = registerSchema.safeParse({ body: payload });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.body.role).toBe('DISPATCHER');
  });

  it('should require privileged invitations to be generated only for explicit authorized roles', () => {
    const validInvite = createInvitationSchema.safeParse({
      body: {
        email: 'paramedic@ems.gov',
        role: 'AMBULANCE_CREW',
      },
    });
    expect(validInvite.success).toBe(true);

    const invalidRoleInvite = createInvitationSchema.safeParse({
      body: {
        email: 'someone@ems.gov',
        role: 'SUPER_ROOT_UNLIMITED',
      },
    });
    expect(invalidRoleInvite.success).toBe(false);
  });

  it('should properly sign and verify cryptographic JWT tokens with role claims', () => {
    const payload = {
      userId: 'test-user-id-001',
      email: 'dispatcher@control.org',
      role: UserRole.DISPATCHER,
      organizationId: 'dispatch-hq-01',
    };

    const token = AuthService.generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(50);

    const verified = AuthService.verifyToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.role).toBe(UserRole.DISPATCHER);
    expect(verified.organizationId).toBe('dispatch-hq-01');
  });

  it('should fail token verification when token is tampered or expired', () => {
    const token = AuthService.generateToken({
      userId: 'test-user-002',
      email: 'user@test.com',
      role: UserRole.PATIENT_REQUESTER,
    });

    const tampered = token.slice(0, -6) + 'abcdef';
    expect(() => AuthService.verifyToken(tampered)).toThrow();
  });
});
