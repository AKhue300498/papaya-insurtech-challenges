import { isWeekend } from '../../src/domain/dates.js';

export function claim(overrides = {}) {
  const claim_date = overrides.claim_date ?? '2024-06-03';
  return {
    claim_id: 'CLM-001',
    member_id: 'MEM-001',
    provider_id: 'PRV-001',
    provider_name: 'Synthetic Clinic',
    claim_date,
    claim_type: 'OUTPATIENT',
    diagnosis_code: 'Z00.0',
    procedure_codes: ['P-100'],
    submitted_amount: 100,
    is_weekend: isWeekend(claim_date),
    ...overrides,
  };
}

export function independentClaims(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) =>
    claim({
      claim_id: `CLM-${String(index).padStart(4, '0')}`,
      member_id: `MEM-${index}`,
      ...overrides,
    }),
  );
}

export function withoutTiming(result) {
  const copy = structuredClone(result);
  delete copy.metadata.scoring_duration_ms;
  delete copy.metadata.environment;
  return copy;
}

export function allRuleClaims() {
  const procedures = ['P-101', 'P-102', 'P-300'];
  return [
    ...independentClaims(40, {
      claim_date: '2024-06-08',
      procedure_codes: procedures,
    }),
    claim({
      claim_id: 'TARGET',
      member_id: 'MEM-0',
      claim_date: '2024-06-08',
      procedure_codes: procedures,
      submitted_amount: 49500,
    }),
    claim({
      claim_id: 'HISTORY',
      member_id: 'HISTORY',
      procedure_codes: procedures,
    }),
  ];
}
