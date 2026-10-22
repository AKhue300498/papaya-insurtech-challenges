import { createHash } from 'node:crypto';

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export function hash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function canonicalClaims(claims) {
  return claims
    .map((claim) => ({
      ...claim,
      procedure_codes: [...claim.procedure_codes].sort(compareText),
    }))
    .sort((a, b) => compareText(a.claim_id, b.claim_id));
}
