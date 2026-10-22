import express from 'express';
import { AppError } from './errors.js';
import { routes } from './api/routes.js';
import { errorHandler, notFound } from './api/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    if (
      ['POST', 'PUT', 'PATCH'].includes(request.method) &&
      !request.is('application/json')
    )
      return next(
        new AppError('UNSUPPORTED_MEDIA_TYPE', 'Use application/json', [], 415),
      );
    next();
  });
  app.use(express.json({ limit: '10mb', strict: false }));
  app.get('/health', (request, response) =>
    response.json({ status: 'ok', schema_version: '1' }),
  );
  app.use('/api/v1', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
