import { Router } from 'express';
import { evaluateScores } from '../evaluation/evaluate.js';

export const evaluateRoutes = Router();
evaluateRoutes.post('/evaluate', (request, response) =>
  response.json(evaluateScores(request.body)),
);
