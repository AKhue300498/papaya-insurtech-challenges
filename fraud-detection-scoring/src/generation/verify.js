import { z } from 'zod';
import { AppError, parse } from '../errors.js';
import { claimsSchema } from '../validation/claims.js';
import { labelsSchema } from '../validation/labels.js';
import { manifestSchema } from '../validation/generation.js';
import { resolveConfig } from '../config.js';
import { canonicalClaims, compareText, hash } from '../artifacts/canonical.js';
import { dayNumber } from '../domain/dates.js';
import { patternCounts } from './inject.js';

const datasetSchema = z.strictObject({
  schema_version: z.literal('1'),
  claims: claimsSchema,
  labels: labelsSchema,
  manifest: manifestSchema,
});

function fail(path, message) {
  throw new AppError(
    'GENERATION_VERIFICATION_FAILED',
    'Final dataset failed independent verification',
    [{ path, code: 'invalid_generation', message }],
  );
}

function sameVisit(left, right) {
  return (
    left.member_id === right.member_id &&
    left.provider_id === right.provider_id &&
    left.claim_date === right.claim_date &&
    left.diagnosis_code === right.diagnosis_code
  );
}

function isResubmission(claim, other) {
  const elapsed = dayNumber(claim.claim_date) - dayNumber(other.claim_date);
  return (
    claim.member_id === other.member_id &&
    claim.diagnosis_code === other.diagnosis_code &&
    elapsed >= 0 &&
    elapsed <= 7
  );
}

function satisfies(rule, claim, claims, config) {
  const others = claims.filter((other) => other.claim_id !== claim.claim_id);
  if (rule === 'duplicate_claim')
    return others.some((other) => sameVisit(claim, other));
  if (rule === 'rapid_resubmission')
    return others.some((other) => isResubmission(claim, other));
  if (rule === 'upcoding')
    return claim.procedure_codes.some((procedure) => {
      const amounts = claims
        .filter((other) => other.procedure_codes.includes(procedure))
        .map((other) => other.submitted_amount);
      const mean =
        amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
      const variance =
        amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) /
        amounts.length;
      return (
        amounts.length >= 2 &&
        variance > 0 &&
        claim.submitted_amount > mean + 2 * Math.sqrt(variance)
      );
    });
  if (rule === 'unbundling')
    return config.bundles.some(
      (bundle) =>
        !claim.procedure_codes.includes(bundle.bundle_code) &&
        bundle.components.every((procedure) =>
          claim.procedure_codes.includes(procedure),
        ),
    );
  if (rule === 'phantom_billing')
    return (
      claims.filter(
        (other) =>
          other.provider_id === claim.provider_id &&
          other.claim_date === claim.claim_date,
      ).length > 30
    );
  if (rule === 'weekend_anomaly') {
    const history = others.filter(
      (other) =>
        other.provider_id === claim.provider_id &&
        other.claim_date < claim.claim_date,
    );
    return (
      claim.is_weekend &&
      claim.procedure_codes.some((procedure) =>
        config.surgical_procedures.includes(procedure),
      ) &&
      history.length > 0 &&
      history.filter((other) => other.is_weekend).length * 20 < history.length
    );
  }
  if (rule === 'diagnosis_procedure_mismatch')
    return claim.procedure_codes.some(
      (procedure) =>
        !config.diagnosis_procedure_pairs[claim.diagnosis_code]?.includes(
          procedure,
        ),
    );
  if (rule === 'amount_clustering')
    return claim.submitted_amount >= 47500 && claim.submitted_amount < 50000;
  return false;
}

