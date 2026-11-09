import { useCallback, useState } from 'react';
import { NO_ERRORS, toFormErrors, type FormErrors } from '../lib/errors';

/** Runs a save action and turns API errors into form errors. Returns true on success. */
export function useSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setSubmitting(true);
    setErrors(NO_ERRORS);
    try {
      await action();
      return true;
    } catch (err) {
      setErrors(toFormErrors(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  /** Hide a field's error once the user changes that field. */
  const clearField = useCallback((field: string) => {
    setErrors((current) => {
      if (!(field in current.fields)) return current;
      const fields = { ...current.fields };
      delete fields[field];
      return { ...current, fields };
    });
  }, []);

  return { submitting, errors, run, clearField };
}
