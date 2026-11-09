import { useState } from 'react';
import { api } from '../api/client';
import type { Holiday } from '../api/types';
import { AsyncBlock, EmptyState, PageHeader } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { parseDateKey, todayKey } from '../lib/dates';
import { formatDate } from '../lib/format';

export function HolidaysPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const holidays = useApi(() => api.get<Holiday[]>('/holidays', { year }), [year]);
  const today = todayKey();

  return (
    <>
      <PageHeader
        title="Public holidays"
        subtitle="These days are not working days and are never counted as leave."
        actions={
          <select className="select" aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />
      <section className="card card--flush">
        <AsyncBlock state={holidays}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState>No public holidays for {year}.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Holiday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((h) => (
                      <tr key={h.id} className={h.holiday_date < today ? 'table__row--muted' : undefined}>
                        <td className="nowrap">{formatDate(h.holiday_date)}</td>
                        <td>{parseDateKey(h.holiday_date).toLocaleDateString('en-US', { weekday: 'long' })}</td>
                        <td>{h.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </AsyncBlock>
      </section>
    </>
  );
}
