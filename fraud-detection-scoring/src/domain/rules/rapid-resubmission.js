export function rapidResubmission(claim, indexes) {
  const matches = indexes.recentClaims(claim);
  if (!matches.length) return {};
  return {
    evidence: `Member ${claim.member_id}, diagnosis ${claim.diagnosis_code}: related claims ${matches.map((item) => `${item.claim_id} (${item.elapsed} days earlier)`).join(', ')} within 7 days of ${claim.claim_date}`,
  };
}
