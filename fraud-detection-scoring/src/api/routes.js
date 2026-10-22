import { Router } from 'express';
import { scoreRoutes } from './score-routes.js';
import { generateRoutes } from './generate-routes.js';
import { evaluateRoutes } from './evaluate-routes.js';

export const routes = Router();
routes.use(scoreRoutes);
routes.use(generateRoutes);
routes.use(evaluateRoutes);
