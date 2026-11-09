// Endpoint 9: public holidays (read-only; HR edits them in database/seeds/001_public_holidays.sql).

import { ok, type Route } from '../http';
import { currentYear } from '../helpers';

export const holidayRoutes: Route[] = [
  {
    method: 'GET',
    path: '/holidays',
    handler: ({ db, query }) => {
      const year = Number(query.get('year')) || currentYear();
      const list = db.public_holidays
        .filter((h) => h.holiday_date.startsWith(`${year}-`))
        .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
      return ok(list);
    },
  },
];
