import React from 'react';
import { ReportStatus, ReportType, ClaimStatus, MatchStatus } from '../../types';

interface StatusBadgeProps {
  status: ReportStatus | ReportType | ClaimStatus | MatchStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (status) {
    case 'LOST':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Lost Item
        </span>
      );
    case 'FOUND':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Found Item
        </span>
      );
    case 'OPEN':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          Active / Open
        </span>
      );
    case 'PENDING_HANDOVER':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          Awaiting Teacher Intake
        </span>
      );
    case 'IN_CUSTODY':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
          Secured in Custody
        </span>
      );
    case 'CLAIM_PENDING':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          Claim Under Review
        </span>
      );
    case 'RETURNED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Returned to Owner
        </span>
      );
    case 'CLOSED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Closed
        </span>
      );
    case 'APPROVED':
    case 'CONFIRMED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
          Approved
        </span>
      );
    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 ${sizeClasses}`}>
          Rejected
        </span>
      );
    case 'PENDING':
    case 'SUGGESTED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 ${sizeClasses}`}>
          Suggested
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
