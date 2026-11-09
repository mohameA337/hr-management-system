import { ApiError } from '../api/client';

export interface FormErrors {
  /** General message shown above the form. */
  message: string | null;
  /** First message per field, shown under each input. */
  fields: Record<string, string>;
}

export const NO_ERRORS: FormErrors = { message: null, fields: {} };

export function toFormErrors(err: unknown): FormErrors {
  if (err instanceof ApiError) {
    const fields = Object.fromEntries(Object.entries(err.details).map(([field, messages]) => [field, messages[0]]));
    if (err.code === 'VALIDATION_ERROR' && Object.keys(fields).length > 0) return { message: null, fields };
    return { message: err.message, fields: {} };
  }
  return { message: 'Cannot reach the server. Please try again.', fields: {} };
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Cannot reach the server. Please try again.';
}
