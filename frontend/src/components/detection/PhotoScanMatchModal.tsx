import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  X,
  Search,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Package,
  Calendar,
  MapPin,
  Send,
  Eye,
  ArrowRight,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FoundMatchCandidate, ScanMatchResponse, AlertTeacherResponse } from '../../types';

interface PhotoScanMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReportFlow?: (
    type?: 'LOST' | 'FOUND',
    preloadedFile?: File | null,
    preloadedLabel?: string | null
  ) => void;
}

export const PhotoScanMatchModal: React.FC<PhotoScanMatchModalProps> = ({
  isOpen,
  onClose,
  onOpenReportFlow,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanMatchResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Selected candidate to alert teacher
  const [selectedCandidate, setSelectedCandidate] = useState<FoundMatchCandidate | null>(null);
  const [claimNotes, setClaimNotes] = useState('');
  const [isAlerting, setIsAlerting] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState<AlertTeacherResponse | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setScanError('Image must be under 10MB');
      return;
    }
    setSelectedFile(file);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
    setScanResult(null);
    setScanError(null);
    setSelectedCandidate(null);
    setAlertSuccess(null);
    setAlertError(null);
    runScan(file);
  };

  const runScan = async (file: File) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await api.scanFoundMatches(file);
      setScanResult(res);
    } catch (err: any) {
      console.error('Photo scan error:', err);
      setScanError(err.message || 'Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAlertTeacher = async () => {
    if (!selectedCandidate) return;
    setIsAlerting(true);
    setAlertError(null);
    try {
      const res = await api.alertTeacher({
        found_report_id: selectedCandidate.report_id,
        claim_notes: claimNotes.trim() || `Verified ownership via photo scan match (${selectedCandidate.item_name}).`,
      });
      setAlertSuccess(res);
    } catch (err: any) {
      console.error('Alert teacher error:', err);
      setAlertError(err.message || 'Failed to send alert to custodian teacher.');
    } finally {
      setIsAlerting(false);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setScanResult(null);
    setScanError(null);
    setSelectedCandidate(null);
    setAlertSuccess(null);
    setAlertError(null);
    setClaimNotes('');
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white shrink-0 relative">
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Private AI Scan</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
              Not Published Globally
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Find Your Lost Belonging by Photo
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Select a photo of your lost item from your gallery. We scan open campus reports to verify if a teacher or custodian has it. If no match is found, you can immediately issue an official lost report with this photo.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Success Notification View */}
          {alertSuccess && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Teacher Alert Dispatched!
                </h3>
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-semibold mt-1">
                  {alertSuccess.message}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800/60 text-left space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Retrieval Instructions
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  {alertSuccess.pickup_instructions}
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Claim Reference ID: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{alertSuccess.claim_id}</span> • Report: <span className="font-mono font-bold">#{alertSuccess.report_number}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Alert Confirmation View (When candidate selected) */}
          {!alertSuccess && selectedCandidate && (
            <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Confirm Match & Alert Faculty Custodian</span>
                </h3>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                >
                  Back to matches
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{selectedCandidate.item_name}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round(selectedCandidate.confidence_score * 100)}% Match
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Faculty Custodian:{' '}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedCandidate.handed_over_teacher_name || 'Campus Faculty'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Location: {selectedCandidate.location_name} • Found on: {selectedCandidate.report_date}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Private Ownership Notes / Identifying Marks (Optional):
                </label>
                <textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="e.g. Small scratch on top corner, blue sticker on bottom, brand name..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {alertError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{alertError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAlertTeacher}
                  disabled={isAlerting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAlerting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Alerting Teacher...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Alert to {selectedCandidate.handed_over_teacher_name || 'Teacher'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Main Upload / Results View */}
          {!alertSuccess && !selectedCandidate && (
            <>
              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  imagePreview
                    ? 'border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {imagePreview ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <img
                      src={imagePreview}
                      alt="Uploaded lost item"
                      className="w-24 h-24 object-cover rounded-xl shadow-md border border-slate-200 dark:border-slate-700"
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Gallery Photo Loaded</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block"
                      >
                        Choose another photo from gallery
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Choose photo from your gallery or files
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                        Select an existing picture of your lost item from your phone or computer.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse Gallery / Files</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Supports JPG, PNG, WEBP &bull; Privately scanned against open campus items
                    </p>
                  </div>
                )}
              </div>

              {/* Helpful fallback if student has no photo */}
              {!imagePreview && onOpenReportFlow && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenReportFlow('LOST');
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium underline transition-colors"
                  >
                    Don't have a photo in your gallery? File lost report manually &rarr;
                  </button>
                </div>
              )}

              {/* Scanning Progress */}
              {isScanning && (
                <div className="p-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-center space-y-3 animate-pulse">
                  <div className="w-10 h-10 border-3 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Detecting Object & Scanning Campus Custody...
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Identifying item via API Ninjas and matching against open reports
                    </p>
                  </div>
                </div>
              )}

              {/* Scan Error */}
              {scanError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Scan Detection Summary Banner */}
              {scanResult && !isScanning && (
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Detected: <strong className="text-slate-900 dark:text-white">{scanResult.detected_label}</strong> ({Math.round(scanResult.detected_confidence * 100)}%)
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Color: <strong className="text-slate-800 dark:text-slate-200">{scanResult.detected_color}</strong>
                    </span>
                  </div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                    {scanResult.matches_count} {scanResult.matches_count === 1 ? 'Found Item Matches' : 'Found Items Match'}
                  </div>
                </div>
              )}

              {/* Match Results List */}
              {scanResult && !isScanning && (
                <div className="space-y-3">
                  {scanResult.matches_count > 0 ? (
                    <>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Matching Items in Campus Custody
                      </div>

                      <div className="space-y-3">
                        {scanResult.matches.map((candidate) => (
                          <div
                            key={candidate.report_id}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xs transition-all space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                              <div className="flex items-start gap-3.5">
                                {candidate.primary_image_key ? (
                                  <img
                                    src={`/uploads/${candidate.primary_image_key}`}
                                    alt={candidate.item_name}
                                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <Package className="w-8 h-8" />
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                      {candidate.item_name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      {Math.round(candidate.confidence_score * 100)}% Match
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {candidate.location_name}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {candidate.report_date}
                                    </span>
                                    {candidate.color && (
                                      <span>Color: <strong>{candidate.color}</strong></span>
                                    )}
                                  </div>

                                  {/* Custodian Faculty Banner */}
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 mt-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>Faculty Custodian: <strong>{candidate.handed_over_teacher_name || 'Campus Faculty'}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Alert Teacher Action Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedCandidate(candidate)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                              >
                                <span>Yes, this is my item — Alert Teacher</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Match Reasons */}
                            {candidate.match_reasons && candidate.match_reasons.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-2">
                                {candidate.match_reasons.map((reason, idx) => (
                                  <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                    ✓ {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Option to file lost report if none of the found matches is the user's item */}
                      {onOpenReportFlow && (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mt-4">
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              None of these match your belonging?
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Issue an official lost report automatically using this photo.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const f = selectedFile;
                              const lbl = scanResult.detected_label;
                              handleClose();
                              onOpenReportFlow('LOST', f, lbl);
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs whitespace-nowrap active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                          >
                            <span>Issue Lost Report with this Photo</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                        <Package className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          No Open Found Items Matched Yet
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                          We didn't find any open campus reports matching this <strong className="text-slate-800 dark:text-slate-200">{scanResult.detected_label}</strong> ({scanResult.detected_color}).
                        </p>
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-2 max-w-md mx-auto">
                          You can immediately take this photo from your gallery to issue an official lost report.
                        </p>
                      </div>

                      {onOpenReportFlow && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const f = selectedFile;
                              const lbl = scanResult.detected_label;
                              handleClose();
                              onOpenReportFlow('LOST', f, lbl);
                            }}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-200" />
                            <span>Issue Lost Report with this Photo</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
