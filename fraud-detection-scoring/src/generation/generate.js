import { parse } from '../errors.js';
import { generationSchema } from '../validation/generation.js';
import { resolveConfig } from '../config.js';
import { canonicalClaims, hash } from '../artifacts/canonical.js';
import { createRandom } from './random.js';
import { createBaseline } from './baseline.js';
import { injectPatterns, patternCounts } from './inject.js';
import { verifyDataset } from './verify.js';

export function generateDataset(input = {}) {
  const { seed } = parse(generationSchema, input);
  const random = createRandom(seed);
  const config = resolveConfig();
  const claims = createBaseline(random);
  const { labels, injection_groups } = injectPatterns(claims, random, config);
  const sample = {
    schema_version: '1',
    claims: canonicalClaims(claims),
    labels,
    manifest: {
      schema_version: '1',
      generator_version: '1',
      prng: 'mulberry32-v1',
      seed,
      mapping_version: config.mapping_version,
      dataset_hash: hash(canonicalClaims(claims)),
      claim_count: claims.length,
      member_count: new Set(claims.map((claim) => claim.member_id)).size,
      provider_count: new Set(claims.map((claim) => claim.provider_id)).size,
      fraud_count: labels.filter((label) => label.is_fraud).length,
      pattern_counts: { ...patternCounts },
      injection_groups,
    },
  };
  verifyDataset(sample);
  return sample;
}
