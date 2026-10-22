export class AppError extends Error {
  constructor(code, message, details = [], status = 422) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function validationError(error) {
  return new AppError(
    'VALIDATION_ERROR',
    'Input validation failed',
    error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  );
}

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function errorEnvelope(error) {
  return {
    error: {
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message:
        error instanceof AppError
          ? error.message
          : 'Unexpected operation failure',
      details: error instanceof AppError ? error.details : [],
    },
  };
}
