import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'espree';

function hasExplanatoryString(node) {
  if (!node || typeof node !== 'object') return false;
  if (
    node.type === 'ExpressionStatement' &&
    node.expression?.type === 'Literal' &&
    typeof node.expression.value === 'string'
  )
    return true;
  return Object.values(node).some((value) =>
    Array.isArray(value)
      ? value.some(hasExplanatoryString)
      : hasExplanatoryString(value),
  );
}

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith('.js')) {
      const tree = parse(await readFile(path, 'utf8'), {
        ecmaVersion: 'latest',
        sourceType: 'module',
        comment: true,
      });
      if (tree.comments.length)
        throw new Error(`Comments are prohibited: ${path}`);
      if (hasExplanatoryString(tree))
        throw new Error(
          `Explanatory string statements are prohibited: ${path}`,
        );
    }
  }
}

for (const directory of ['src', 'tests', 'scripts']) await check(directory);
process.stdout.write(
  'No code comments, JSDoc or explanatory string statements found\n',
);
