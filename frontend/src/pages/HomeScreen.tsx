import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  MapPin,
  Shield,
  FileCheck,
  Clock,
  Search,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Report, Match, Claim } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { useReportFlow } from '../context/ReportFlowContext';

interface HomeScreenProps {
  onOpenReportFlow?: (type?: 'LOST' | 'FOUND') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenReportFlow: propOnOpen }) => {
  const { user, role } = useAuth();
  const { openReportFlow } = useReportFlow();
  const onOpenReportFlow = propOnOpen || openReportFlow;
  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'there';

  const [myReports, setMyReports] = useState<Report[]>([]);
  const [recentFeed, setRecentFeed] = useState<Report[]>([]);
  const [potentialMatches, setPotentialMatches] = useState<Match[]>([]);
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [totalFeedCount, setTotalFeedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      setLoading(true);
      try {
        const [myRes, feedRes, matchRes, claimRes] = await Promise.all([
          api.getReports({ my_reports: true, page_size: 10 }),
          api.getReports({ page_size: 12 }),
          api.getAllMatches(undefined, 0.45),
          api.getClaims(undefined, role === 'STUDENT'),
        ]);
        setMyReports(myRes.items);
        setRecentFeed(feedRes.items);
        setTotalFeedCount(feedRes.total);
        setPotentialMatches(matchRes);
        setPendingClaims(claimRes);
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [role]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* 1. Personalized Header (Adapts to desktop with quick links) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Hey, {firstName}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {role === 'TEACHER'
              ? 'Campus Custody & Verification Desk. Intake found items, review claims, and log physical transfers.'
              : role === 'ADMIN' || role === 'PLATFORM_ADMIN'
              ? 'Institutional Oversight & Audit Hub. Monitor campus recovery rates, storage vaults, and model diagnostics.'
              : "Let's get your belongings back. Trace items across campus with AI visual matching."}
          </p>
        </div>

        {/* Desktop Quick Search & Browse Link */}
        <div className="hidden sm:flex items-center gap-2">
          <Link
            to="/listings"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Search Directory</span>
          </Link>
          <Link
            to="/matches"
            className="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>View All Matches ({potentialMatches.length})</span>
          </Link>
        </div>
      </div>

      {/* Role-Aware Action Banner for Teachers and Administrators */}
      {role === 'TEACHER' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border border-emerald-500/30 text-white shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">Faculty Custody & Review Hub</h2>
                <p className="text-xs text-slate-300">
                  {pendingClaims.filter((c) => c.status === 'PENDING').length} claims awaiting faculty verification &bull; Direct access to campus custody ledger
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/claims"
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Review Claims ({pendingClaims.filter((c) => c.status === 'PENDING').length})</span>
              </Link>
              <Link
                to="/custody"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Storage Vaults</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {(role === 'ADMIN' || role === 'PLATFORM_ADMIN') && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border border-purple-500/30 text-white shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">Campus Institutional Oversight</h2>
                <p className="text-xs text-slate-300">
                  Platform administration, role provisioning, storage vaults & MobileNetV2 diagnostics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
              <Link
                to="/custody"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Audit Vaults</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 2. Compact Status Summary Cards (Responsive: 3 on mobile, 4 on desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <Link
          to="/my-reports"
          className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">My Items</span>
          <div className="text-base sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{myReports.length}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Submitted by you</span>
        </Link>

        <Link
          to="/matches"
          className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Matches</span>
            <Sparkles className="w-3 h-3 text-purple-500 hidden sm:block" />
          </div>
          <div className="text-base sm:text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">{potentialMatches.length}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">AI suggestions</span>
        </Link>

        <Link
          to="/claims"
          className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Claims</span>
            <FileCheck className="w-3 h-3 text-amber-500 hidden sm:block" />
          </div>
          <div className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {role === 'TEACHER' || role === 'ADMIN'
              ? pendingClaims.filter((c) => c.status === 'PENDING').length
              : pendingClaims.length}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {role === 'TEACHER' || role === 'ADMIN' ? 'Need Review' : 'In verification'}
          </span>
        </Link>

        <Link
          to="/listings"
          className="hidden sm:flex bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Directory</span>
            <Package className="w-3 h-3 text-slate-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalFeedCount || recentFeed.length}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Campus records</span>
        </Link>
      </div>

      {/* 3. Hero Action Cards (Responsive grid: 1 col on mobile, 2 or 3 cols on tablet/desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {/* Lost Item Camera Card */}
        <button
          onClick={() => onOpenReportFlow('LOST')}
          className="text-left p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-xl shadow-indigo-600/20 active:scale-98 hover:shadow-2xl hover:shadow-indigo-600/30 transition-all relative overflow-hidden group flex flex-col justify-between"
        >
          <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/20 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                AI Vision
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Lost something? Take a photo.
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1.5 leading-relaxed">
              Capture or upload a photo. Our OpenCV engine extracts color histograms & visual features to match found items instantly.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs sm:text-sm font-bold text-white group-hover:translate-x-1.5 transition-transform">
            <span>Start Quick Report</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Found Item Card */}
        <button
          onClick={() => onOpenReportFlow('FOUND')}
          className="text-left p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-lg active:scale-98 transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Shield className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Traceable Intake
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {role === 'TEACHER' ? 'Faculty Intake: Found Belonging' : 'Found an item? Report it.'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {role === 'TEACHER'
                ? 'Take physical custody of an item turned in by students, assign to a campus storage vault, and run AI auto-matching.'
                : 'Register item details and submit for faculty physical custody verification. An unbroken chain of custody begins here.'}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1.5 transition-transform">
            <span>{role === 'TEACHER' ? 'Initiate Custody Intake' : 'Register Found Belonging'}</span>
            <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </button>

        {/* Campus Custody Desk Information */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 dark:bg-slate-900/90 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>Campus Recovery Station</span>
            </div>

            <h3 className="text-lg font-extrabold tracking-tight">{user?.college?.name || 'Institutional Custody Desk'}</h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Physical item intake and verified handover takes place at the campus intake office. Present your Student/Faculty ID for verified collection.
            </p>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div><strong className="text-white">Campus Hours:</strong> Mon&ndash;Fri 8:30 AM &ndash; 5:00 PM</div>
              <div><strong className="text-white">Contact:</strong> {user?.college?.contact_email || 'campus.custody@institution.edu'}</div>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300"
            >
              <span>View Policy & Verification Guidelines</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. AI Matches: Horizontal Carousel on Mobile, Responsive Multi-Column Grid on Tablet/Desktop */}
      {potentialMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Possible matches for you
              </h2>
            </div>
            <Link to="/matches" className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 flex items-center gap-1">
              <span>See all {potentialMatches.length} matches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Responsive presentation: Snap carousel on mobile, Grid on sm/md/lg */}
          <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x -mx-3 px-3">
            {potentialMatches.map((m) => {
              const found = m.found_report_summary || {};
              const pct = Math.round(m.similarity_score * 100);

              return (
                <Link
                  key={m.id}
                  to={`/reports/${m.found_report_id}`}
                  className="w-64 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-purple-200/90 dark:border-purple-900/50 p-3 shadow-xs snap-start flex flex-col justify-between"
                >
                  <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2.5">
                    {found.primary_image_key ? (
                      <img
                        src={`/uploads/${found.primary_image_key}`}
                        alt={found.item_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs">
                      {pct}% Match
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{found.item_name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {m.matching_features?.summary}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{found.location || 'Campus'}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Inspect &rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop/Tablet Grid View */}
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {potentialMatches.slice(0, 4).map((m) => {
              const found = m.found_report_summary || {};
              const pct = Math.round(m.similarity_score * 100);

              return (
                <Link
                  key={m.id}
                  to={`/reports/${m.found_report_id}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-200/90 dark:border-purple-900/50 p-3.5 shadow-xs hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between group"
                >
                  <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                    {found.primary_image_key ? (
                      <img
                        src={`/uploads/${found.primary_image_key}`}
                        alt={found.item_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-600 text-white shadow-xs">
                      {pct}% Match
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{found.item_name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {m.matching_features?.summary}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate">{found.location || 'Campus'}</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      Inspect &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Recently Reported Campus Items: Single column on mobile, Multi-column Grid on PC */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Package className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Recently reported on campus
            </h2>
          </div>
          <Link to="/listings" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1">
            <span>Browse directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading campus item activity...</span>
          </div>
        ) : recentFeed.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <div className="font-bold text-slate-700 dark:text-slate-300">No lost or found items reported yet</div>
            <p className="mt-1">Be the first to report a lost or found belonging at your institution.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {recentFeed.slice(0, 6).map((rep) => {
              const img = rep.images.find((i) => i.is_primary) || rep.images[0];
              return (
                <Link
                  key={rep.id}
                  to={`/reports/${rep.id}`}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 relative">
                      {img ? (
                        <img
                          src={`/uploads/${img.storage_key}`}
                          alt={rep.item?.item_name || 'Report'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                            rep.report_type === 'LOST'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {rep.report_type}
                        </span>
                        <StatusBadge status={rep.status} size="sm" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate mt-1">
                        {rep.item?.item_name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{rep.location?.name || 'Campus'}</span>
                        <span>&bull;</span>
                        <span>{new Date(rep.report_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 group-hover:translate-x-1 shrink-0 transition-all" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
