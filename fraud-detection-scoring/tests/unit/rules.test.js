import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from '../fixtures/rules.json' with { type: 'json' };
import { scoreClaims } from '../../src/domain/score.js';
import { claim, independentClaims } from '../fixtures/claims.js';

function flagged(claims, rule, id = claims.at(-1).claim_id) {
  return scoreClaims({ claims })
    .results.find((item) => item.claim_id === id)
    .flags.find((item) => item.rule === rule);
}

test('duplicate detection flags every member and identifies related claims', () => {
  const claims = [claim({ claim_id: 'B' }), claim({ claim_id: 'A' })];
  assert.match(flagged(claims, 'duplicate_claim', 'A').evidence, /B/);
  assert.match(flagged(claims, 'duplicate_claim', 'B').evidence, /A/);
});

for (const [field, value] of Object.entries({
  member_id: 'other',
  provider_id: 'other',
  claim_date: '2024-06-04',
  diagnosis_code: 'I10',
})) {
  test(`duplicate detection excludes a different ${field}`, () => {
    assert.equal(
      flagged(
        [claim(), claim({ claim_id: 'other', [field]: value })],
        'duplicate_claim',
      ),
      undefined,
    );
  });
}

for (const [date, expected] of [
  ['2024-06-03', true],
  ['2024-06-10', true],
  ['2024-06-11', false],
]) {
  test(`rapid resubmission date ${date} has expected inclusive behavior`, () => {
    const claims = [
      claim({ claim_id: 'A' }),
      claim({ claim_id: 'B', provider_id: 'other', claim_date: date }),
    ];
    assert.equal(Boolean(flagged(claims, 'rapid_resubmission')), expected);
  });
}

test('rapid resubmission excludes future claims and different diagnoses', () => {
  const claims = [
    claim({ claim_id: 'A' }),
    claim({ claim_id: 'B', claim_date: '2024-06-10' }),
    claim({ claim_id: 'C', diagnosis_code: 'I10' }),
  ];
  assert.equal(flagged(claims, 'rapid_resubmission', 'A'), undefined);
  assert.equal(flagged(claims, 'rapid_resubmission', 'C'), undefined);
  assert.match(flagged(claims, 'rapid_resubmission', 'B').evidence, /7 days/);
});

test('upcoding uses population moments and strictly excludes equality', () => {
  const claims = fixtures.upcoding_equality.map((amount, index) =>
    claim({
      claim_id: String(index),
      member_id: String(index),
      submitted_amount: amount,
    }),
  );
  assert.equal(flagged(claims, 'upcoding'), undefined);
});

test('upcoding identifies high amount with procedure mean and deviation evidence', () => {
  const claims = fixtures.upcoding_positive.map((amount, index) =>
    claim({
      claim_id: String(index),
      member_id: String(index),
      submitted_amount: amount,
    }),
  );
  const flag = flagged(claims, 'upcoding');
  assert.match(flag.evidence, /P-100/);
  assert.match(flag.evidence, /300/);
  assert.match(flag.evidence, /mean/);
  assert.match(flag.evidence, /standard deviations/);
});

test('upcoding skips insufficient samples and zero variance with explicit diagnostics', () => {
  for (const claims of [[claim()], independentClaims(3)]) {
    const output = scoreClaims({ claims });
    assert.ok(
      output.results.every(
        (result) => !result.flags.some((flag) => flag.rule === 'upcoding'),
      ),
    );
    assert.ok(
      output.diagnostics.some((diagnostic) => diagnostic.rule === 'upcoding'),
    );
  }
});

test('upcoding checks every procedure and aggregates evidence into one flag', () => {
  const claims = [
    ...independentClaims(10, { procedure_codes: ['P-101', 'P-102'] }),
    claim({
      claim_id: 'TARGET',
      member_id: 'target',
      procedure_codes: ['P-101', 'P-102'],
      submitted_amount: 10000,
    }),
  ];
  const flag = flagged(claims, 'upcoding');
  assert.match(flag.evidence, /P-101/);
  assert.match(flag.evidence, /P-102/);
});

test('unbundling requires all components and absence of bundle', () => {
  assert.ok(
    flagged([claim({ procedure_codes: ['P-101', 'P-102'] })], 'unbundling'),
  );
  assert.equal(
    flagged([claim({ procedure_codes: ['P-101'] })], 'unbundling'),
    undefined,
  );
  assert.equal(
    flagged(
      [claim({ procedure_codes: ['P-101', 'P-102', 'B-100'] })],
      'unbundling',
    ),
    undefined,
  );
});

