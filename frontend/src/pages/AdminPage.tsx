import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  Package,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Search,
  FileText,
  Sliders,
  Building2,
  HardDrive
} from 'lucide-react';
import { api } from '../services/api';
import { SystemStats, ModelHealth, AuditLog, User } from '../types';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<'AUDIT' | 'HEALTH' | 'USERS'>('AUDIT');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes, logsRes, usersRes] = await Promise.all([
        api.getAnalytics(),
        api.getModelHealth(),
        api.getAuditLogs(actionFilter || undefined),
        api.getUsersDirectory(),
      ]);
      setStats(statsRes);
      setModelHealth(healthRes);
      setAuditLogs(logsRes);
      setUsers(usersRes);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [actionFilter]);

  if (loading && !stats) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-semibold mt-3">Loading administrative console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Campus Administrator Control Center</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Security Audits, System Analytics & AI Diagnostics
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Complete campus recovery oversight, append-only security logs, and computer vision status.
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Recovery Rate</span>
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 block">
              {stats.recovery_rate_percent}%
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Items returned to owners</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Found Items</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {stats.total_found_reports}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{stats.active_in_custody} in vault</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lost Reports</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
              {stats.total_lost_reports}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Filed by students</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Returned Items</span>
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 block">
              {stats.total_returned_items}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Completed handovers</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Avg Resolution</span>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1 block">
              {stats.average_resolution_days}d
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Intake to return</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Registered Users</span>
            <span className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 mt-1 block">
              {stats.total_students + stats.total_teachers}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{stats.total_teachers} staff custodians</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'AUDIT'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HEALTH')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'HEALTH'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Computer Vision Engine Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'USERS'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({users.length})</span>
        </button>
      </div>

      {/* TAB 1: Audit Log */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Append-Only Security Audit Trail
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Every login, report change, custody transfer, and verified return is permanently logged.
              </p>
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">All Audit Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="REPORT_CREATED">REPORT_CREATED</option>
              <option value="IMAGE_UPLOADED">IMAGE_UPLOADED</option>
              <option value="HANDOVER_CONFIRMED">HANDOVER_CONFIRMED</option>
              <option value="CUSTODY_TRANSFERRED">CUSTODY_TRANSFERRED</option>
              <option value="CLAIM_SUBMITTED">CLAIM_SUBMITTED</option>
              <option value="CLAIM_APPROVED">CLAIM_APPROVED</option>
              <option value="ITEM_RETURNED">ITEM_RETURNED</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Event Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{log.entity_type}</td>
                    <td className="py-2.5 px-4 text-indigo-700 dark:text-indigo-400 font-bold">{log.entity_id || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-[11px] font-sans max-w-xs truncate">
                      {log.change_metadata ? JSON.stringify(log.change_metadata) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Model Health */}
      {activeTab === 'HEALTH' && modelHealth && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Computer Vision Subsystem Status</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-scale spatial pyramid color histograms & Sobel gradient descriptor pipeline
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              {modelHealth.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Engine Model</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">{modelHealth.engine_name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{modelHealth.version}</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Feature Vector Size</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-1 block">
                {modelHealth.feature_dimensions}-Dimensional
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">L2-Normalized Cosine Metric</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Average Inference</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 block">
                {modelHealth.last_inference_time_ms} ms
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Real-time image feature extraction</span>
            </div>
          </div>

          <div className="bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-300 space-y-1">
            <p className="font-bold">Multimodal AI Matching Formula</p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-mono text-[11px]">
              Composite Score = (0.60 * Cosine(Visual_A, Visual_B)) + (0.40 * [Category(0.40) + Color(0.25) + Date(0.20) + Location(0.15)])
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: Users */}
      {activeTab === 'USERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Authorized Institutional Directory
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Institutional ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department / Class</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">{u.institutional_id}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{u.full_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u.department || u.class_name || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