function verifyGroups(manifest, labels, byId) {
  const labelMap = new Map(labels.map((label) => [label.claim_id, label]));
  const rules = new Set();
  for (const [index, group] of manifest.injection_groups.entries()) {
    const path = `manifest.injection_groups.${index}`;
    if (rules.has(group.rule)) fail(path, 'Duplicate injection group rule');
    rules.add(group.rule);
    const expectedIds = labels
      .filter((label) => label.injected_patterns.includes(group.rule))
      .map((label) => label.claim_id)
      .sort(compareText);
    if (
      JSON.stringify([...group.claim_ids].sort(compareText)) !==
      JSON.stringify(expectedIds)
    )
      fail(path, 'Group references must match intentional labels exactly');
    if (
      new Set(group.support_claim_ids).size !== group.support_claim_ids.length
    )
      fail(path, 'Support IDs must be unique');
    for (const id of group.support_claim_ids)
      if (!byId.has(id) || labelMap.get(id)?.is_fraud !== false)
        fail(
          path,
          'Support references must identify existing clean-labeled claims',
        );
    const supports = group.support_claim_ids.map((id) => byId.get(id));
    if (
      group.rule === 'duplicate_claim' ||
      group.rule === 'rapid_resubmission'
    ) {
      for (const id of group.claim_ids) {
        const target = byId.get(id);
        if (
          !supports.some((other) =>
            group.rule === 'duplicate_claim'
              ? sameVisit(target, other)
              : isResubmission(target, other),
          )
        )
          fail(path, 'Each repeat claim requires a matching support reference');
      }
    }
    if (group.rule === 'phantom_billing') {
      if (supports.length < 6)
        fail(
          path,
          'Phantom group requires at least six clean supporting claims',
        );
      const target = byId.get(group.claim_ids[0]);
      if (
        !supports.every(
          (other) =>
            other.provider_id === target.provider_id &&
            other.claim_date === target.claim_date,
        )
      )
        fail(
          path,
          'Phantom supporting claims must share the injected provider and date',
        );
    }
  }
}

export function verifyDataset(input) {
  const {
    claims: parsedClaims,
    labels,
    manifest,
  } = parse(datasetSchema, input);
  const claims = canonicalClaims(parsedClaims);
  const config = resolveConfig();
  const byId = new Map(claims.map((claim) => [claim.claim_id, claim]));
  const counts = {
    claim_count: claims.length,
    member_count: new Set(claims.map((claim) => claim.member_id)).size,
    provider_count: new Set(claims.map((claim) => claim.provider_id)).size,
    fraud_count: labels.filter((label) => label.is_fraud).length,
  };
  for (const [name, expected] of Object.entries({
    claim_count: 2000,
    member_count: 500,
    provider_count: 50,
    fraud_count: 200,
  })) {
    if (counts[name] !== expected || manifest[name] !== expected)
      fail(
        `manifest.${name}`,
        `Expected ${expected}; observed ${counts[name]}`,
      );
  }
  if (
    labels.length !== claims.length ||
    labels.some((label) => !byId.has(label.claim_id))
  )
    fail('labels', 'Labels must cover exactly the generated claims');
  if (
    claims.some(
      (claim) =>
        claim.claim_date < '2024-01-01' || claim.claim_date > '2024-12-31',
    )
  )
    fail('claims', 'Generated dates must be in 2024');
  if (manifest.mapping_version !== config.mapping_version)
    fail(
      'manifest.mapping_version',
      'Mapping version must match the active catalog',
    );
  if (manifest.dataset_hash !== hash(claims))
    fail(
      'manifest.dataset_hash',
      'Dataset hash does not match the final claims',
    );
  for (const [rule, expected] of Object.entries(patternCounts)) {
    const count = labels.filter((label) =>
      label.injected_patterns.includes(rule),
    ).length;
    if (count !== expected || manifest.pattern_counts[rule] !== expected)
      fail(
        `manifest.pattern_counts.${rule}`,
        `Expected ${expected} intentional memberships; observed ${count}`,
      );
  }
  verifyGroups(manifest, labels, byId);
  for (const label of labels) {
    if (label.injected_patterns.length > 1)
      fail(
        `labels.${label.claim_id}`,
        'Each generated fraud claim has one intentional pattern',
      );
    for (const rule of label.injected_patterns)
      if (!satisfies(rule, byId.get(label.claim_id), claims, config))
        fail(
          `claims.${label.claim_id}`,
          `Intentional ${rule} pattern is absent from the final dataset`,
        );
  }
  return counts;
}
