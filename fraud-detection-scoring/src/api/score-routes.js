import { Router } from 'express';
import { resolveConfig } from '../config.js';
import { scoreClaims } from '../domain/score.js';

export const scoreRoutes = Router();
scoreRoutes.get('/config', (request, response) =>
  response.json(resolveConfig()),
);
scoreRoutes.post('/score', (request, response) =>
  response.json(scoreClaims(request.body)),
);
