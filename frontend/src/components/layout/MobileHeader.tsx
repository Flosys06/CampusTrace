import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Sun, Moon, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationDropdown } from './NotificationDropdown';
import { UserRole } from '../../types';

export const MobileHeader: React.FC = () => {
  const { user, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const getRoleBadge = (r?: UserRole | null) => {
    switch (r) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Admin
          </span>
        );
      case 'COLLEGE_ADMIN':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Dean
          </span>
        );
      case 'TEACHER':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Faculty
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Student
          </span>
        );
    }
  };

  const collegeName = user?.college?.name || user?.college_name || user?.college?.college_code || (role === 'PLATFORM_ADMIN' ? 'VTU Platform HQ' : 'Campus Institution');

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs md:hidden transition-colors">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 min-w-0 pr-2">
          <img
            src="/campustrace-logo.png"
            alt="CampusTrace Logo"
            className="w-8 h-8 rounded-lg shadow-xs shrink-0 object-cover border border-teal-500/20"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">CampusTrace</span>
              {getRoleBadge(role)}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
              <Building2 className="w-2.5 h-2.5 shrink-0 text-indigo-500" />
              <span className="truncate">{collegeName}</span>
            </div>
          </div>
        </Link>

        {/* Right Actions: Theme Toggle & Notifications */}
        <div className="flex items-center gap-1.5">
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
        </div>
      </div>
    </header>
  );
};
