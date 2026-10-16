import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Activity,
  Calendar,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Report, Match, Claim, SystemStats, ModelHealth } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();

  const [myReports, setMyReports] = useState<Report[]>([]);
  const [awaitingHandoverReports, setAwaitingHandoverReports] = useState<Report[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [adminStats, setAdminStats] = useState<SystemStats | null>(null);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (role === 'STUDENT') {
          const [repRes, matchRes, claimRes] = await Promise.all([
            api.getReports({ my_reports: true, page_size: 5 }),
            api.getAllMatches(undefined, 0.45),
            api.getClaims(undefined, true),
          ]);
          setMyReports(repRes.items);
          setRecentMatches(matchRes.slice(0, 4));
          setPendingClaims(claimRes);
        } else if (role === 'TEACHER') {
          const [intakeRes, matchRes, claimRes, custodyRes] = await Promise.all([
            api.getReports({ awaiting_handover: true, page_size: 5 }),
            api.getAllMatches('SUGGESTED', 0.5),
            api.getClaims('PENDING'),
            api.getReports({ status: 'IN_CUSTODY', page_size: 5 }),
          ]);
          setAwaitingHandoverReports(intakeRes.items);
          setRecentMatches(matchRes.slice(0, 5));
          setPendingClaims(claimRes);
          setMyReports(custodyRes.items);
        } else if (role === 'ADMIN') {
          const [stats, health, repRes] = await Promise.all([
            api.getAnalytics(),
            api.getModelHealth(),
            api.getReports({ page_size: 5 }),
          ]);
          setAdminStats(stats);
          setModelHealth(health);
          setMyReports(repRes.items);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading campus dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>CampusTrace Lost & Found Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name}!
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
              {role === 'STUDENT' &&
                `Logged in under ${user?.institutional_id} (${user?.class_name || 'Student'}). Report lost belongings, track AI suggestions, or submit ownership claims.`}
              {role === 'TEACHER' &&
                `Staff Portal (${user?.department || 'Faculty'}). Manage physical handover intake, secure vault items, review claims, and record returns.`}
              {role === 'ADMIN' &&
                `Administrative Console. Monitor campus-wide recovery metrics, security audit logs, and AI computer vision diagnostics.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/report/lost"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-xs shadow-md hover:bg-slate-50 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-rose-500" />
              Report Lost Item
            </Link>
            <Link
              to="/report/found"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              Register Found Item
            </Link>
          </div>
        </div>
      </div>

      {/* ---------------- STUDENT DASHBOARD VIEW ---------------- */}
      {role === 'STUDENT' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>My Active Reports</span>
                <Package className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{myReports.length}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Belongings reported by you</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>AI Potential Matches</span>
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-2">{recentMatches.length}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cross-matched with found reports</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>My Active Claims</span>
                <FileCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-2">{pendingClaims.length}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Under teacher review</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Recovered Items</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2">
                {myReports.filter((r) => r.status === 'RETURNED').length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Handed over safely</div>
            </div>
          </div>

          {/* AI Match Alert for Student */}
          {recentMatches.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-purple-950 dark:text-purple-200">
                      {recentMatches.length} Potential Match{recentMatches.length > 1 ? 'es' : ''} Detected by AI!
                    </h2>
                    <p className="text-xs text-purple-800 dark:text-purple-300 mt-0.5">
                      Our computer vision model found visual and metadata similarities between items lost and found.
                    </p>
                  </div>
                </div>
                <Link
                  to="/matches"
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold transition-colors whitespace-nowrap shadow-xs"
                >
                  Inspect Matches &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* My Recent Reports */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Submitted Reports</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status of your reported belongings</p>
              </div>
              <Link to="/listings" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1">
                Browse Campus Directory <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {myReports.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  You haven't reported any lost or found items yet.
                </div>
              ) : (
                myReports.map((report) => (
                  <div key={report.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      {report.images.length > 0 ? (
                        <img
                          src={`/uploads/${report.images[0].storage_key}`}
                          alt={report.item?.item_name || 'Report'}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-indigo-700">
                            {report.report_number}
                          </span>
                          <StatusBadge status={report.status} size="sm" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                          {report.item?.item_name}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{report.location?.name || 'Campus'}</span>
                          <span>&bull;</span>
                          <span>{new Date(report.report_date).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/reports/${report.id}`}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:border-slate-300 text-xs font-semibold text-slate-700 transition-colors shrink-0"
                    >
                      View Details
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TEACHER / FACULTY DASHBOARD VIEW ---------------- */}
      {role === 'TEACHER' && (
        <div className="space-y-8">
          {/* Teacher Action Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border shadow-xs ${awaitingHandoverReports.length > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Needs Physical Intake</span>
                <AlertTriangle className={`w-4 h-4 ${awaitingHandoverReports.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-2">{awaitingHandoverReports.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">Reported by finders, awaiting teacher</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Items in Custody</span>
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-700 mt-2">{myReports.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">Secured in department vault</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Claims Requiring Review</span>
                <FileCheck className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-700 mt-2">{pendingClaims.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">Student ownership proofs</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>AI Matches to Confirm</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">{recentMatches.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">Suggested match pairs</div>
            </div>
          </div>

          {/* Urgent Intake Queue */}
          {awaitingHandoverReports.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <h3 className="text-sm font-bold text-amber-950">
                    Physical Intake Queue ({awaitingHandoverReports.length} items)
                  </h3>
                </div>
                <Link to="/custody" className="text-xs font-semibold text-amber-800 hover:text-amber-950">
                  Open Intake Console &rarr;
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {awaitingHandoverReports.map((report) => (
                  <div key={report.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-700">{report.report_number}</span>
                        <StatusBadge status={report.status} size="sm" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{report.item?.item_name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Found at {report.location?.name} on {new Date(report.report_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      to={`/reports/${report.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                    >
                      Confirm Physical Intake
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Staff Navigation Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/custody"
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Custody & Vault Manager</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Assign secure storage lockers, record custody transfers to other staff, or log return handovers.
                </p>
              </div>
              <div className="text-xs font-semibold text-indigo-600 mt-4 flex items-center gap-1">
                Go to Custody &rarr;
              </div>
            </Link>

            <Link
              to="/claims"
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Review Ownership Claims</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Inspect confidential private evidence submitted by claimants and verify legitimacy before releasing items.
                </p>
              </div>
              <div className="text-xs font-semibold text-purple-600 mt-4 flex items-center gap-1">
                Review Claims &rarr;
              </div>
            </Link>

            <Link
              to="/matches"
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">AI Match Studio</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Review side-by-side computer vision similarity comparisons and verify high-confidence match suggestions.
                </p>
              </div>
              <div className="text-xs font-semibold text-emerald-600 mt-4 flex items-center gap-1">
                Explore Matches &rarr;
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ---------------- ADMINISTRATOR DASHBOARD VIEW ---------------- */}
      {role === 'ADMIN' && adminStats && (
        <div className="space-y-8">
          {/* Recovery Rate KPI Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Campus Recovery Rate</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-700 mt-2">
                {adminStats.recovery_rate_percent}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Items returned to verified owners</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Items Found</span>
                <Package className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {adminStats.total_found_reports}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {adminStats.active_in_custody} currently in custody vault
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Average Resolution</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-extrabold text-blue-700 mt-2">
                {adminStats.average_resolution_days} <span className="text-sm font-normal text-slate-500">days</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">From intake to verified return</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>AI Vision Engine</span>
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-lg font-bold text-purple-800 mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {modelHealth?.status || 'Active'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                512-dim embedding &bull; {modelHealth?.indexed_images_count || 0} indexed images
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/admin"
              className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Open Full Administration Center & Audit Trail &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
