import { AppError, errorEnvelope } from '../errors.js';

export function notFound(request, response, next) {
  next(new AppError('NOT_FOUND', 'Endpoint not found', [], 404));
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error.type === 'entity.too.large')
    error = new AppError('BODY_TOO_LARGE', 'JSON body exceeds 10 MiB', [], 413);
  else if (error.type === 'entity.parse.failed')
    error = new AppError('INVALID_JSON', 'Body must be valid JSON', [], 400);
  response
    .status(error instanceof AppError ? error.status : 500)
    .json(errorEnvelope(error));
}
