import { z } from 'zod';
import { performance } from 'node:perf_hooks';
import { parse } from '../errors.js';
import { claimsSchema } from '../validation/claims.js';
import { overridesSchema, ruleIds } from '../validation/config.js';
import { resolveConfig } from '../config.js';
import { canonicalClaims, compareText, hash } from '../artifacts/canonical.js';
import { buildIndexes } from './indexes.js';
import { duplicateClaim } from './rules/duplicate-claim.js';
import { rapidResubmission } from './rules/rapid-resubmission.js';
import { upcoding } from './rules/upcoding.js';
import { unbundling } from './rules/unbundling.js';
import { phantomBilling } from './rules/phantom-billing.js';
import { weekendAnomaly } from './rules/weekend-anomaly.js';
import { diagnosisProcedureMismatch } from './rules/diagnosis-procedure-mismatch.js';
import { amountClustering } from './rules/amount-clustering.js';

const requestSchema = z.strictObject({
  claims: claimsSchema,
  weights: overridesSchema.optional(),
});
const detectors = [
  duplicateClaim,
  rapidResubmission,
  upcoding,
  unbundling,
  phantomBilling,
  weekendAnomaly,
  diagnosisProcedureMismatch,
  amountClustering,
];

export function scoreClaims(input) {
  const start = performance.now();
  const request = parse(requestSchema, input);
  const config = resolveConfig(request.weights);
  const claims = canonicalClaims(request.claims);
  const indexes = buildIndexes(claims);
  const totalWeight = ruleIds.reduce(
    (total, rule) => total + config.weights[rule],
    0,
  );
  const diagnostics = [];
  const results = claims
    .map((claim) => {
      const flags = [];
      detectors.forEach((detector, index) => {
        const rule = ruleIds[index];
        const finding = detector(claim, indexes, config);
        if (finding.evidence)
          flags.push({
            rule,
            severity: config.weights[rule],
            evidence: finding.evidence,
          });
        for (const diagnostic of finding.diagnostics ?? [])
          diagnostics.push({ claim_id: claim.claim_id, rule, ...diagnostic });
      });
      const triggered = flags.reduce((sum, flag) => sum + flag.severity, 0);
      return {
        claim_id: claim.claim_id,
        risk_score: Math.round((10000 * triggered) / totalWeight) / 100,
        flags,
      };
    })
    .sort(
      (a, b) =>
        b.risk_score - a.risk_score || compareText(a.claim_id, b.claim_id),
    );
  return {
    schema_version: '1',
    results,
    diagnostics,
    metadata: {
      schema_version: '1',
      dataset_hash: hash(claims),
      configuration_hash: hash(config),
      effective_weights: config.weights,
      mapping_version: config.mapping_version,
      scoring_duration_ms: performance.now() - start,
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
    },
  };
}
