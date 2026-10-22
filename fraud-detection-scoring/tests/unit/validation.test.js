import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/errors.js';
import { claimsSchema } from '../../src/validation/claims.js';
import { resolveConfig } from '../../src/config.js';
import { claim } from '../fixtures/claims.js';
import { canonicalClaims, hash } from '../../src/artifacts/canonical.js';

test('valid leap date and empty batches are accepted', () => {
  assert.equal(
    parse(claimsSchema, [claim({ claim_date: '2024-02-29' })]).length,
    1,
  );
  assert.deepEqual(parse(claimsSchema, []), []);
});

test('fractional cents cannot pass through floating-point tolerances', () => {
  assert.throws(
    () => parse(claimsSchema, [claim({ submitted_amount: 100.0000001 })]),
    { code: 'VALIDATION_ERROR' },
  );
  for (const amount of [0.1, 0.29, 49999.99, 1000000000])
    assert.equal(
      parse(claimsSchema, [claim({ submitted_amount: amount })])[0]
        .submitted_amount,
      amount,
    );
});

for (const [name, value] of Object.entries({
  impossible_date: { claim_date: '2024-02-30' },
  missing_id: { claim_id: undefined },
  blank_member: { member_id: ' ' },
  blank_provider: { provider_id: '' },
  invalid_type: { claim_type: 'OTHER' },
  empty_procedures: { procedure_codes: [] },
  repeated_procedures: { procedure_codes: ['P-100', 'P-100'] },
  invalid_diagnosis: { diagnosis_code: 'bad' },
  negative_amount: { submitted_amount: -1 },
  nonfinite_amount: { submitted_amount: Infinity },
  excessive_amount: { submitted_amount: 1e12 },
  fractional_cent: { submitted_amount: 100.001 },
  wrong_weekend: { is_weekend: true },
  label_leak: { is_fraud: true },
})) {
  test(`validation rejects ${name}`, () =>
    assert.throws(() => parse(claimsSchema, [claim(value)]), {
      code: 'VALIDATION_ERROR',
    }));
}

test('errors locate duplicate IDs and inconsistent provider names', () => {
  assert.throws(
    () => parse(claimsSchema, [claim(), claim()]),
    (error) => error.details.some((detail) => detail.path === '1.claim_id'),
  );
  assert.throws(
    () =>
      parse(claimsSchema, [
        claim(),
        claim({ claim_id: 'other', provider_name: 'Other' }),
      ]),
    (error) =>
      error.details.some((detail) => detail.path === '1.provider_name'),
  );
});

test('batches over 2000 are rejected before processing', () => {
  assert.throws(
    () =>
      parse(
        claimsSchema,
        Array.from({ length: 2001 }, (_, index) =>
          claim({ claim_id: String(index) }),
        ),
      ),
    { code: 'VALIDATION_ERROR' },
  );
});

test('weight overrides are strict integers and defaults stay isolated', () => {
  for (const weights of [
    { upcoding: 0 },
    { upcoding: 6 },
    { upcoding: 2.5 },
    { upcoding: '3' },
    { missing: 2 },
    null,
  ])
    assert.throws(() => resolveConfig(weights), { code: 'VALIDATION_ERROR' });
  const modified = resolveConfig({ upcoding: 1 });
  assert.equal(modified.weights.upcoding, 1);
  assert.equal(resolveConfig().weights.upcoding, 4);
  assert.throws(() => {
    modified.weights.upcoding = 5;
  }, TypeError);
  assert.equal(resolveConfig().bundles.length, 5);
});

test('canonical hashes ignore input and procedure order but preserve claim content', () => {
  const a = claim({ procedure_codes: ['P-102', 'P-101'] });
  const b = claim({ claim_id: 'other' });
  assert.equal(
    hash(canonicalClaims([a, b])),
    hash(
      canonicalClaims([
        b,
        { ...a, procedure_codes: [...a.procedure_codes].reverse() },
      ]),
    ),
  );
  assert.notEqual(
    hash(canonicalClaims([a])),
    hash(canonicalClaims([{ ...a, submitted_amount: 101 }])),
  );
});
