import { z } from 'zod';
import { ruleIds } from './config.js';

export const generationSchema = z.strictObject({
  seed: z.number().int().min(0).max(4294967295).default(202410),
});
const ids = z
  .array(z.string().min(1))
  .min(1)
  .refine(
    (items) => new Set(items).size === items.length,
    'Claim references must be unique',
  );
export const manifestSchema = z.strictObject({
  schema_version: z.literal('1'),
  generator_version: z.literal('1'),
  prng: z.literal('mulberry32-v1'),
  seed: z.number().int().min(0).max(4294967295),
  mapping_version: z.string().min(1),
  dataset_hash: z.string().regex(/^[a-f0-9]{64}$/),
  claim_count: z.number().int().nonnegative(),
  member_count: z.number().int().nonnegative(),
  provider_count: z.number().int().nonnegative(),
  fraud_count: z.number().int().nonnegative(),
  pattern_counts: z.strictObject(
    Object.fromEntries(
      ruleIds.map((id) => [id, z.number().int().nonnegative()]),
    ),
  ),
  injection_groups: z
    .array(
      z.strictObject({
        rule: z.enum(ruleIds),
        claim_ids: ids,
        support_claim_ids: z.array(z.string().min(1)),
      }),
    )
    .length(8),
});
