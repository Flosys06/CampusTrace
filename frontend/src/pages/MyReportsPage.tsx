import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  Shield,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Package,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  FileQuestion,
  HelpCircle,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Report, Claim, Match, CustodyRecord } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

interface ExpandedTimelineData {
  matches: Match[];
  custody: CustodyRecord[];
  claims: Claim[];
  loading: boolean;
}

export const MyReportsPage: React.FC<{ onOpenReportFlow?: () => void }> = ({ onOpenReportFlow }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'REPORTS' | 'CLAIMS'>('REPORTS');
  const [filterType, setFilterType] = useState<'ALL' | 'LOST' | 'FOUND'>('ALL');
  const [reports, setReports] = useState<Report[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<Record<number, ExpandedTimelineData>>({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repsRes, claimsRes] = await Promise.all([
        api.getReports({ my_reports: true, page_size: 50 }),
        api.getClaims(undefined, true),
      ]);
      setReports(repsRes.items);
      setClaims(claimsRes);
    } catch (err) {
      console.error('Failed to load my items:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (reportId: number) => {
    if (expandedReportId === reportId) {
      setExpandedReportId(null);
      return;
    }
    setExpandedReportId(reportId);

    // If we haven't loaded timeline data yet for this report, fetch matches and custody
    if (!timelineData[reportId]) {
      setTimelineData(prev => ({
        ...prev,
        [reportId]: { matches: [], custody: [], claims: [], loading: true }
      }));
      try {
        const [matchRes, custRes] = await Promise.all([
          api.getReportMatches(reportId).catch(() => []),
          api.getCustodyHistory(reportId).catch(() => []),
        ]);
        setTimelineData(prev => ({
          ...prev,
          [reportId]: { matches: matchRes, custody: custRes, claims: [], loading: false }
        }));
      } catch {
        setTimelineData(prev => ({
          ...prev,
          [reportId]: { matches: [], custody: [], claims: [], loading: false }
        }));
      }
    }
  };

  const filteredReports = reports.filter(r => {
    if (filterType === 'ALL') return true;
    return r.report_type === filterType;
  });

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="pt-2 px-1 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">My Items</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Track submitted reports, AI matches, and recovery status
          </p>
        </div>
        {onOpenReportFlow && (
          <button
            onClick={onOpenReportFlow}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center gap-1 text-xs font-bold active:scale-95 transition-all"
            aria-label="New Report"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span>
          </button>
        )}
      </div>

      {/* Main Tab Switcher */}
      <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'REPORTS'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>My Reports ({reports.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('CLAIMS')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'CLAIMS'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>My Claims ({claims.length})</span>
        </button>
      </div>

      {/* TAB 1: REPORTS */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-3">
          {/* Subfilter Chips */}
          <div className="flex items-center gap-2 px-1 overflow-x-auto scrollbar-none pb-1">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilterType('LOST')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === 'LOST'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Lost Items ({reports.filter(r => r.report_type === 'LOST').length})
            </button>
            <button
              onClick={() => setFilterType('FOUND')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === 'FOUND'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Found Items ({reports.filter(r => r.report_type === 'FOUND').length})
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading your reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <FileQuestion className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No reports found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                You haven't filed any {filterType === 'ALL' ? '' : filterType.toLowerCase()} reports yet.
              </p>
              {onOpenReportFlow && (
                <button
                  onClick={onOpenReportFlow}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Report an item now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((report) => {
                const img = report.images.find(i => i.is_primary) || report.images[0];
                const isExpanded = expandedReportId === report.id;
                const repTimeline = timelineData[report.id];

                return (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Top Main Card */}
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 relative">
                        {img ? (
                          <img
                            src={`/uploads/${img.storage_key}`}
                            alt={report.item?.item_name || 'Item'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <span
                          className={`absolute top-1 left-1 text-[8px] font-black px-1 rounded uppercase ${
                            report.report_type === 'LOST'
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {report.report_type}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                            {report.report_number}
                          </span>
                          <StatusBadge status={report.status} size="sm" />
                        </div>

                        <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                          {report.item?.item_name}
                        </h2>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {report.location?.name || 'Campus'}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(report.report_date).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Accordion Trigger & Actions */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/80 px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => toggleExpand(report.id)}
                        className="text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Hide Timeline</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span>Show Lifecycle Timeline</span>
                          </>
                        )}
                      </button>

                      <Link
                        to={`/reports/${report.id}`}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Vertical Timeline Dropdown */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Traceable Item History
                        </div>

                        {repTimeline?.loading ? (
                          <div className="py-4 text-center">
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Verifying chain of custody records...</span>
                          </div>
                        ) : (
                          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                            {/* 1. Report Created */}
                            <div className="relative">
                              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Report Created</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Filed as {report.report_type} on {new Date(report.report_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            {/* 2. Image Processed & Vision Embedding */}
                            {report.images.length > 0 && (
                              <div className="relative">
                                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border-2 border-indigo-500 flex items-center justify-center text-indigo-600">
                                  <Sparkles className="w-3 h-3" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Image Processed</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    512-dim OpenCV vision embedding & color histogram indexed
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* 3. AI Matches Found (if any) */}
                            {repTimeline && repTimeline.matches.length > 0 && (
                              <div className="relative">
                                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/60 border-2 border-purple-500 flex items-center justify-center text-purple-600">
                                  <Sparkles className="w-3 h-3" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">
                                    {repTimeline.matches.length} AI Match{repTimeline.matches.length > 1 ? 'es' : ''} Identified
                                  </h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Top match score: {Math.round(repTimeline.matches[0].similarity_score * 100)}%
                                  </p>
                                  <Link
                                    to={`/reports/${report.id}`}
                                    className="text-[10px] font-bold text-purple-700 dark:text-purple-400 underline mt-0.5 inline-block"
                                  >
                                    Review matching items &rarr;
                                  </Link>
                                </div>
                              </div>
                            )}

                            {/* 4. Custody Handover / Teacher Receipt */}
                            {report.report_type === 'FOUND' && (
                              <div className="relative">
                                <div
                                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                    report.status !== 'PENDING_HANDOVER'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600'
                                      : 'bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-500 text-amber-600'
                                  }`}
                                >
                                  <Shield className="w-3 h-3" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {report.status !== 'PENDING_HANDOVER'
                                      ? 'Faculty Custody Confirmed'
                                      : 'Awaiting Faculty Handover'}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {report.status !== 'PENDING_HANDOVER'
                                      ? `Physically secured at ${repTimeline?.custody?.[0]?.storage_location?.name || 'Campus Locker'}`
                                      : 'Please bring the item to the Campus Lost & Found desk'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* 5. Return / Resolution */}
                            {report.status === 'RETURNED' && (
                              <div className="relative">
                                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 flex items-center justify-center text-white shadow-xs">
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Item Returned</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Ownership verified via institutional ID and released to claimant
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS */}
      {activeTab === 'CLAIMS' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading your claims...</p>
            </div>
          ) : claims.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-slate-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No ownership claims</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                When you see a found item that matches your lost belongings, you can submit an ownership claim.
              </p>
              <Link
                to="/listings"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                Browse found items &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                      Claim #{claim.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        claim.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : claim.status === 'REJECTED'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Claim Statement</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {claim.claim_description}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Filed On:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {claim.reviewer && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 dark:text-slate-500">Reviewed By:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{claim.reviewer.full_name}</span>
                      </div>
                    )}
                    {claim.review_notes && (
                      <div className="pt-1 text-[10px] text-slate-600 dark:text-slate-400 italic">
                        "{claim.review_notes}"
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex justify-end">
                    <Link
                      to={`/reports/${claim.found_report_id}`}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>View Found Item Report</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
