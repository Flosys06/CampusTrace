import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  UserCheck,
  FileCheck,
  ShieldAlert,
  ArrowLeft,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  Lock,
  ExternalLink,
  ChevronRight,
  Upload,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Report, Match, CustodyRecord, Claim, StorageLocation, User } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [custodyHistory, setCustodyHistory] = useState<CustodyRecord[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [reportClaims, setReportClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimDescription, setClaimDescription] = useState('');
  const [privateEvidence, setPrivateEvidence] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Staff intake / custody modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedStorageId, setSelectedStorageId] = useState<number | ''>('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Staff return verification modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnClaimId, setReturnClaimId] = useState<number | ''>('');
  const [verificationMethod, setVerificationMethod] = useState('STUDENT_ID_CARD');
  const [returnNotes, setReturnNotes] = useState('');

  // Close / Reopen report modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('No longer needed');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rep = await api.getReportDetail(Number(id));
      setReport(rep);

      const [matchesRes, historyRes] = await Promise.all([
        api.getReportMatches(Number(id)),
        role !== 'STUDENT' ? api.getCustodyHistory(Number(id)).catch(() => []) : Promise.resolve([]),
      ]);
      setMatches(matchesRes);
      setCustodyHistory(historyRes);

      if (role === 'TEACHER' || role === 'ADMIN') {
        const [stores, claimsList] = await Promise.all([
          api.getStorageLocations().catch(() => []),
          api.getClaims({ report_id: Number(id) }).catch(() => []),
        ]);
        setStorageLocations(stores);
        setReportClaims(claimsList);
        if (stores.length > 0) setSelectedStorageId(stores[0].id);

        const claimParam = searchParams.get('claim_id');
        const approvedClaim = claimsList.find((c: Claim) => c.status === 'APPROVED');
        if (claimParam) {
          setReturnClaimId(Number(claimParam));
          if (searchParams.get('action') === 'return') {
            setShowReturnModal(true);
          }
        } else if (approvedClaim) {
          setReturnClaimId(approvedClaim.id);
        } else if (claimsList.length > 0) {
          setReturnClaimId(claimsList[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Report not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, role]);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !claimDescription.trim() || !privateEvidence.trim()) return;

    setClaimSubmitting(true);
    try {
      await api.submitClaim(report.id, {
        claim_description: claimDescription.trim(),
        private_ownership_evidence: privateEvidence.trim(),
      });
      setClaimSuccess(true);
      setShowClaimModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit claim');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleHandoverConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !selectedStorageId) return;

    try {
      await api.confirmHandover(report.id, {
        storage_location_id: Number(selectedStorageId),
        handover_notes: handoverNotes.trim() || undefined,
      });
      setShowHandoverModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm physical intake');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !returnClaimId) return;

    try {
      await api.executeReturn(report.id, {
        claim_id: Number(returnClaimId),
        verification_method: verificationMethod,
        notes: returnNotes.trim() || undefined,
      });
      setShowReturnModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Return execution failed');
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    setCloseSubmitting(true);
    try {
      await api.closeReport(report.id, {
        reason: closeReason,
        notes: closeNotes.trim() || undefined,
      });
      setShowCloseModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to close report');
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleReopenSubmit = async () => {
    if (!report) return;
    if (!window.confirm('Reopen this report? It will become active again in campus searches and AI matching.')) return;

    setReopenSubmitting(true);
    try {
      await api.reopenReport(report.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen report');
    } finally {
      setReopenSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-semibold mt-3">Loading report details...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Record Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error || 'This report may have been deleted or archived.'}</p>
        <Link to="/listings" className="mt-4 inline-block px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Back to Listings
        </Link>
      </div>
    );
  }

  const primaryImage = report.images.find((img) => img.is_primary) || report.images[0];
  const isTeacherOrAdmin = role === 'TEACHER' || role === 'ADMIN';
  const isOwner =
    user?.id === report.created_by_user_id ||
    user?.id === report.submitted_by_student_id ||
    user?.id === report.reported_lost_by_student_id ||
    user?.id === report.reported_found_by_student_id;

  const canClose = report.status !== 'RETURNED' && report.status !== 'CLOSED' && (isTeacherOrAdmin || isOwner);
  const canReopen = report.status === 'CLOSED' && (isTeacherOrAdmin || isOwner);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/listings" className="hover:text-slate-800 dark:hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
        </Link>
        <span>/</span>
        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{report.report_number}</span>
      </div>

      {/* Main Grid: Left Item Details & Photo, Right Timeline & Matching */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Header / Badges */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      report.report_type === 'LOST' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {report.report_type} ITEM
                  </span>
                  <StatusBadge status={report.status} />
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{report.report_number}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {report.item?.item_name || 'Reported Item'}
                </h1>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {report.report_type === 'FOUND' && !['RETURNED', 'CLOSED'].includes(report.status) && role === 'STUDENT' && (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4" />
                    Claim This Item
                  </button>
                )}

                {isTeacherOrAdmin && report.report_type === 'FOUND' && report.status === 'PENDING_HANDOVER' && (
                  <button
                    onClick={() => setShowHandoverModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    Confirm Physical Intake
                  </button>
                )}

                {isTeacherOrAdmin && report.report_type === 'FOUND' && !['RETURNED', 'CLOSED'].includes(report.status) && (
                  <button
                    onClick={() => setShowReturnModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & Release Return
                  </button>
                )}

                {canClose && (
                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                    title="Close this report"
                  >
                    <XCircle className="w-4 h-4 text-slate-500" />
                    Close Report
                  </button>
                )}

                {canReopen && (
                  <button
                    onClick={handleReopenSubmit}
                    disabled={reopenSubmitting}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Reopen this report"
                  >
                    <RotateCcw className={`w-4 h-4 text-blue-600 ${reopenSubmitting ? 'animate-spin' : ''}`} />
                    {reopenSubmitting ? 'Reopening...' : 'Reopen Report'}
                  </button>
                )}
              </div>
            </div>

            {/* Photo & Characteristics */}
            <div className="p-5 sm:p-6 space-y-6">
              {/* Closed Report Notice */}
              {report.status === 'CLOSED' && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        This report is closed
                      </span>
                      {report.resolved_at && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          ({new Date(report.resolved_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Reason: <strong className="text-slate-800 dark:text-slate-200">{report.resolution_type || 'Resolved'}</strong>
                      {report.resolution_notes && ` — "${report.resolution_notes}"`}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Closed reports do not appear in active student searches or generate new AI matches.
                    </p>
                  </div>
                </div>
              )}
              {primaryImage && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900/5 dark:bg-slate-950/40 max-h-96 flex items-center justify-center">
                  <img
                    src={`/uploads/${primaryImage.storage_key}`}
                    alt={report.item?.item_name || 'Item Photo'}
                    className="max-h-96 w-full object-contain"
                  />
                </div>
              )}

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Category</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{report.item?.category?.name || 'Uncategorized'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Color</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{report.item?.color || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Brand</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{report.item?.brand || 'Unbranded'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Date Event</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{new Date(report.report_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Detailed Circumstances & Description
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {report.detailed_description}
                </p>
              </div>

              {report.item?.distinguishing_features && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Distinguishing Marks & Features
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-indigo-50/50 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                    {report.item.distinguishing_features}
                  </p>
                </div>
              )}

              {/* Reporter & Staff Attribution */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Accountability & Campus Attribution
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Created By</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{report.creator?.full_name || 'System User'}</span>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{report.creator?.institutional_id}</span>
                  </div>

                  {report.receiving_teacher && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase font-bold">Receiving Faculty Member</span>
                      <span className="font-semibold text-emerald-950 dark:text-emerald-200">{report.receiving_teacher.full_name}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">{report.receiving_teacher.department}</span>
                    </div>
                  )}

                  {report.finder_student && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Finder Student</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{report.finder_student.full_name}</span>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{report.finder_student.institutional_id}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Matches & Custody Timeline */}
        <div className="space-y-6">
          {/* AI Matches Box */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-bold text-purple-950 dark:text-purple-300 uppercase tracking-wider">
                  AI Potential Matches ({matches.length})
                </h3>
              </div>
              <Link to="/matches" className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300">
                View Studio &rarr;
              </Link>
            </div>

            <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {matches.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No similar items detected above the 45% confidence threshold yet.
                </div>
              ) : (
                matches.map((m) => {
                  const targetReport = report.report_type === 'LOST' ? m.found_report_summary : m.lost_report_summary;
                  const pct = Math.round(m.similarity_score * 100);
                  return (
                    <div key={m.id} className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            pct >= 70
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                          }`}>
                            {pct}% Match
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {targetReport?.item_name || 'Item'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {m.matching_features?.summary || 'Visual and category alignment'}
                        </p>
                      </div>

                      <Link
                        to={`/reports/${report.report_type === 'LOST' ? m.found_report_id : m.lost_report_id}`}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
                        title="Compare Report"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chain of Custody History (Faculty/Staff View) */}
          {isTeacherOrAdmin && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Chain of Custody Audit
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {custodyHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No custody records logged yet.</p>
                ) : (
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100 dark:before:bg-indigo-950">
                    {custodyHistory.map((rec) => (
                      <div key={rec.id} className="relative text-xs">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {rec.new_custodian?.full_name || 'Staff Custodian'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(rec.transferred_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {rec.storage_location && (
                          <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium mt-0.5">
                            Vault: {rec.storage_location.name}
                          </div>
                        )}
                        {rec.handover_notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 italic">
                            "{rec.handover_notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {claimSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span>Your ownership claim has been submitted. Faculty custodians will verify your evidence.</span>
          <button onClick={() => setClaimSuccess(false)} className="font-bold underline text-emerald-900 dark:text-emerald-200 ml-3">
            Dismiss
          </button>
        </div>
      )}

      {/* MODAL 1: Student Claim Submission */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Submit Ownership Claim ({report.report_number})
              </h3>
              <button onClick={() => setShowClaimModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <Lock className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To recover your belonging, describe specific identifying features that are known only to you.
              This private evidence is <strong>protected</strong> and visible only to verified faculty.
            </p>

            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Claim Summary / Description *
                </label>
                <input
                  type="text"
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder="e.g. This is my Hydroflask dropped in Chemistry lab on Tuesday"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Confidential Ownership Evidence (Encrypted / Protected) *
                </label>
                <textarea
                  rows={4}
                  value={privateEvidence}
                  onChange={(e) => setPrivateEvidence(e.target.value)}
                  placeholder="Private details: e.g. Serial number, lock-screen passcode/photo, sticker hidden on inside, names in notebooks, specific keychains..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  required
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Never displayed to other students or public users.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={claimSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {claimSubmitting ? 'Submitting...' : 'Submit Claim for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Teacher Confirm Intake */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Physical Item Intake</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify receipt of item #{report.report_number} and assign to campus security vault storage.
            </p>

            <form onSubmit={handleHandoverConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Storage Vault *</label>
                <select
                  value={selectedStorageId}
                  onChange={(e) => setSelectedStorageId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  {storageLocations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.building})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Intake Notes</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Physical inspection condition notes..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Confirm Custody Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Teacher Return Verification */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verify & Hand Over Returned Item</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Perform in-person identity verification with the student collector before releasing physical item.
            </p>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Claim to Return *
                </label>
                {reportClaims.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    No claims filed for this item yet. The claimant must submit and have their ownership claim approved first.
                  </div>
                ) : (
                  <select
                    value={returnClaimId}
                    onChange={(e) => setReturnClaimId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">-- Choose Approved Claim --</option>
                    {reportClaims.map((c) => (
                      <option key={c.id} value={c.id}>
                        Claim #{c.id} • {c.claimant?.full_name || 'Student'} ({c.claimant?.institutional_id || 'ID'}) • {c.status}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">In-Person Verification Method *</label>
                <select
                  value={verificationMethod}
                  onChange={(e) => setVerificationMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="STUDENT_ID_CARD">Institutional Student ID Card</option>
                  <option value="DEVICE_PASSCODE_UNLOCK">Device Passcode / Biometric Unlock</option>
                  <option value="SERIAL_NUMBER_OR_INVOICE">Serial Number or Original Purchase Invoice</option>
                  <option value="PRIVATE_FEATURE_PROOF">Secret Identifying Mark Inspection</option>
                  <option value="GOVERNMENT_PHOTO_ID">Government Driver License / Passport</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Handover Notes</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Record badge check or student receipt remarks..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Confirm Physical Handover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Close Report Confirmation */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <XCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Close Report #{report.report_number}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Confirm resolution and update status</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
              Close this report? This report will no longer appear in active lost and found searches or generate new match suggestions. You can still view its history.
            </p>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Closure *
                </label>
                <select
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  <option value="No longer needed">No longer needed</option>
                  <option value="Item found elsewhere">Item found elsewhere</option>
                  <option value="Duplicate report">Duplicate report</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Provide context or details about the closure..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeSubmitting}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {closeSubmitting ? 'Closing...' : 'Confirm & Close Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
