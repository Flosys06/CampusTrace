import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ShieldAlert,
  Package,
  User,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Claim, ClaimStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const ClaimsPage: React.FC = () => {
  const { user, role } = useAuth();
  const isTeacherOrAdmin = role === 'TEACHER' || role === 'ADMIN';

  const [claims, setClaims] = useState<Claim[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Review Modal state
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const data = await api.getClaims(statusFilter || undefined, role === 'STUDENT');
      setClaims(data);
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [statusFilter, role]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;

    setIsSubmitting(true);
    try {
      await api.reviewClaim(selectedClaim.id, reviewDecision, reviewNotes.trim() || undefined);
      setSelectedClaim(null);
      setReviewNotes('');
      await fetchClaims();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ownership Claims & Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isTeacherOrAdmin
              ? 'Review private identifying evidence submitted by student claimants to authenticate ownership before physical release.'
              : 'Track the verification status of claims you submitted on campus found items.'}
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === '' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Claims
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'PENDING' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {/* Claims List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-3">Loading claims...</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto">
          <FileCheck className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Claims Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isTeacherOrAdmin
              ? 'There are currently no ownership claims matching this filter.'
              : 'You have not submitted any ownership claims yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const foundSummary = claim.found_report_summary || {};
            const isApproved = claim.status === 'APPROVED';

            return (
              <div
                key={claim.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                {/* Top Row: Report Number, Status, Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      Report #{foundSummary.report_number || 'TRC-F'}
                    </span>
                    <StatusBadge status={claim.status} size="sm" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {foundSummary.item_name || 'Found Belonging'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Filed: {new Date(claim.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Main Body */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Left: Thumbnail & Item Summary */}
                  <div className="flex items-start gap-3">
                    {foundSummary.primary_image_key ? (
                      <img
                        src={`/uploads/${foundSummary.primary_image_key}`}
                        alt="Item"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{foundSummary.item_name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Category: {foundSummary.category || 'General'}</p>
                      <Link
                        to={`/reports/${claim.found_report_id}`}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block"
                      >
                        Inspect Found Report &rarr;
                      </Link>
                    </div>
                  </div>

                  {/* Center: Claim Statement & Evidence */}
                  <div className="md:col-span-2 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                        Claimant Statement
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                        "{claim.claim_description}"
                      </p>
                    </div>

                    {/* Protected Private Evidence */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-0.5">
                        <Lock className="w-3 h-3" />
                        <span>Confidential Identifying Proof (Encrypted / Staff Only)</span>
                      </div>
                      <p className="text-xs text-purple-950 dark:text-purple-300 font-medium bg-purple-50/60 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-200/80 dark:border-purple-900/50 leading-relaxed font-mono">
                        {claim.private_ownership_evidence}
                      </p>
                    </div>

                    {claim.review_notes && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                        <strong>Faculty Note:</strong> {claim.review_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Claimant: <strong className="text-slate-700 dark:text-slate-300">{claim.claimant?.full_name || 'Student STU-5001'}</strong> ({claim.claimant?.institutional_id})
                  </div>

                  <div className="flex items-center gap-2">
                    {isTeacherOrAdmin && claim.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setReviewDecision('APPROVED');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Claim
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setReviewDecision('REJECTED');
                          }}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    {isTeacherOrAdmin && isApproved && foundSummary.status !== 'RETURNED' && (
                      <Link
                        to={`/reports/${claim.found_report_id}?claim_id=${claim.id}&action=return`}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                      >
                        <span>Verify & Release Item</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    {!isTeacherOrAdmin && isApproved && (
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        Ready for in-person pickup at Library Circulation Desk!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {reviewDecision === 'APPROVED' ? 'Approve Ownership Claim' : 'Reject Ownership Claim'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reviewDecision === 'APPROVED'
                ? 'Approving alerts the student to report to the campus desk with valid student ID to complete collection.'
                : 'Rejecting notifies the claimant that the submitted proof of ownership was insufficient.'}
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Review Remarks & Instructions
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewDecision === 'APPROVED'
                      ? 'e.g. Evidence matches serial number. Please collect in Room 101 between 9am-4pm.'
                      : 'e.g. Passcode or distinguishing marks did not match item specifications.'
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs ${
                    reviewDecision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Submitting Decision...' : `Confirm ${reviewDecision}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
