export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS[code];
    this.details = details;
  }
}

export const failure = {
  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, details),
  unauthenticated: (message = 'Sign in to continue.') => new AppError('UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have access to this resource.') =>
    new AppError('FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError('NOT_FOUND', message),
  conflict: (message: string) => new AppError('CONFLICT', message),
  tooLarge: (message = 'File is too large.') => new AppError('PAYLOAD_TOO_LARGE', message),
  mediaType: (message = 'Unsupported file type.') =>
    new AppError('UNSUPPORTED_MEDIA_TYPE', message),
  internal: (message = 'Something went wrong.') => new AppError('INTERNAL', message),
};

export function errorBody(error: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.' } } };
}
