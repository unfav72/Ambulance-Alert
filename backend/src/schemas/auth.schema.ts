import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').max(255),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format').optional().or(z.literal('')),
    role: z
      .enum(['PATIENT_REQUESTER', 'DISPATCHER', 'AMBULANCE_CREW', 'HOSPITAL_STAFF', 'SYSTEM_ADMIN'])
      .default('PATIENT_REQUESTER'),
    organizationId: z.string().uuid().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    mfaToken: z.string().length(6).optional(),
  }),
});

export const createInvitationSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['AMBULANCE_CREW', 'HOSPITAL_STAFF', 'DISPATCHER', 'SYSTEM_ADMIN'], {
      errorMap: () => ({ message: 'Public registration cannot grant privileged roles' }),
    }),
    organizationId: z.string().uuid().optional(),
  }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(32, 'Invalid or expired invitation token'),
    fullName: z.string().min(2).max(100),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
  }),
});

export const bootstrapAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(2),
  setupToken: z.string(),
});
