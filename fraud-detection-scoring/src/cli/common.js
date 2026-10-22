import { parseArgs } from 'node:util';
import { AppError, errorEnvelope } from '../errors.js';

export function options(definitions, required = []) {
  let values;
  try {
    ({ values } = parseArgs({
      options: definitions,
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new AppError('INVALID_ARGUMENTS', error.message);
  }
  for (const name of required)
    if (!values[name])
      throw new AppError('INVALID_ARGUMENTS', `--${name} is required`);
  return values;
}

export async function run(operation) {
  try {
    process.stdout.write(JSON.stringify(await operation()) + '\n');
  } catch (error) {
    const reported =
      error instanceof AppError
        ? error
        : new AppError(
            error.code ?? 'IO_ERROR',
            `File operation failed: ${error.message}`,
            [],
            500,
          );
    process.stderr.write(JSON.stringify(errorEnvelope(reported)) + '\n');
    process.exitCode = error instanceof AppError && error.status < 500 ? 2 : 1;
  }
}
