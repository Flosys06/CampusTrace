import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Compass,
  Camera,
  Layers,
  User,
  ShieldCheck,
  Building2,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useReportFlow } from '../../context/ReportFlowContext';

interface BottomNavProps {
  onOpenReportFlow?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenReportFlow: propOnOpen }) => {
  const { role } = useAuth();
  const { openReportFlow } = useReportFlow();
  const onOpenReportFlow = propOnOpen || (() => openReportFlow('LOST'));

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
      isActive
        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom,0px)] md:hidden transition-colors">
      <div className="max-w-md mx-auto h-16 flex items-center justify-around px-2 relative">
        {/* Destination 1: Home */}
        <NavLink to="/" className={getNavLinkClass} end>
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </NavLink>

        {/* Destination 2: Explore */}
        <NavLink to="/listings" className={getNavLinkClass}>
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Explore</span>
        </NavLink>

        {/* Destination 3: Central Elevated Camera Button */}
        <div className="flex-1 flex justify-center -translate-y-4">
          <button
            onClick={onOpenReportFlow}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-800 text-white flex flex-col items-center justify-center shadow-lg shadow-indigo-600/30 ring-4 ring-white dark:ring-slate-900 active:scale-95 transition-all group"
            aria-label="Capture item photo"
          >
            <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Destination 4: Role-Aware Tab */}
        {role === 'STUDENT' && (
          <NavLink to="/my-reports" className={getNavLinkClass}>
            <Layers className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">My Items</span>
          </NavLink>
        )}

        {role === 'TEACHER' && (
          <NavLink to="/custody" className={getNavLinkClass}>
            <ShieldCheck className="w-5 h-5 mb-0.5 text-emerald-600" />
            <span className="text-[10px] tracking-tight">Queue</span>
          </NavLink>
        )}

        {(role === 'ADMIN' || role === 'PLATFORM_ADMIN') && (
          <NavLink to="/admin" className={getNavLinkClass}>
            <Building2 className="w-5 h-5 mb-0.5 text-purple-600" />
            <span className="text-[10px] tracking-tight">Admin</span>
          </NavLink>
        )}

        {/* Destination 5: Profile */}
        <NavLink to="/profile" className={getNavLinkClass}>
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Profile</span>
        </NavLink>
      </div>
    </nav>
  );
};
