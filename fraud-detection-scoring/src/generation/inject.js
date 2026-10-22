import { dayNumber } from '../domain/dates.js';
import { dateAtOffset, setDate, setProvider } from './baseline.js';

export const patternCounts = Object.freeze({
  duplicate_claim: 30,
  rapid_resubmission: 30,
  upcoding: 30,
  unbundling: 25,
  phantom_billing: 25,
  weekend_anomaly: 20,
  diagnosis_procedure_mismatch: 20,
  amount_clustering: 20,
});

function copyVisit(target, source) {
  Object.assign(target, structuredClone(source), { claim_id: target.claim_id });
}

function setVisit(claim, diagnosis, procedures, amount, type = 'OUTPATIENT') {
  claim.diagnosis_code = diagnosis;
  claim.procedure_codes = [...procedures];
  claim.submitted_amount = amount;
  claim.claim_type = type;
}

export function injectPatterns(claims, random, config) {
  const labels = claims.map((claim) => ({
    claim_id: claim.claim_id,
    is_fraud: false,
    injected_patterns: [],
  }));
  let cursor = 1800;
  const groups = [];
  for (const [rule, count] of Object.entries(patternCounts)) {
    const group = { rule, claim_ids: [], support_claim_ids: [] };
    for (let position = 0; position < count; position++) {
      const index = cursor++;
      const claim = claims[index];
      labels[index].is_fraud = true;
      labels[index].injected_patterns = [rule];
      group.claim_ids.push(claim.claim_id);
      if (rule === 'duplicate_claim' || rule === 'rapid_resubmission') {
        const source =
          claims[position + (rule === 'rapid_resubmission' ? 30 : 0)];
        copyVisit(claim, source);
        group.support_claim_ids.push(source.claim_id);
        if (rule === 'rapid_resubmission') {
          const offset = dayNumber(source.claim_date) - dayNumber('2024-01-08');
          setDate(claim, dateAtOffset(offset + 1));
          setProvider(claim, (Number(source.provider_id.slice(4)) + 12) % 50);
        }
      } else if (rule === 'upcoding') {
        setDate(claim, '2024-10-14');
        setVisit(claim, 'Z00.0', ['P-100'], 100000 + random.integer(0, 1000));
      } else if (rule === 'unbundling') {
        const bundle = config.bundles[position % config.bundles.length];
        const diagnosis = Object.keys(config.diagnosis_procedure_pairs).find(
          (code) =>
            bundle.components.every((procedure) =>
              config.diagnosis_procedure_pairs[code].includes(procedure),
            ),
        );
        setDate(claim, '2024-10-07');
        setVisit(
          claim,
          diagnosis,
          bundle.components,
          3000 + (position % 5) * 1000 + random.integer(0, 100),
        );
      } else if (rule === 'phantom_billing') {
        setDate(claim, '2024-11-05');
        setProvider(claim, 49);
        setVisit(claim, 'Z00.0', ['P-100'], 1200 + random.integer(0, 100));
      } else if (rule === 'weekend_anomaly') {
        setDate(claim, '2024-12-07');
        setProvider(claim, 49);
        setVisit(
          claim,
          'M17.9',
          ['P-300'],
          8000 + random.integer(0, 100),
          'INPATIENT',
        );
      } else if (rule === 'diagnosis_procedure_mismatch') {
        setDate(claim, '2024-10-21');
        setVisit(claim, 'Z00.0', ['P-200'], 1800 + random.integer(0, 100));
      } else if (rule === 'amount_clustering') {
        setDate(claim, '2024-12-16');
        setVisit(claim, 'E11.9', ['P-700'], 47500 + random.integer(0, 2499));
      }
    }
    groups.push(group);
  }
  const phantom = groups.find((group) => group.rule === 'phantom_billing');
  for (const support of claims.slice(1794, 1800)) {
    setDate(support, '2024-11-05');
    setProvider(support, 49);
    setVisit(support, 'Z00.0', ['P-100'], 1200 + random.integer(0, 100));
    phantom.support_claim_ids.push(support.claim_id);
  }
  return { labels, injection_groups: groups };
}
