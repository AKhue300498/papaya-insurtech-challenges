export function diagnosisProcedureMismatch(claim, indexes, config) {
  const allowed = config.diagnosis_procedure_pairs[claim.diagnosis_code];
  const invalid = claim.procedure_codes.filter(
    (code) => !allowed?.includes(code),
  );
  if (!invalid.length) return {};
  const known = new Set(Object.values(config.diagnosis_procedure_pairs).flat());
  const unsupported = !allowed || invalid.some((code) => !known.has(code));
  return {
    evidence: `Diagnosis ${claim.diagnosis_code} is not associated with procedures ${invalid.join(', ')} in the demonstration mapping${unsupported ? '; unsupported codes require mapping review, not a clinical conclusion' : ''}`,
  };
}
