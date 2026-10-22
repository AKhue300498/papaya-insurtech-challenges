import { z } from 'zod';
import { weightsSchema, ruleIds } from './config.js';
import { labelsSchema } from './labels.js';
import { compareText } from '../artifacts/canonical.js';

const text = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, 'Must not be blank');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const flagSchema = z.strictObject({
  rule: z.enum(ruleIds),
  severity: z.number().int().min(1).max(5),
  evidence: text,
});
const scoredClaimSchema = z.strictObject({
  claim_id: text,
  risk_score: z.number().finite().min(0).max(100),
  flags: z.array(flagSchema).max(8),
});
const diagnosticSchema = z.strictObject({
  claim_id: text,
  rule: z.enum(ruleIds),
  code: text,
  message: text,
});
const metadataSchema = z.strictObject({
  schema_version: z.literal('1'),
  dataset_hash: sha256,
  configuration_hash: sha256,
  effective_weights: weightsSchema,
  mapping_version: text,
  scoring_duration_ms: z.number().finite().nonnegative(),
  environment: z.strictObject({
    node: text,
    platform: text,
    architecture: text,
  }),
});

export const scoredArtifactSchema = z
  .strictObject({
    schema_version: z.literal('1'),
    results: z.array(scoredClaimSchema).max(2000),
    diagnostics: z.array(diagnosticSchema),
    metadata: metadataSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set();
    const weights = artifact.metadata.effective_weights;
    const totalWeight = Object.values(weights).reduce(
      (sum, value) => sum + value,
      0,
    );
    artifact.results.forEach((result, index) => {
      const addIssue = (field, message) =>
        context.addIssue({
          code: 'custom',
          path: ['results', index, field],
          message,
        });
      if (ids.has(result.claim_id))
        addIssue('claim_id', 'Scored claim IDs must be unique');
      ids.add(result.claim_id);
      let lastRule = -1;
      for (const flag of result.flags) {
        const ruleIndex = ruleIds.indexOf(flag.rule);
        if (ruleIndex <= lastRule)
          addIssue('flags', 'Flags must be unique and in canonical rule order');
        lastRule = ruleIndex;
        if (flag.severity !== weights[flag.rule])
          addIssue('flags', 'Flag severity must match the effective weight');
      }
      const triggered = result.flags.reduce(
        (sum, flag) => sum + flag.severity,
        0,
      );
      const expected = Math.round((10000 * triggered) / totalWeight) / 100;
      if (result.risk_score !== expected)
        addIssue(
          'risk_score',
          'Score must match normalized triggered weights rounded to two decimals',
        );
      const previous = artifact.results[index - 1];
      if (
        previous &&
        (previous.risk_score < result.risk_score ||
          (previous.risk_score === result.risk_score &&
            compareText(previous.claim_id, result.claim_id) > 0))
      )
        addIssue(
          'claim_id',
          'Results must be ranked by descending score and ascending claim ID on ties',
        );
    });
    artifact.diagnostics.forEach((diagnostic, index) => {
      if (!ids.has(diagnostic.claim_id))
        context.addIssue({
          code: 'custom',
          path: ['diagnostics', index, 'claim_id'],
          message: 'Diagnostic claim must exist in scored results',
        });
    });
  });

export const evaluationSchema = z
  .strictObject({
    scored: scoredArtifactSchema,
    labels: labelsSchema,
    minimum_score: z.number().finite().gt(0).max(100).optional(),
  })
  .superRefine((request, context) => {
    const ids = new Set(
      request.scored.results.map((result) => result.claim_id),
    );
    if (request.labels.length !== ids.size)
      context.addIssue({
        code: 'custom',
        path: ['labels'],
        message: 'Labels must cover exactly the scored claim IDs',
      });
    request.labels.forEach((label, index) => {
      if (!ids.has(label.claim_id))
        context.addIssue({
          code: 'custom',
          path: ['labels', index, 'claim_id'],
          message: 'Unexpected label ID absent from scored results',
        });
    });
  });
