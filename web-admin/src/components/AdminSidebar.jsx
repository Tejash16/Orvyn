import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Tag,
  CreditCard,
  Building2,
  ScrollText,
  Database,
  Handshake,
  Bell,
  Activity,
  Download,
  FolderOpen,
  LogOut,
} from 'lucide-react';
import { clearToken } from '../lib/api';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', to: '/users', icon: Users },
  { label: 'Promo Codes', to: '/promo-codes', icon: Tag },
  { label: 'Subscriptions', to: '/subscriptions', icon: CreditCard },
  { label: 'Organizations', to: '/organizations', icon: Building2 },
  { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText },
  { label: 'Database', to: '/database', icon: Database },
  { label: 'Shared DataRooms', to: '/shared-datarooms', icon: FolderOpen },
  { label: 'Collaborations', to: '/collaborations', icon: Handshake },
  { label: 'Broadcast', to: '/notifications/broadcast', icon: Bell },
  { label: 'System Health', to: '/system-health', icon: Activity },
  { label: 'Export', to: '/export', icon: Download },
];

export default function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-slate-900 text-slate-300 flex flex-col overflow-y-auto">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="text-xl font-extrabold text-emerald-400 tracking-wide">Orvyn</div>
        <p className="text-xs text-slate-500 uppercase tracking-[1.5px] mt-0.5">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-emerald-600/15 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-600/10 hover:text-red-400 transition-colors duration-150 w-full cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
