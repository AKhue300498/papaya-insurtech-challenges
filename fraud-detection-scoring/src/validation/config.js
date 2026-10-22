import { z } from 'zod';

export const ruleIds = Object.freeze([
  'duplicate_claim',
  'rapid_resubmission',
  'upcoding',
  'unbundling',
  'phantom_billing',
  'weekend_anomaly',
  'diagnosis_procedure_mismatch',
  'amount_clustering',
]);
export const weightsSchema = z.strictObject(
  Object.fromEntries(ruleIds.map((id) => [id, z.number().int().min(1).max(5)])),
);
export const overridesSchema = weightsSchema.partial();
const codes = z
  .array(z.string().min(1))
  .min(1)
  .refine(
    (items) => new Set(items).size === items.length,
    'Codes must be unique',
  );
export const catalogSchema = z.strictObject({
  mapping_version: z.string().min(1),
  bundles: z
    .array(
      z.strictObject({
        bundle_code: z.string().min(1),
        components: codes.refine(
          (items) => items.length >= 2,
          'At least two components required',
        ),
      }),
    )
    .min(5),
  diagnosis_procedure_pairs: z
    .record(z.string().regex(/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/), codes)
    .refine(
      (pairs) =>
        Object.values(pairs).reduce(
          (count, items) => count + items.length,
          0,
        ) >= 10,
      'At least ten valid pairs required',
    ),
  surgical_procedures: codes,
});
