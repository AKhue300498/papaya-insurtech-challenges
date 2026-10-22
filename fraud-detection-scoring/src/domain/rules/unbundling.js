import { compareText } from '../../artifacts/canonical.js';

export function unbundling(claim, indexes, config) {
  const procedures = new Set(claim.procedure_codes);
  const matches = config.bundles
    .filter(
      (bundle) =>
        !procedures.has(bundle.bundle_code) &&
        bundle.components.every((code) => procedures.has(code)),
    )
    .sort((a, b) => compareText(a.bundle_code, b.bundle_code));
  if (!matches.length) return {};
  return {
    evidence: matches
      .map(
        (bundle) =>
          `Individual procedures ${[...bundle.components].sort(compareText).join(', ')} submitted without available bundle ${bundle.bundle_code}`,
      )
      .join('; '),
  };
}
