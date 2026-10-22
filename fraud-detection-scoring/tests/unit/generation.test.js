import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../../src/generation/generate.js';
import { verifyDataset } from '../../src/generation/verify.js';
import { parse } from '../../src/errors.js';
import { claimsSchema } from '../../src/validation/claims.js';
import { labelsSchema } from '../../src/validation/labels.js';
import { manifestSchema } from '../../src/validation/generation.js';
import { canonicalClaims, hash } from '../../src/artifacts/canonical.js';

const expected = {
  duplicate_claim: 30,
  rapid_resubmission: 30,
  upcoding: 30,
  unbundling: 25,
  phantom_billing: 25,
  weekend_anomaly: 20,
  diagnosis_procedure_mismatch: 20,
  amount_clustering: 20,
};

test('default sample satisfies the challenge counts, schema and separated labels', () => {
  const sample = generateDataset();
  assert.equal(sample.schema_version, '1');
  assert.equal(sample.manifest.seed, 202410);
  assert.equal(parse(claimsSchema, sample.claims).length, 2000);
  assert.equal(
    new Set(sample.claims.map((claim) => claim.member_id)).size,
    500,
  );
  assert.equal(
    new Set(sample.claims.map((claim) => claim.provider_id)).size,
    50,
  );
  assert.ok(
    sample.claims.every(
      (claim) =>
        claim.claim_date >= '2024-01-01' && claim.claim_date <= '2024-12-31',
    ),
  );
  assert.equal(sample.labels.filter((label) => label.is_fraud).length, 200);
  assert.ok(
    sample.labels.every(
      (label) => label.injected_patterns.length === Number(label.is_fraud),
    ),
  );
  assert.deepEqual(sample.manifest.pattern_counts, expected);
  assert.equal(
    sample.manifest.dataset_hash,
    hash(canonicalClaims(sample.claims)),
  );
  assert.deepEqual(parse(labelsSchema, sample.labels), sample.labels);
  assert.deepEqual(parse(manifestSchema, sample.manifest), sample.manifest);
  assert.equal(verifyDataset(sample).fraud_count, 200);
});

test('the same seed reproduces artifacts while another seed changes content', () => {
  assert.deepEqual(
    generateDataset({ seed: 202410 }),
    generateDataset({ seed: 202410 }),
  );
  assert.notEqual(
    generateDataset({ seed: 7 }).manifest.dataset_hash,
    generateDataset({ seed: 202410 }).manifest.dataset_hash,
  );
});

test('both unsigned seed extremes generate valid verified samples', () => {
  for (const seed of [0, 4294967295])
    assert.equal(verifyDataset(generateDataset({ seed })).claim_count, 2000);
});

test('invalid seeds and unknown generation options are rejected', () => {
  for (const request of [
    { seed: -1 },
    { seed: 4294967296 },
    { seed: 1.5 },
    { seed: '7' },
    { seed: null },
    { seed: Infinity },
    { seed: NaN },
    { output: 'unsafe' },
    null,
  ])
    assert.throws(() => generateDataset(request), { code: 'VALIDATION_ERROR' });
});

test('generic labels allow arbitrary batch sizes but require coherent unique truth records', () => {
  assert.deepEqual(parse(labelsSchema, []), []);
  const record = {
    claim_id: 'test',
    is_fraud: true,
    injected_patterns: ['upcoding'],
  };
  assert.equal(parse(labelsSchema, [record]).length, 1);
  for (const records of [
    [record, record],
    [{ ...record, is_fraud: false }],
    [{ ...record, injected_patterns: [] }],
    [{ ...record, injected_patterns: ['bad_rule'] }],
    [{ ...record, extra: true }],
  ])
    assert.throws(() => parse(labelsSchema, records), {
      code: 'VALIDATION_ERROR',
    });
});

test('verifier rejects fraud relabeling, stale hashes, invalid group references and false counts', () => {
  for (const mutate of [
    (sample) => {
      sample.labels[0].is_fraud = true;
      sample.labels[0].injected_patterns = ['upcoding'];
    },
    (sample) => {
      sample.manifest.dataset_hash = '0'.repeat(64);
    },
    (sample) => {
      sample.manifest.injection_groups[0].claim_ids[0] = 'missing';
    },
    (sample) => {
      sample.manifest.pattern_counts.upcoding = 29;
    },
    (sample) => {
      sample.labels.pop();
    },
  ]) {
    const sample = generateDataset();
    mutate(sample);
    assert.throws(() => verifyDataset(sample));
  }
});

for (const rule of Object.keys(expected)) {
  test(`final verification independently rejects a destroyed ${rule} injection`, () => {
    const sample = generateDataset();
    const label = sample.labels.find((label) =>
      label.injected_patterns.includes(rule),
    );
    const claim = sample.claims.find(
      (claim) => claim.claim_id === label.claim_id,
    );
    if (['duplicate_claim', 'rapid_resubmission'].includes(rule))
      claim.member_id = 'MEM-500';
    if (rule === 'upcoding') claim.submitted_amount = 100;
    if (rule === 'unbundling') claim.procedure_codes = ['P-100'];
    if (rule === 'phantom_billing') {
      claim.claim_date = '2024-12-31';
      claim.is_weekend = false;
    }
    if (rule === 'weekend_anomaly') {
      claim.claim_date = '2024-12-09';
      claim.is_weekend = false;
    }
    if (rule === 'diagnosis_procedure_mismatch') claim.diagnosis_code = 'K02.9';
    if (rule === 'amount_clustering') claim.submitted_amount = 50000;
    sample.manifest.dataset_hash = hash(canonicalClaims(sample.claims));
    assert.throws(() => verifyDataset(sample), {
      code: 'GENERATION_VERIFICATION_FAILED',
    });
  });
}
