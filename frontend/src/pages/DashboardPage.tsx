import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <h1 className="page-title">Welcome, {user?.employee.full_name}</h1>
      <div className="card">
        <p className="muted">
          The dashboard (headcount, today&apos;s attendance, pending requests) is built in phase 7, once the other
          modules exist.
        </p>
      </div>
    </>
  );
}
