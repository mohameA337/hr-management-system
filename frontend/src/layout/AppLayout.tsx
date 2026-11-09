import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../lib/format';
import { navigationFor } from './navigation';

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!user) return null;

  return (
    <div className={`app ${menuOpen ? 'app--menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand">HR System</div>
        <nav aria-label="Main">
          {navigationFor(user.role).map((section) => (
            <div key={section.title} className="nav-section">
              <div className="nav-section__title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.path === '/'} className="nav-link">
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="topbar__spacer" />
          <div className="topbar__user">
            <span className="topbar__name">{user.full_name}</span>
            <span className="badge">{ROLE_LABELS[user.role]}</span>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
            Log out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <div className="backdrop" onClick={() => setMenuOpen(false)} />
    </div>
  );
}
