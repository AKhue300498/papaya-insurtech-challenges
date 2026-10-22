import { AppError } from '../errors.js';
import { evaluateScores } from '../evaluation/evaluate.js';
import { readJson, writeJson } from '../artifacts/files.js';
import { run, options } from './common.js';

await run(async () => {
  const values = options(
    {
      scores: { type: 'string' },
      labels: { type: 'string' },
      output: { type: 'string' },
      'minimum-score': { type: 'string' },
      force: { type: 'boolean', default: false },
    },
    ['scores', 'labels', 'output'],
  );
  const threshold = values['minimum-score'];
  if (threshold !== undefined && !/^\d+(?:\.\d+)?$/.test(threshold))
    throw new AppError(
      'INVALID_ARGUMENTS',
      '--minimum-score must be a decimal number greater than 0 and at most 100',
    );
  const scored = await readJson(values.scores);
  const labels = await readJson(values.labels);
  const request = { scored, labels };
  if (threshold !== undefined) request.minimum_score = Number(threshold);
  const report = evaluateScores(request);
  await writeJson(values.output, report, values.force);
  return {
    output: values.output,
    dataset_hash: report.dataset_hash,
    targets_passed: report.targets.all_passed,
  };
});
