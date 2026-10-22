import {
  mkdir,
  readFile,
  writeFile,
  rename,
  link,
  unlink,
  access,
} from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';

export async function readJson(path) {
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents.replace(/^\uFEFF/, ''));
  } catch {
    throw new AppError('INVALID_JSON', `Invalid JSON in ${path}`, [], 400);
  }
}

export async function writeJson(path, value, force = false) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
    });
    if (force) await rename(temporary, path);
    else await link(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function writeDataset(directory, artifacts, force = false) {
  const names = ['claims.json', 'labels.json', 'manifest.json'];
  for (const name of names) {
    if (!force) {
      try {
        await access(join(directory, name));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      throw new AppError(
        'OUTPUT_EXISTS',
        `Output already exists: ${name}`,
        [],
        409,
      );
    }
  }
  const manifest = join(directory, 'manifest.json');
  await unlink(manifest).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await writeJson(join(directory, 'claims.json'), artifacts.claims, force);
  await writeJson(join(directory, 'labels.json'), artifacts.labels, force);
  await writeJson(manifest, artifacts.manifest, force);
}
