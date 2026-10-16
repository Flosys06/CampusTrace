import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Package,
  Calendar,
  MapPin,
  Tag,
  Sliders,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Match, MatchStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const MatchesPage: React.FC = () => {
  const { role } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0.45);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await api.getAllMatches(statusFilter || undefined, minScore);
      setMatches(data);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [statusFilter, minScore]);

  const handleReviewMatch = async (matchId: number, decision: 'CONFIRMED' | 'REJECTED') => {
    try {
      await api.reviewMatch(matchId, decision, `Reviewed by faculty in AI Match Studio.`);
      setActionSuccess(`Match successfully marked as ${decision}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchMatches();
    } catch (err: any) {
      alert(err.message || 'Failed to review match');
    }
  };

  const isTeacherOrAdmin = role === 'TEACHER' || role === 'ADMIN';

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Computer Vision & Multimodal Scoring</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            AI Match Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Side-by-side visual and attribute cross-matching between lost reports and recovered items.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex-wrap">
          <div className="flex items-center gap-2 px-2 text-xs text-slate-600 dark:text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Min Score:</span>
            <span className="font-bold text-slate-900 dark:text-white">{Math.round(minScore * 100)}%</span>
            <input
              type="range"
              min="0.30"
              max="0.85"
              step="0.05"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-20 accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Match States</option>
            <option value="SUGGESTED">Suggested by AI</option>
            <option value="CONFIRMED">Teacher Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Matches List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-3">Evaluating potential match pairs...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto">
          <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Match Pairs Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No report pairs currently meet the {Math.round(minScore * 100)}% similarity threshold. Try lowering the score slider.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {matches.map((m) => {
            const lost = m.lost_report_summary || {};
            const found = m.found_report_summary || {};
            const scorePct = Math.round(m.similarity_score * 100);
            const isHighConfidence = scorePct >= 70;

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Score Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 dark:from-slate-800/80 via-purple-50/40 dark:via-purple-950/20 to-slate-50 dark:to-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs ${
                        isHighConfidence
                          ? 'bg-emerald-600 text-white'
                          : 'bg-purple-600 text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{scorePct}% Match Score</span>
                    </div>
                    <StatusBadge status={m.match_status} size="sm" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Engine: {m.matching_model_version}
                    </span>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2">
                    {isTeacherOrAdmin && m.match_status === 'SUGGESTED' && (
                      <>
                        <button
                          onClick={() => handleReviewMatch(m.id, 'CONFIRMED')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirm Match
                        </button>
                        <button
                          onClick={() => handleReviewMatch(m.id, 'REJECTED')}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    <Link
                      to={`/reports/${m.found_report_id}`}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Claim / Inspect Found Item</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Side-by-Side Image & Attribute Comparison */}
                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  {/* Divider Icon in Center for MD screens */}
                  <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-purple-600 text-white items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                    <Sparkles className="w-4 h-4" />
                  </div>

                  {/* LEFT: Lost Report */}
                  <div className="bg-rose-50/30 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                          Lost Report #{lost.report_number}
                        </span>
                        <Link
                          to={`/reports/${m.lost_report_id}`}
                          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Open Lost File &rarr;
                        </Link>
                      </div>

                      <div className="aspect-16/10 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3 flex items-center justify-center">
                        {lost.primary_image_key ? (
                          <img
                            src={`/uploads/${lost.primary_image_key}`}
                            alt="Lost Item"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
                            <Package className="w-5 h-5" /> No Photo
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{lost.item_name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        <span>Category: <strong className="text-slate-700 dark:text-slate-300">{lost.category}</strong></span>
                        <span>Color: <strong className="text-slate-700 dark:text-slate-300">{lost.color || 'Unspecified'}</strong></span>
                        <span>Location: <strong className="text-slate-700 dark:text-slate-300">{lost.location}</strong></span>
                        <span>Date: <strong className="text-slate-700 dark:text-slate-300">{lost.report_date}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Found Report */}
                  <div className="bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          Found Report #{found.report_number}
                        </span>
                        <Link
                          to={`/reports/${m.found_report_id}`}
                          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Open Found File &rarr;
                        </Link>
                      </div>

                      <div className="aspect-16/10 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3 flex items-center justify-center">
                        {found.primary_image_key ? (
                          <img
                            src={`/uploads/${found.primary_image_key}`}
                            alt="Found Item"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
                            <Package className="w-5 h-5" /> No Photo
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{found.item_name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        <span>Category: <strong className="text-slate-700 dark:text-slate-300">{found.category}</strong></span>
                        <span>Color: <strong className="text-slate-700 dark:text-slate-300">{found.color || 'Unspecified'}</strong></span>
                        <span>Location: <strong className="text-slate-700 dark:text-slate-300">{found.location}</strong></span>
                        <span>Date: <strong className="text-slate-700 dark:text-slate-300">{found.report_date}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Signals Breakdown Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Signals:</span>
                    <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-medium">
                      {m.matching_features?.summary}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {m.matching_features?.visual_similarity_percent !== undefined && (
                      <span>Visual Similarity: <strong>{m.matching_features.visual_similarity_percent}%</strong></span>
                    )}
                    <span>Category Match: <strong>{m.matching_features?.category_match ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
