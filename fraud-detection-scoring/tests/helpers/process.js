import { spawn } from 'node:child_process';

export function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
