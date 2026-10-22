import { z } from 'zod';
import { isCalendarDate, isWeekend } from '../domain/dates.js';

const identifier = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, 'Must not be blank');
export const claimSchema = z
  .strictObject({
    claim_id: identifier,
    member_id: identifier,
    provider_id: identifier,
    provider_name: identifier,
    claim_date: z
      .string()
      .refine(isCalendarDate, 'Must be a real YYYY-MM-DD date'),
    claim_type: z.enum(['OUTPATIENT', 'INPATIENT', 'DENTAL']),
    diagnosis_code: z
      .string()
      .regex(
        /^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/,
        'Must be an ICD-10-format identifier',
      ),
    procedure_codes: z
      .array(identifier)
      .min(1)
      .refine(
        (values) => new Set(values).size === values.length,
        'Procedures must be unique',
      ),
    submitted_amount: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000)
      .refine(
        (value) => Number(value.toFixed(2)) === value,
        'At most two decimal places are allowed',
      ),
    is_weekend: z.boolean(),
  })
  .superRefine((claim, context) => {
    if (
      isCalendarDate(claim.claim_date) &&
      isWeekend(claim.claim_date) !== claim.is_weekend
    ) {
      context.addIssue({
        code: 'custom',
        path: ['is_weekend'],
        message: 'Weekend indicator must match claim_date',
      });
    }
  });

export const claimsSchema = z
  .array(claimSchema)
  .max(2000)
  .superRefine((claims, context) => {
    const ids = new Set();
    const providers = new Map();
    claims.forEach((claim, index) => {
      if (ids.has(claim.claim_id))
        context.addIssue({
          code: 'custom',
          path: [index, 'claim_id'],
          message: 'Claim IDs must be unique',
        });
      ids.add(claim.claim_id);
      if (
        providers.has(claim.provider_id) &&
        providers.get(claim.provider_id) !== claim.provider_name
      ) {
        context.addIssue({
          code: 'custom',
          path: [index, 'provider_name'],
          message: 'Provider name must be consistent per provider ID',
        });
      }
      providers.set(claim.provider_id, claim.provider_name);
    });
  });
