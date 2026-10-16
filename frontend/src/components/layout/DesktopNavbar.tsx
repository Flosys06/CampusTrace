import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Shield,
  Search,
  Sparkles,
  ShieldCheck,
  Building2,
  Camera,
  Plus,
  LogOut,
  Layers,
  Home,
  User as UserIcon,
  GraduationCap,
  Briefcase,
  ShieldAlert,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useReportFlow } from '../../context/ReportFlowContext';
import { NotificationDropdown } from './NotificationDropdown';
import { UserRole } from '../../types';

export const DesktopNavbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { openReportFlow } = useReportFlow();

  const getRoleBadge = (r?: UserRole | null) => {
    switch (r) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Admin
          </span>
        );
      case 'COLLEGE_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Dean
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Faculty
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Student
          </span>
        );
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
      isActive
        ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  const collegeDisplay = user?.college?.name || user?.college_name || user?.college?.college_code || (role === 'PLATFORM_ADMIN' ? 'VTU Platform HQ' : 'Campus Institution');

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs hidden md:block transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img
            src="/campustrace-logo.png"
            alt="CampusTrace Logo"
            className="w-10 h-10 rounded-xl shadow-md shadow-teal-900/20 object-cover border border-teal-500/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">CampusTrace</span>
              {getRoleBadge(role)}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <Building2 className="w-3 h-3 text-indigo-500" />
              <span>{collegeDisplay}</span>
            </div>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="flex items-center gap-1 lg:gap-2">
          <NavLink to="/" className={navLinkClass} end>
            <Home className="w-4 h-4" />
            <span>Home</span>
          </NavLink>

          <NavLink to="/listings" className={navLinkClass}>
            <Search className="w-4 h-4" />
            <span>Explore</span>
          </NavLink>

          <NavLink to="/my-reports" className={navLinkClass}>
            <Layers className="w-4 h-4" />
            <span>My Items</span>
          </NavLink>

          <NavLink to="/matches" className={navLinkClass}>
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>AI Matches</span>
          </NavLink>

          {(role === 'TEACHER' || role === 'COLLEGE_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'ADMIN') && (
            <NavLink to="/custody" className={navLinkClass}>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Custody Queue</span>
            </NavLink>
          )}

          {(role === 'COLLEGE_ADMIN' || role === 'PLATFORM_ADMIN' || role === 'ADMIN') && (
            <NavLink to="/admin" className={navLinkClass}>
              <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Admin Portal</span>
            </NavLink>
          )}
        </nav>

        {/* Right: Quick Report Actions, Theme Toggle, Notifications, Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Camera Reporting Buttons */}
          <button
            onClick={() => openReportFlow('LOST')}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            title="Report a lost item with camera"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Report Lost</span>
          </button>

          <button
            onClick={() => openReportFlow('FOUND')}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            title="Report a found item"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Found</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>

          <NotificationDropdown />

          {/* Profile / Logout */}
          <div className="flex items-center gap-2 pl-1">
            <Link
              to="/profile"
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
              title="Profile & Settings"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
            </Link>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
