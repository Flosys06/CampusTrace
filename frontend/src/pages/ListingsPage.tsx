import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Sparkles,
  MapPin,
  Calendar,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Camera,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import { useReportFlow } from '../context/ReportFlowContext';
import { Report, Category, CampusLocation, ReportType, ReportStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const ListingsPage: React.FC = () => {
  const { openReportFlow } = useReportFlow();
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);

  // Filter states
  const [reportType, setReportType] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [cats, locs] = await Promise.all([
          api.getCategories(),
          api.getCampusLocations(),
        ]);
        setCategories(cats);
        setLocations(locs);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch reports on filter change
  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.getReports({
        report_type: reportType || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        location_id: locationId ? Number(locationId) : undefined,
        status: statusFilter || undefined,
        search: searchQuery.trim() || undefined,
        page,
        page_size: 9,
      });
      setReports(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType, categoryId, locationId, statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Campus Item Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Search active lost and found belongings across campus classrooms, libraries, and facilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openReportFlow('LOST')}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors active:scale-95"
            title="Report a lost belonging with camera"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Report Lost</span>
          </button>
          <button
            onClick={() => openReportFlow('FOUND')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors active:scale-95"
            title="Register a found item"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Report Found</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Type Segmented Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto scrollbar-none w-full sm:w-auto">
            <button
              onClick={() => {
                setReportType('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                reportType === ''
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Items ({totalCount})
            </button>
            <button
              onClick={() => {
                setReportType('LOST');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                reportType === 'LOST'
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lost Belongings
            </button>
            <button
              onClick={() => {
                setReportType('FOUND');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                reportType === 'FOUND'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Found Belongings
            </button>
          </div>

          {/* Keyword Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by item name, color, brand, serial..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </form>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Campus Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open / Active</option>
              <option value="IN_CUSTODY">Secured in Custody</option>
              <option value="PENDING_HANDOVER">Pending Handover</option>
              <option value="CLAIM_PENDING">Claim Under Review</option>
              <option value="RETURNED">Returned to Owner</option>
              <option value="CLOSED">Closed Reports</option>
            </select>
          </div>
        </div>
      </div>

      {/* Item Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-3">Searching campus records...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No items match your criteria</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or clearing your location and category filters.
          </p>
          <button
            onClick={() => {
              setReportType('');
              setCategoryId('');
              setLocationId('');
              setStatusFilter('');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((rep) => {
            const primaryImage = rep.images.find((img) => img.is_primary) || rep.images[0];
            return (
              <Link
                key={rep.id}
                to={`/reports/${rep.id}`}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col"
              >
                {/* Photo & Badges */}
                <div className="relative aspect-4/3 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {primaryImage ? (
                    <img
                      src={`/uploads/${primaryImage.storage_key}`}
                      alt={rep.item?.item_name || 'Report'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                      <Package className="w-10 h-10 stroke-1 mb-1" />
                      <span className="text-[10px]">No Photo Provided</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs ${
                        rep.report_type === 'LOST'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {rep.report_type}
                    </span>
                    <StatusBadge status={rep.status} size="sm" />
                  </div>

                  {/* AI matches count pill */}
                  {rep.matches_count !== undefined && rep.matches_count > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>{rep.matches_count} AI Match{rep.matches_count > 1 ? 'es' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      <span>{rep.report_number}</span>
                      {rep.item?.color && (
                        <span className="text-slate-600 dark:text-slate-300 font-sans font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                          {rep.item.color}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-1 line-clamp-1">
                      {rep.item?.item_name || 'Unspecified Item'}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {rep.detailed_description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 truncate max-w-[160px]" title={rep.location?.name}>
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      {rep.location?.name || 'Campus'}
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(rep.report_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span> ({totalCount} items)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
