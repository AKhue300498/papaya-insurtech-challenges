import { Router } from 'express';
import { generateDataset } from '../generation/generate.js';

export const generateRoutes = Router();
generateRoutes.post('/datasets/generate', (request, response) =>
  response.json(generateDataset(request.body)),
);
