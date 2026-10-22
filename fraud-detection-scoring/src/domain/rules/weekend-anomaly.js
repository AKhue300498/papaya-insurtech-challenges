export function weekendAnomaly(claim, indexes, config) {
  const surgical = claim.procedure_codes.filter((code) =>
    config.surgical_procedures.includes(code),
  );
  if (!claim.is_weekend || !surgical.length) return {};
  const history = indexes.earlierProviderHistory(claim);
  if (!history.total)
    return {
      diagnostics: [
        {
          code: 'NO_PRIOR_HISTORY',
          message: `Provider ${claim.provider_id} has no claims earlier than ${claim.claim_date}; weekend comparison unavailable`,
        },
      ],
    };
  if (history.weekend * 20 >= history.total) return {};
  return {
    evidence: `Weekend surgery ${surgical.join(', ')} on ${claim.claim_date} for provider ${claim.provider_id}: ${history.weekend}/${history.total} earlier claims were on weekends (${((100 * history.weekend) / history.total).toFixed(6)}%, below 5%)`,
  };
}
