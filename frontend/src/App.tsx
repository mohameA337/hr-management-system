import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './layout/AppLayout';
import { navigation } from './layout/navigation';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/ErrorPages';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

// Screens that are built replace their placeholder here, keyed by path.
const pages: Record<string, ReactNode> = {
  '/': <DashboardPage />,
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {navigation
                .flatMap((section) => section.items)
                .map((item) => (
                  <Route key={item.path} element={<RequireRole roles={item.roles} />}>
                    <Route
                      path={item.path}
                      element={pages[item.path] ?? <PlaceholderPage title={item.label} phase={item.phase} />}
                    />
                  </Route>
                ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
