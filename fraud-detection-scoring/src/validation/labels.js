import { z } from 'zod';
import { ruleIds } from './config.js';

export const labelSchema = z
  .strictObject({
    claim_id: z
      .string()
      .min(1)
      .refine((value) => value.trim().length > 0, 'Must not be blank'),
    is_fraud: z.boolean(),
    injected_patterns: z
      .array(z.enum(ruleIds))
      .refine(
        (values) => new Set(values).size === values.length,
        'Injected patterns must be unique',
      ),
  })
  .superRefine((label, context) => {
    if (label.is_fraud !== label.injected_patterns.length > 0)
      context.addIssue({
        code: 'custom',
        path: ['injected_patterns'],
        message: 'Fraud status must match intentional pattern presence',
      });
  });

export const labelsSchema = z
  .array(labelSchema)
  .max(2000)
  .superRefine((labels, context) => {
    const ids = new Set();
    labels.forEach((label, index) => {
      if (ids.has(label.claim_id))
        context.addIssue({
          code: 'custom',
          path: [index, 'claim_id'],
          message: 'Label IDs must be unique',
        });
      ids.add(label.claim_id);
    });
  });
