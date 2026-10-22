import { groupKey } from '../indexes.js';

export function phantomBilling(claim, indexes) {
  const count = indexes.providerDays.get(
    groupKey(claim.provider_id, claim.claim_date),
  );
  if (count <= 30) return {};
  return {
    evidence: `Provider ${claim.provider_id} submitted ${count} claims on ${claim.claim_date}, exceeding the daily limit of 30`,
  };
}
