export function upcoding(claim, indexes) {
  const matches = [];
  const diagnostics = [];
  for (const procedure of claim.procedure_codes) {
    const cohort = indexes.cohorts.get(procedure);
    if (cohort.count < 2 || cohort.sd === 0) {
      diagnostics.push({
        code: cohort.count < 2 ? 'INSUFFICIENT_SAMPLES' : 'ZERO_VARIANCE',
        message: `Procedure ${procedure}: ${cohort.count} cohort claims, standard deviation ${cohort.sd}; no upcoding comparison available`,
      });
    } else if (claim.submitted_amount > cohort.mean + 2 * cohort.sd) {
      matches.push(
        `Submitted amount ${claim.submitted_amount} for procedure ${procedure} is ${((claim.submitted_amount - cohort.mean) / cohort.sd).toFixed(6)} standard deviations above mean ${cohort.mean.toFixed(6)} (population standard deviation ${cohort.sd.toFixed(6)}, ${cohort.count} claims)`,
      );
    }
  }
  return {
    evidence: matches.length ? matches.join('; ') : undefined,
    diagnostics,
  };
}
