// Data shared by several screens.

import { api } from '../api/client';
import type { Holiday } from '../api/types';
import { useApi } from './useApi';

/** Public holidays of this year and next year (leave can be requested across the year boundary). */
export function useHolidays() {
  return useApi(async () => {
    const year = new Date().getFullYear();
    const [thisYear, nextYear] = await Promise.all([
      api.get<Holiday[]>('/holidays', { year }),
      api.get<Holiday[]>('/holidays', { year: year + 1 }),
    ]);
    return [...thisYear, ...nextYear];
  }, []);
}
