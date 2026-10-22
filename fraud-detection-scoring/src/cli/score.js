import { scoreClaims } from '../domain/score.js';
import { readJson, writeJson } from '../artifacts/files.js';
import { run, options } from './common.js';

await run(async () => {
  const values = options(
    {
      input: { type: 'string' },
      output: { type: 'string' },
      weights: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
    ['input', 'output'],
  );
  const claims = await readJson(values.input);
  const weights = values.weights ? await readJson(values.weights) : undefined;
  const result = scoreClaims({ claims, weights });
  await writeJson(values.output, result, values.force);
  return {
    output: values.output,
    claim_count: result.results.length,
    dataset_hash: result.metadata.dataset_hash,
  };
});
