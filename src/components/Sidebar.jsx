import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/sales', label: 'Sales', icon: '🛒' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/reports', label: 'Reports', icon: '📊' },
  { path: '/profile', label: 'My Profile', icon: '👤' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🏪</span>
        <span className="sidebar-logo-text">POS System</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{icon}</span>
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
