import { readFileSync } from 'node:fs';
import { parse } from './errors.js';
import {
  catalogSchema,
  overridesSchema,
  weightsSchema,
} from './validation/config.js';

function load(name) {
  return JSON.parse(
    readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'),
  );
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const weights = parse(weightsSchema, load('weights'));
const catalog = parse(catalogSchema, {
  ...load('bundles'),
  diagnosis_procedure_pairs: load('diagnosis-procedures'),
  surgical_procedures: load('surgical-procedures'),
});

export function resolveConfig(overrides = {}) {
  return freeze({
    schema_version: '1',
    ...structuredClone(catalog),
    weights: { ...weights, ...parse(overridesSchema, overrides) },
  });
}
