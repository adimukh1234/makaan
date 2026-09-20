import { failure } from './errors';

/** Parses a value with a zod schema and raises a typed validation error. */
export function parseOrThrow<T>(
  schema: {
    safeParse: (value: unknown) =>
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: Array<{ path: Array<string | number>; message: string }> };
        };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const first = details[0];
    throw failure.validation(
      first ? `${first.path}: ${first.message}` : 'Invalid request',
      details,
    );
  }
  return result.data;
}
