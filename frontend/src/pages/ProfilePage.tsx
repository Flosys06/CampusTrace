import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Bell,
  LogOut,
  Building,
  Edit3,
  Package,
  FileText,
  Sun,
  Moon,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { NotificationItem, Report, Claim, UserRole } from '../types';

export const ProfilePage: React.FC = () => {
  const { user, role, logout, updateProfile } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [userClaims, setUserClaims] = useState<Claim[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.phone_number || '');
  const [editDepartment, setEditDepartment] = useState(user?.department || '');
  const [editYear, setEditYear] = useState(user?.year_of_study ? String(user.year_of_study) : '1');
  const [editSemester, setEditSemester] = useState(user?.semester ? String(user.semester) : '1');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editPrivacy, setEditPrivacy] = useState(user?.privacy_hide_contact ?? true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Active Tab for Student Activity
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'CLAIMS' | 'NOTIFICATIONS'>('REPORTS');

  const loadNotifications = useCallback(async () => {
    try {
      const notes = await api.getNotifications();
      setNotifications(notes);
    } catch {
      // Ignore notification load errors
    }
  }, []);

  const loadUserActivity = useCallback(async () => {
    try {
      const [reportsData, claimsData] = await Promise.all([
        api.getReports({ my_reports: true, page_size: 20 }),
        api.getClaims({ my_claims_only: true })
      ]);
      setUserReports(reportsData.items);
      setUserClaims(claimsData);
    } catch {
      // Ignore activity load errors
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUserActivity();
  }, [loadNotifications, loadUserActivity]);

  const handleOpenEditModal = () => {
    if (user) {
      setEditFullName(user.full_name || '');
      setEditPhone(user.phone_number || '');
      setEditDepartment(user.department || '');
      setEditYear(user.year_of_study ? String(user.year_of_study) : '1');
      setEditSemester(user.semester ? String(user.semester) : '1');
      setEditBio(user.bio || '');
      setEditPrivacy(user.privacy_hide_contact ?? true);
    }
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);
    setEditSubmitting(true);
    try {
      await updateProfile({
        full_name: editFullName.trim(),
        phone_number: editPhone.trim() || undefined,
        department: editDepartment.trim() || undefined,
        year_of_study: editYear,
        semester: editSemester,
        bio: editBio.trim() || undefined,
        privacy_hide_contact: editPrivacy
      });
      setEditSuccess('Profile details updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1200);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const getRoleBadge = (r?: UserRole | null) => {
    switch (r) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Platform Administrator
          </span>
        );
      case 'COLLEGE_ADMIN':
        return (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Institutional Dean
          </span>
        );
      case 'TEACHER':
        return (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Faculty / Custody Officer
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Enrolled Student
          </span>
        );
    }
  };

  // Activity stats calculation
  const lostCount = userReports.filter(r => r.report_type === 'LOST').length;
  const foundCount = userReports.filter(r => r.report_type === 'FOUND').length;
  const resolvedCount = userReports.filter(r => r.status === 'RETURNED' || r.status === 'CLOSED').length;
  const activeCount = userReports.length - resolvedCount;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Student Profile & Settings
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Institutional identity, lost & found history, and privacy preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenEditModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Column (ID Card + Settings), Right Column (Activity Overview) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1/3): Digital Identity Card & App Preferences */}
        <div className="lg:col-span-1 space-y-5">
          {/* Digital Institutional ID Card */}
          <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-indigo-200">
                  {user?.college?.college_code || 'CAMPUS ID'}
                </span>
              </div>
              {getRoleBadge(role)}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{user?.full_name}</h2>
              <p className="text-xs text-indigo-200 font-mono">{user?.email}</p>
              {user?.bio && (
                <p className="text-xs text-slate-300 pt-1 italic line-clamp-2">"{user.bio}"</p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  USN / Student ID
                </div>
                <div className="font-mono font-bold text-white mt-0.5 truncate">
                  {user?.student_id_usn || user?.institutional_id || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Department
                </div>
                <div className="font-semibold text-white mt-0.5 truncate">
                  {user?.department || 'General'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Year & Semester
                </div>
                <div className="font-medium text-indigo-200 mt-0.5">
                  Year {user?.year_of_study || 1} &bull; Sem {user?.semester || 1}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Institution
                </div>
                <div className="font-medium text-indigo-200 mt-0.5 truncate">
                  {user?.college?.name || 'Authorized Campus'}
                </div>
              </div>
            </div>

            {/* Privacy indicator */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Phone Privacy:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                user?.privacy_hide_contact
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}>
                {user?.privacy_hide_contact ? 'Hidden from public' : 'Visible to finders'}
              </span>
            </div>
          </div>

          {/* System Settings & Theme Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Application Preferences
            </h3>

            {/* Theme Toggle Button Row */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Theme Mode</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Currently set to <span className="font-semibold capitalize">{theme}</span> mode
                  </div>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors shadow-2xs active:scale-95"
              >
                Switch
              </button>
            </div>

            {/* Institution Isolation Info */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tenant Isolation Active</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Your listings, searches, and matches are strictly bound to <strong>{user?.college?.name || 'your institution'}</strong>. Cross-college leakage is blocked by backend middleware.
              </p>
            </div>

            {/* Sign Out Action */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out of Campus Account'}</span>
            </button>
          </div>
        </div>

        {/* Right Column (2/3): Dynamic Activity Overview (Reports, Claims, Notifications) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Real Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Reported Lost</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{lostCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Reported Found</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{foundCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Claims Filed</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{userClaims.length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Active Items</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{activeCount}</div>
            </div>
          </div>

          {/* Activity Section Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-3 gap-2">
              <button
                onClick={() => setActiveTab('REPORTS')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'REPORTS'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>My Reports ({userReports.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('CLAIMS')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'CLAIMS'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>My Claims ({userClaims.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('NOTIFICATIONS')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'NOTIFICATIONS'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications ({unreadCount > 0 ? `${unreadCount} new` : notifications.length})</span>
              </button>
            </div>

            <div className="p-5">
              {/* TAB 1: REPORTS */}
              {activeTab === 'REPORTS' && (
                <div>
                  {userReports.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
                        <Package className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No lost or found items reported yet</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        When you lose an item on campus or find a belonging, report it using the camera intake to track its recovery.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userReports.map((report) => (
                        <Link
                          key={report.id}
                          to={`/reports/${report.id}`}
                          className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              report.report_type === 'LOST'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}>
                              {report.report_type}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {report.item?.item_name || 'Reported Belonging'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                #{report.report_number} &bull; {report.report_date}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {report.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CLAIMS */}
              {activeTab === 'CLAIMS' && (
                <div>
                  {userClaims.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No ownership claims submitted yet</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        If you spot your lost item in the Found listings, submit a claim with private verification evidence for staff inspection.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userClaims.map((claim) => (
                        <div
                          key={claim.id}
                          className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Claim on Found Item #{claim.found_report_summary?.report_number || claim.found_report_id}
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              claim.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : claim.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {claim.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{claim.claim_description}</p>
                          {claim.review_notes && (
                            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 italic">
                              Faculty note: {claim.review_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS */}
              {activeTab === 'NOTIFICATIONS' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Notifications Activity
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No notifications yet. You will be alerted when someone matches or updates your reports.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-2xl border text-xs transition-colors ${
                            n.is_read
                              ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              : 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 font-medium text-slate-900 dark:text-white'
                          }`}
                        >
                          <div className="font-bold">{n.title}</div>
                          <div className="mt-0.5">{n.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Update Profile Details</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Year of Study
                  </label>
                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Semester
                  </label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s.toString()}>Sem {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Bio / Notes
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  placeholder="Tell campus members about your major, dorm, or interests..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Privacy Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPrivacy}
                    onChange={(e) => setEditPrivacy(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Hide personal phone number from public item listings
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      When checked, students can only contact you through institutional claims and official notifications.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
