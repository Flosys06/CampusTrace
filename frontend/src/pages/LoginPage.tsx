import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Lock,
  User as UserIcon,
  Mail,
  Building,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Eye,
  EyeOff,
  GraduationCap,
  Phone,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { College } from '../types';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export const LoginPage: React.FC = () => {
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [colleges, setColleges] = useState<College[]>([]);

  // Sign In State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [selectedCollegeCode, setSelectedCollegeCode] = useState('');
  const [customCollegeCode, setCustomCollegeCode] = useState('');
  const [verifiedCollegeName, setVerifiedCollegeName] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regUsn, setRegUsn] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDepartment, setRegDepartment] = useState('');
  const [regYear, setRegYear] = useState('1');
  const [regSemester, setRegSemester] = useState('1');
  const [regPhone, setRegPhone] = useState('');

  // Password Reset State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadColleges = useCallback(async () => {
    try {
      const data = await api.getColleges();
      setColleges(data);
    } catch {
      // Fallback if network issue
    }
  }, []);

  useEffect(() => {
    loadColleges();
  }, [loadColleges]);

  const handleCollegeSelect = (code: string) => {
    if (code === 'CUSTOM') {
      setSelectedCollegeCode('');
      setVerifiedCollegeName(null);
      return;
    }
    setSelectedCollegeCode(code);
    const col = colleges.find(c => c.college_code === code);
    setVerifiedCollegeName(col ? col.name : null);
  };

  // Auto-detect college from VTU USN (e.g., 1KG21CS001 -> 1KG KSSEM)
  const handleUsnChange = (val: string) => {
    setRegUsn(val);
    const trimmed = val.trim().toUpperCase();
    if (trimmed.length >= 3 && colleges.length > 0) {
      const prefix = trimmed.slice(0, 3);
      const match = colleges.find(c => c.college_code.toUpperCase() === prefix);
      if (match) {
        setSelectedCollegeCode(match.college_code);
        setVerifiedCollegeName(match.name);
      }
    }
  };

  // Auto-detect college from email domain (e.g. user@kssem.edu.in -> 1KG KSSEM)
  const handleEmailChange = (val: string) => {
    setRegEmail(val);
    const lower = val.trim().toLowerCase();
    if (lower.includes('@') && colleges.length > 0) {
      const domain = lower.split('@')[1];
      if (domain) {
        const match = colleges.find(c => {
          if (c.domain && domain.includes(c.domain.toLowerCase())) return true;
          if (domain.includes('kssem') && c.college_code === '1KG') return true;
          if (domain.includes('rvce') && c.college_code === '1RV') return true;
          if (domain.includes('msrit') && c.college_code === '1MS') return true;
          return false;
        });
        if (match) {
          setSelectedCollegeCode(match.college_code);
          setVerifiedCollegeName(match.name);
        }
      }
    }
  };

  const handleCustomCollegeVerify = async (code: string) => {
    setCustomCollegeCode(code);
    if (!code.trim()) {
      setVerifiedCollegeName(null);
      return;
    }
    setIsVerifyingCode(true);
    try {
      const res = await api.verifyCollege(code.trim());
      if (res.valid || res.is_valid) {
        setVerifiedCollegeName(res.name);
        setSelectedCollegeCode(res.college_code);
        setError(null);
      }
    } catch {
      setVerifiedCollegeName(null);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Please provide your institutional ID / email and password.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await login(loginIdentifier.trim(), loginPassword);
      navigate('/');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : 'Login failed. Please verify your credentials.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const collegeCode = selectedCollegeCode || customCollegeCode.trim();
    if (!collegeCode) {
      setError('Please select or specify a valid institutional College ID.');
      return;
    }

    if (!regFullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (!regUsn.trim()) {
      setError('Student ID or USN is required.');
      return;
    }

    if (!regEmail.trim()) {
      setError('Institutional email address is required.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        college_code: collegeCode.toUpperCase(),
        full_name: regFullName.trim(),
        student_id_usn: regUsn.trim(),
        institutional_id: regUsn.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        department: regDepartment.trim() || undefined,
        year_of_study: regYear,
        semester: regSemester,
        phone_number: regPhone.trim() || undefined,
      });
      navigate('/');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : 'Registration failed. Please try again.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Please enter your account email address.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await forgotPassword(resetEmail.trim());
      setSuccessMsg(res.message);
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
      setResetStep(2);
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : 'Failed to request password reset token.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(resetToken.trim(), newPassword);
      setSuccessMsg('Password has been successfully reset! You can now log in.');
      setMode('LOGIN');
      setResetStep(1);
      setLoginPassword('');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : 'Failed to reset password.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-indigo-600/15 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-md active:scale-95 flex items-center gap-2 text-xs font-semibold"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
          <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 mb-6 sm:mb-8">
        <div className="inline-flex items-center justify-center mb-3.5">
          <img
            src="/campustrace-logo.png"
            alt="CampusTrace Brand Mark"
            className="w-16 h-16 rounded-2xl shadow-2xl shadow-teal-900/40 ring-4 ring-teal-500/30 object-cover"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          CampusTrace
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-400">
          Multi-Campus Lost & Found Platform with Computer Vision
        </p>
      </div>

      {/* Card Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg z-10">
        <div className="bg-white dark:bg-slate-900 py-7 px-5 sm:px-9 shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors">
          {/* Mode Navigation Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 mb-6 border border-slate-200/80 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'LOGIN'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('REGISTER'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'REGISTER'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Register Account
            </button>
            <button
              type="button"
              onClick={() => { setMode('FORGOT_PASSWORD'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'FORGOT_PASSWORD'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Institutional ID, USN, or Email
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter USN or email"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('FORGOT_PASSWORD')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="block w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-md shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  New to CampusTrace?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('REGISTER'); setError(null); }}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Register your student account
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* College Selection / Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>1. Select Your Institution</span>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    VTU Affiliated ({colleges.length} Colleges)
                  </span>
                </label>

                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedCollegeCode}
                    onChange={(e) => handleCollegeSelect(e.target.value)}
                    className="block w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="" disabled>-- Select your VTU College ({colleges.length} listed) --</option>
                    {colleges.map((col) => (
                      <option key={col.id} value={col.college_code}>
                        {col.name} [{col.college_code}] — {col.city || 'Karnataka'}
                      </option>
                    ))}
                    <option value="CUSTOM">Other / Enter VTU College Code</option>
                  </select>
                </div>

                {/* Custom College Code input if not selected */}
                {!selectedCollegeCode && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customCollegeCode}
                      onChange={(e) => handleCustomCollegeVerify(e.target.value)}
                      placeholder="Enter college code"
                      className="block w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white uppercase font-mono"
                    />
                    {isVerifyingCode && <p className="text-[10px] text-slate-400 mt-1">Verifying VTU institution code...</p>}
                  </div>
                )}

                {verifiedCollegeName && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified VTU College: {verifiedCollegeName}</span>
                  </div>
                )}
              </div>

              {/* Student Name & USN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Enter name"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    VTU Student ID / USN
                  </label>
                  <input
                    type="text"
                    value={regUsn}
                    onChange={(e) => handleUsnChange(e.target.value)}
                    placeholder="Enter USN"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="Enter email"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Mobile Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Department, Year, Semester */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="Enter dept."
                    className="block w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Year of Study
                  </label>
                  <select
                    value={regYear}
                    onChange={(e) => setRegYear(e.target.value)}
                    className="block w-full px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Semester
                  </label>
                  <select
                    value={regSemester}
                    onChange={(e) => setRegSemester(e.target.value)}
                    className="block w-full px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s.toString()}>Sem {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Create Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showRegPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Enter password"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="block w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-md shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registering Account...</span>
                  </div>
                ) : (
                  <>
                    <span>Complete Student Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORGOT / RESET PASSWORD FORM */}
          {mode === 'FORGOT_PASSWORD' && (
            <div className="space-y-4">
              {resetStep === 1 ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Enter the email address registered with your campus account. A secure password reset token will be generated.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Account Email Address
                    </label>
                    <div className="relative rounded-xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter email"
                        className="block w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Requesting Reset...' : 'Request Password Reset Token'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setResetStep(2)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Already have a reset token? Enter it here &rarr;
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-3.5">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Enter the reset token generated for your account along with your new password.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Reset Token
                    </label>
                    <div className="relative rounded-xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Enter reset token"
                        className="block w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="block w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="block w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating Password...' : 'Save New Password & Sign In'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      &larr; Back to request token
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          CampusTrace Multi-Tenant Architecture &bull; Strict Institutional Isolation
        </div>
      </div>
    </div>
  );
};
