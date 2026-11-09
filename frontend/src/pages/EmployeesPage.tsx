import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client';
import type { Employee, Paginated, Role } from '../api/types';
import { FormModal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { AsyncBlock, EmptyState, Field, PageHeader, Pagination, StatusBadge } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { useDebounced } from '../hooks/useDebounced';
import { useSubmit } from '../hooks/useSubmit';
import { todayKey } from '../lib/dates';
import { ROLE_LABELS, formatDate } from '../lib/format';

export function EmployeesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const employees = useApi(
    () => api.list<Paginated<Employee>>('/employees', { search: debouncedSearch, status, page }),
    [debouncedSearch, status, page],
  );
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [terminating, setTerminating] = useState<Employee | null>(null);

  return (
    <>
      <PageHeader
        title="Employees"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            Add employee
          </button>
        }
      />
      <section className="card card--flush">
        <div className="toolbar">
          <input
            type="search"
            className="input toolbar__search"
            placeholder="Search name, code or email…"
            aria-label="Search employees"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="select"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="active">Active</option>
            <option value="terminated">Terminated</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        <AsyncBlock state={employees}>
          {(result) =>
            result.data.length === 0 ? (
              <EmptyState>No employees match these filters.</EmptyState>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Job</th>
                        <th>Hired</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="table__actions-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <strong>{e.full_name}</strong>
                            <div className="muted small">
                              {e.employee_code} · {e.email}
                            </div>
                          </td>
                          <td>
                            {e.job_title}
                            <div className="muted small">{e.department}</div>
                          </td>
                          <td className="nowrap">{formatDate(e.hire_date)}</td>
                          <td>{ROLE_LABELS[e.role]}</td>
                          <td>
                            <StatusBadge status={e.status} />
                            {e.termination_date && <div className="muted small">since {formatDate(e.termination_date)}</div>}
                          </td>
                          <td className="table__actions">
                            <Link
                              to={`/leave-requests?employee_id=${e.id}&name=${encodeURIComponent(e.full_name)}`}
                              className="btn btn--ghost btn--sm"
                            >
                              Leave
                            </Link>
                            {e.status === 'active' && (
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(e)}>
                                Edit
                              </button>
                            )}
                            {e.status === 'active' && e.id !== user?.id && (
                              <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => setTerminating(e)}>
                                Terminate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={result.meta} onChange={setPage} />
              </>
            )
          }
        </AsyncBlock>
      </section>

      {editing && (
        <EmployeeModal
          employee={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === user?.id}
          onClose={() => setEditing(null)}
          onSaved={employees.reload}
        />
      )}
      {terminating && <TerminateModal employee={terminating} onClose={() => setTerminating(null)} onDone={employees.reload} />}
    </>
  );
}

const EMPTY = {
  employee_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  job_title: '',
  department: '',
  hire_date: todayKey(),
  role: 'employee' as Role,
  password: '',
};

/** Add (POST /employees) and edit (PATCH /employees/{id}). */
function EmployeeModal({
  employee,
  isSelf,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(
    employee ? { ...EMPTY, ...employee, phone: employee.phone ?? '', password: '' } : EMPTY,
  );
  const { submitting, errors, run } = useSubmit();
  const toast = useToast();
  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const e = errors.fields;

  const save = async () => {
    const { employee_code, password, ...fields } = values;
    const body: Record<string, unknown> = {
      first_name: fields.first_name,
      last_name: fields.last_name,
      email: fields.email,
      phone: fields.phone || null,
      job_title: fields.job_title,
      department: fields.department,
      hire_date: fields.hire_date,
      role: fields.role,
    };
    if (!employee) body.employee_code = employee_code; // the code cannot change
    if (!employee || password) body.password = password; // optional when editing: resets the password
    const ok = await run(() => (employee ? api.patch(`/employees/${employee.id}`, body) : api.post('/employees', body)));
    if (ok) {
      toast.success(employee ? 'Employee updated.' : 'Employee added. Share the initial password with them.');
      onSaved();
      onClose();
    }
  };

  return (
    <FormModal
      title={employee ? `Edit ${employee.full_name}` : 'Add employee'}
      submitLabel={employee ? 'Save changes' : 'Add employee'}
      wide
      onClose={onClose}
      onSubmit={() => void save()}
      submitting={submitting}
      formError={errors.message}
    >
      <div className="form-grid">
        <Field label="First name" error={e.first_name} required>
          <input value={values.first_name} onChange={set('first_name')} aria-invalid={!!e.first_name} />
        </Field>
        <Field label="Last name" error={e.last_name} required>
          <input value={values.last_name} onChange={set('last_name')} aria-invalid={!!e.last_name} />
        </Field>
        <Field label="Employee code" error={e.employee_code} hint={employee ? 'Cannot be changed.' : 'e.g. EMP-0057'} required>
          <input value={values.employee_code} onChange={set('employee_code')} disabled={!!employee} aria-invalid={!!e.employee_code} />
        </Field>
        <Field label="Hire date" error={e.hire_date} required>
          <input type="date" value={values.hire_date} onChange={set('hire_date')} aria-invalid={!!e.hire_date} />
        </Field>
        <Field label="Job title" error={e.job_title} required>
          <input value={values.job_title} onChange={set('job_title')} placeholder="e.g. Backend Developer" aria-invalid={!!e.job_title} />
        </Field>
        <Field label="Department" error={e.department} required>
          <input value={values.department} onChange={set('department')} placeholder="e.g. Engineering" aria-invalid={!!e.department} />
        </Field>
        <Field label="Email" error={e.email} hint="Used to log in." required>
          <input type="email" value={values.email} onChange={set('email')} aria-invalid={!!e.email} />
        </Field>
        <Field label="Phone" error={e.phone}>
          <input value={values.phone} onChange={set('phone')} />
        </Field>
        <Field label="Role" error={e.role} hint={isSelf ? 'You cannot change your own role.' : undefined} required>
          <select value={values.role} onChange={set('role')} disabled={isSelf}>
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
          </select>
        </Field>
        <Field
          label={employee ? 'New password' : 'Initial password'}
          error={e.password}
          hint={employee ? 'Leave empty to keep the current password.' : 'At least 8 characters.'}
          required={!employee}
        >
          <input type="text" value={values.password} onChange={set('password')} autoComplete="off" aria-invalid={!!e.password} />
        </Field>
      </div>
    </FormModal>
  );
}

function TerminateModal({ employee, onClose, onDone }: { employee: Employee; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(todayKey());
  const { submitting, errors, run } = useSubmit();
  const toast = useToast();

  const save = async () => {
    if (await run(() => api.patch(`/employees/${employee.id}`, { status: 'terminated', termination_date: date }))) {
      toast.success(`${employee.full_name} has been terminated.`);
      onDone();
      onClose();
    }
  };

  return (
    <FormModal
      title={`Terminate ${employee.full_name}`}
      submitLabel="Terminate employee"
      danger
      onClose={onClose}
      onSubmit={() => void save()}
      submitting={submitting}
      formError={errors.message}
    >
      <p className="confirm-message">
        They are logged out and can no longer log in. Their pending leave, and approved leave after their last day, is cancelled.
        Their records are kept.
      </p>
      <Field label="Last day (termination date)" error={errors.fields.termination_date} required>
        <input type="date" value={date} min={employee.hire_date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormModal>
  );
}
