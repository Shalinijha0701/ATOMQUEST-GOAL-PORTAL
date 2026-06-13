import { BarChart3, ClipboardCheck, Download, LogOut, ShieldCheck, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const roleIcon = {
  employee: Target,
  manager: ClipboardCheck,
  admin: ShieldCheck,
};

export default function Layout({ children, bootstrap, onExport }) {
  const { user, logout } = useAuth();
  const Icon = roleIcon[user.role] || Target;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AQ</div>
          <div>
            <strong>AtomQuest</strong>
            <span>Goal Portal</span>
          </div>
        </div>

        <div className="role-panel">
          <Icon size={22} />
          <div>
            <strong>{user.name}</strong>
            <span>{user.title || user.role}</span>
          </div>
        </div>

        <div className="nav-block">
          <div className="nav-item active">
            <BarChart3 size={18} />
            Workspace
          </div>
          <button className="nav-item button-reset" onClick={onExport} title="Download achievement report">
            <Download size={18} />
            Export
          </button>
        </div>

        <div className="schedule-block">
          <span>Active Cycle</span>
          <strong>{bootstrap?.activeCycle?.name || 'Not configured'}</strong>
          <small>{bootstrap?.demoMode ? 'Demo mode enabled' : 'Window enforcement active'}</small>
        </div>

        <button className="logout-button" onClick={logout}>
          <LogOut size={17} />
          Sign out
        </button>
      </aside>

      <main className="main-surface">{children}</main>
    </div>
  );
}
