export function amountClustering(claim) {
  if (claim.submitted_amount < 47500 || claim.submitted_amount >= 50000)
    return {};
  return {
    evidence: `Amount ${claim.submitted_amount} is ${((100 * claim.submitted_amount) / 50000).toFixed(6)}% of the 50000 auto-approval threshold, in the [47500, 50000) interval`,
  };
}
