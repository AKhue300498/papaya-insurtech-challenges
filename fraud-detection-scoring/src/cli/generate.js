import { AppError } from '../errors.js';
import { run, options } from './common.js';
import { generateDataset } from '../generation/generate.js';
import { writeDataset } from '../artifacts/files.js';

await run(async () => {
  const values = options(
    {
      seed: { type: 'string' },
      out: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
    ['out'],
  );
  if (values.seed !== undefined && !/^\d+$/.test(values.seed))
    throw new AppError(
      'INVALID_ARGUMENTS',
      '--seed must be an unsigned 32-bit decimal integer',
    );
  const sample = generateDataset(
    values.seed === undefined ? {} : { seed: Number(values.seed) },
  );
  await writeDataset(values.out, sample, values.force);
  return {
    output: values.out,
    seed: sample.manifest.seed,
    claim_count: sample.claims.length,
    fraud_count: sample.manifest.fraud_count,
    dataset_hash: sample.manifest.dataset_hash,
  };
});
