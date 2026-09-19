import { z } from 'zod';

/** Request schemas shared by the API and the web client. Every mutating
 * request is validated with one of these. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const paise = z.number().int().min(0).max(100_000_000_000);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(200);
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'Password is too long');

export const roleSchema = z.enum(['tenant', 'landlord']);
export const propertyTypeSchema = z.enum(['apartment', 'independent_house', 'room', 'hostel_pg']);
export const inspectionStageSchema = z.enum(['move_in', 'move_out']);
export const consentPurposeSchema = z.enum(['service', 'evidence_retention', 'ai_processing']);

export const registerSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(2, 'Enter your name').max(80),
    password: passwordSchema,
    role: roleSchema,
    consent: z
      .object({
        service: z.literal(true),
        evidence_retention: z.literal(true),
        ai_processing: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password').max(200),
  })
  .strict();

export const createPropertySchema = z
  .object({
    title: z.string().trim().min(3, 'Give the property a title').max(120),
    addressLine: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(60),
    stateCode: z
      .string()
      .trim()
      .min(2)
      .max(4)
      .transform((value) => value.toUpperCase()),
    propertyType: propertyTypeSchema,
    bedrooms: z.number().int().min(0).max(20).default(1),
    monthlyRentPaise: paise,
    defaultDepositPaise: paise,
  })
  .strict();

export const updatePropertySchema = createPropertySchema.partial().strict();

export const createTenancySchema = z
  .object({
    propertyId: z.string().min(3).max(60),
    tenantEmail: emailSchema,
    startDate: isoDate,
    endDate: isoDate.optional(),
    depositPaise: paise,
    monthlyRentPaise: paise.optional(),
  })
  .strict();

export const createInspectionSchema = z
  .object({
    stage: inspectionStageSchema,
    area: z.string().trim().min(2, 'Name the area').max(160),
  })
  .strict();

export const openDisputeSchema = z
  .object({
    reason: z.string().trim().min(10, 'Explain the dispute').max(2000),
    statementId: z.string().max(60).optional(),
    findingId: z.string().max(60).optional(),
  })
  .strict();

export const resolveDisputeSchema = z
  .object({ resolutionNote: z.string().trim().min(3, 'Add a short note').max(2000) })
  .strict();

export const consentUpdateSchema = z
  .object({ purpose: consentPurposeSchema, granted: z.boolean() })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateTenancyInput = z.infer<typeof createTenancySchema>;
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
