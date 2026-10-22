import { groupKey } from '../indexes.js';

export function duplicateClaim(claim, indexes) {
  const matches = indexes.duplicates.get(
    groupKey(
      claim.member_id,
      claim.provider_id,
      claim.claim_date,
      claim.diagnosis_code,
    ),
  );
  if (matches.length <= 1) return {};
  return {
    evidence: `Member ${claim.member_id}, provider ${claim.provider_id}, date ${claim.claim_date}, diagnosis ${claim.diagnosis_code} match claims ${matches
      .filter((item) => item.claim_id !== claim.claim_id)
      .map((item) => item.claim_id)
      .join(', ')}`,
  };
}
