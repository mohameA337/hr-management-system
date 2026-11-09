import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireHr } from './auth/guards';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { NotFoundPage } from './pages/ErrorPages';
import { HolidaysPage } from './pages/HolidaysPage';
import { LeaveRequestsPage } from './pages/LeaveRequestsPage';
import { LoginPage } from './pages/LoginPage';
import { MyLeavePage } from './pages/MyLeavePage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                {/* Everyone */}
                <Route index element={<DashboardPage />} />
                <Route path="my-leave" element={<MyLeavePage />} />
                <Route path="holidays" element={<HolidaysPage />} />

                {/* HR only */}
                <Route element={<RequireHr />}>
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="leave-requests" element={<LeaveRequestsPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
