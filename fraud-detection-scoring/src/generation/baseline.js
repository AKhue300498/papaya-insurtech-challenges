import { isWeekend } from '../domain/dates.js';

const visits = [
  ['Z00.0', 'P-100', 1200, 'OUTPATIENT'],
  ['K02.9', 'P-200', 1800, 'DENTAL'],
  ['M17.9', 'P-300', 8000, 'INPATIENT'],
  ['H25.9', 'P-400', 6500, 'INPATIENT'],
  ['K80.2', 'P-500', 7000, 'INPATIENT'],
  ['J06.9', 'P-600', 900, 'OUTPATIENT'],
  ['E11.9', 'P-700', 2200, 'OUTPATIENT'],
  ['I10', 'P-800', 1400, 'OUTPATIENT'],
  ['L20.9', 'P-900', 1100, 'OUTPATIENT'],
  ['N39.0', 'P-1000', 1300, 'OUTPATIENT'],
];

export function dateAtOffset(offset) {
  return new Date(Date.UTC(2024, 0, 8 + offset)).toISOString().slice(0, 10);
}

export function setDate(claim, date) {
  claim.claim_date = date;
  claim.is_weekend = isWeekend(date);
}

export function setProvider(claim, index) {
  claim.provider_id = `PRV-${String(index + 1).padStart(3, '0')}`;
  claim.provider_name = `Synthetic Clinic ${String(index + 1).padStart(3, '0')}`;
}

export function createBaseline(random) {
  const providerShift = random.integer(0, 49);
  const diagnosisShift = random.integer(0, 9);
  return Array.from({ length: 2000 }, (_, index) => {
    const member = index % 500;
    const cycle = Math.floor(index / 500);
    const [diagnosis, procedure, amount, type] =
      visits[(member + cycle + diagnosisShift) % visits.length];
    let offset =
      cycle * 70 + Math.floor(member / 50) * 2 + random.integer(0, 3);
    while (isWeekend(dateAtOffset(offset))) offset++;
    const claim = {
      claim_id: `CLM-${String(index + 1).padStart(5, '0')}`,
      member_id: `MEM-${String(member + 1).padStart(3, '0')}`,
      provider_id: '',
      provider_name: '',
      claim_date: dateAtOffset(offset),
      claim_type: type,
      diagnosis_code: diagnosis,
      procedure_codes: [procedure],
      submitted_amount: amount + random.integer(-10000, 10000) / 100,
      is_weekend: false,
    };
    claim.submitted_amount = Number(claim.submitted_amount.toFixed(2));
    setProvider(claim, (member + providerShift) % 50);
    return claim;
  });
}
