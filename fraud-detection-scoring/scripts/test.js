import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? discover(`${directory}/${entry.name}`)
        : entry.name.endsWith('.test.js')
          ? [`${directory}/${entry.name}`]
          : [],
    ),
  );
  return files.flat().sort();
}

const category = process.argv[2];
if (
  category &&
  !['unit', 'contract', 'integration', 'acceptance'].includes(category)
) {
  process.stderr.write('Unknown test category\n');
  process.exitCode = 2;
} else {
  const files = await discover(category ? `tests/${category}` : 'tests');
  if (!files.length) {
    process.stderr.write(
      `No ${category ?? ''} tests implemented in this increment\n`,
    );
    process.exitCode = 2;
  } else {
    const child = spawn(process.execPath, ['--test', ...files], {
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  }
}