test('multiple bundle matches still yield one flag with all bundle evidence', () => {
  const flag = flagged(
    [claim({ procedure_codes: ['P-101', 'P-102', 'P-201', 'P-202'] })],
    'unbundling',
  );
  assert.match(flag.evidence, /B-100/);
  assert.match(flag.evidence, /B-200/);
});

test('phantom billing excludes exactly 30 and flags every claim at 31', () => {
  assert.equal(flagged(independentClaims(30), 'phantom_billing'), undefined);
  const output = scoreClaims({ claims: independentClaims(31) });
  assert.ok(
    output.results.every((result) =>
      result.flags.some(
        (flag) => flag.rule === 'phantom_billing' && /31/.test(flag.evidence),
      ),
    ),
  );
});

test('phantom billing isolates provider and date', () => {
  const claims = [
    ...independentClaims(30),
    claim({ claim_id: 'other', provider_id: 'other' }),
    claim({ claim_id: 'next', claim_date: '2024-06-04' }),
  ];
  assert.ok(
    scoreClaims({ claims }).results.every(
      (result) => !result.flags.some((flag) => flag.rule === 'phantom_billing'),
    ),
  );
});

function weekendBatch(weekendCount, total) {
  return [
    ...Array.from({ length: total }, (_, index) =>
      claim({
        claim_id: `H${index}`,
        member_id: `H${index}`,
        claim_date: index < weekendCount ? '2024-06-01' : '2024-06-03',
      }),
    ),
    claim({
      claim_id: 'TARGET',
      claim_date: '2024-06-08',
      diagnosis_code: 'M17.9',
      procedure_codes: ['P-300'],
    }),
  ];
}

test('weekend surgery with below 5 percent history is flagged', () => {
  assert.ok(flagged(weekendBatch(1, 21), 'weekend_anomaly'));
});

test('weekend surgery with exactly 5 percent history is excluded', () => {
  assert.equal(flagged(weekendBatch(1, 20), 'weekend_anomaly'), undefined);
});

test('no earlier history skips weekend anomaly and emits a diagnostic', () => {
  const target = claim({
    claim_date: '2024-06-08',
    procedure_codes: ['P-300'],
  });
  const output = scoreClaims({ claims: [target] });
  assert.equal(flagged([target], 'weekend_anomaly'), undefined);
  assert.ok(output.diagnostics.some((item) => item.rule === 'weekend_anomaly'));
});

test('future and same-day volume do not contaminate historical weekend rate', () => {
  const claims = [
    ...weekendBatch(0, 1),
    ...independentClaims(30, { claim_date: '2024-06-09' }),
    ...independentClaims(10, { claim_date: '2024-06-08' }).map((item) => ({
      ...item,
      claim_id: `S${item.claim_id}`,
    })),
  ];
  assert.ok(flagged(claims, 'weekend_anomaly', 'TARGET'));
});

test('weekday surgery and weekend nonsurgery do not trigger weekend anomaly', () => {
  const claims = weekendBatch(0, 1);
  claims.at(-1).procedure_codes = ['P-100'];
  assert.equal(flagged(claims, 'weekend_anomaly'), undefined);
  claims.at(-1).procedure_codes = ['P-300'];
  claims.at(-1).claim_date = '2024-06-07';
  claims.at(-1).is_weekend = false;
  assert.equal(flagged(claims, 'weekend_anomaly'), undefined);
});

test('valid clinical pairs pass and known mismatches identify diagnosis and procedure', () => {
  assert.equal(flagged([claim()], 'diagnosis_procedure_mismatch'), undefined);
  const flag = flagged(
    [claim({ procedure_codes: ['P-200'] })],
    'diagnosis_procedure_mismatch',
  );
  assert.match(flag.evidence, /Z00.0/);
  assert.match(flag.evidence, /P-200/);
});

test('unknown clinical codes are described as unsupported demonstration mappings', () => {
  const flag = flagged(
    [claim({ diagnosis_code: 'A99', procedure_codes: ['UNKNOWN'] })],
    'diagnosis_procedure_mismatch',
  );
  assert.match(flag.evidence, /unsupported/i);
  assert.match(flag.evidence, /demonstration/i);
});

for (const [name, amount] of Object.entries(fixtures.amounts)) {
  test(`clustering ${name} boundary ${amount}`, () => {
    const flag = flagged(
      [claim({ submitted_amount: amount })],
      'amount_clustering',
    );
    assert.equal(Boolean(flag), ['lower', 'upper'].includes(name));
    if (flag) {
      assert.match(flag.evidence, /50000/);
      assert.match(flag.evidence, /%/);
    }
  });
}
