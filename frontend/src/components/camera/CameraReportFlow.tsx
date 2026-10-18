import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  X,
  RotateCw,
  Image as ImageIcon,
  Check,
  ArrowRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  Package,
  ChevronDown,
  Sparkles,
  Send,
  Upload
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Category, CampusLocation, StorageLocation, User, FoundMatchCandidate } from '../../types';
import { localVisionPipeline } from '../../services/vision/localVisionPipeline';
import { getExifTimeFromFile } from '../../utils/exifTime';
import { useReportDetection } from '../../services/detection/useReportDetection';
import { EnhancedDetectionBar } from '../detection/EnhancedDetectionBar';

interface CameraReportFlowProps {
  initialType?: 'LOST' | 'FOUND';
  initialFile?: File | null;
  initialLabel?: string | null;
  onClose: () => void;
  onSuccess?: (reportId: number) => void;
}

export const CameraReportFlow: React.FC<CameraReportFlowProps> = ({
  initialType = 'FOUND',
  initialFile = null,
  initialLabel = null,
  onClose,
  onSuccess,
}) => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Directly starts on the comprehensive details/intake form
  const [currentStep, setCurrentStep] = useState<'DETAILS' | 'SUCCESS'>('DETAILS');
  const [reportType, setReportType] = useState<'LOST' | 'FOUND'>(initialType);

  // Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [locationName, setLocationName] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [approximateTime, setApproximateTime] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [distinguishingFeatures, setDistinguishingFeatures] = useState('');
  const [handedOverTeacherName, setHandedOverTeacherName] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Shared detection engine: Local-first inference, manual edit protection, and explicit AI enhancement
  const {
    imageFile: capturedFile,
    imagePreview: capturedPreview,
    isLocalScanning,
    isEnhancedScanning,
    detectionStatus,
    showConsentModal,
    markFieldEdited,
    handleSelectImage,
    handleClearImage,
    requestEnhancedScan,
    confirmEnhancedScan,
    dismissConsentModal,
  } = useReportDetection({
    categories,
    initialFile,
    initialLabel,
    onApplyFields: (fields) => {
      if (fields.itemName) setItemName(fields.itemName);
      if (fields.categoryId) setCategoryId(fields.categoryId);
      if (fields.color) setColor(fields.color);
      if (fields.description) setDescription(fields.description);
    },
  });

  // Optional Live Webcam states (only opened on explicit user request)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Matches & Alerts
  const [foundMatches, setFoundMatches] = useState<FoundMatchCandidate[]>([]);
  const [isAlerting, setIsAlerting] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);



  // Teacher Handover fields
  const [finderStudentId, setFinderStudentId] = useState<number | ''>('');
  const [storageLocationId, setStorageLocationId] = useState<number | ''>('');
  const [confirmReceipt, setConfirmReceipt] = useState(true);

  // Submit / Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<{
    id: number;
    report_number: string;
    status: string;
  } | null>(null);

  // Load lookup data
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [cats, locs] = await Promise.all([
          api.getCategories(),
          api.getCampusLocations(),
        ]);
        setCategories(cats);
        setLocations(locs);
        if (cats.length > 0) setCategoryId(cats[0].id);
        if (locs.length > 0) setLocationId(locs[0].id);

        if (role === 'TEACHER' || role === 'ADMIN') {
          const [stores, stuList] = await Promise.all([
            api.getStorageLocations().catch(() => []),
            api.getUsersDirectory(undefined, 'STUDENT').catch(() => []),
          ]);
          setStorageLocations(stores);
          setStudents(stuList);
          if (stores.length > 0) setStorageLocationId(stores[0].id);
        }
      } catch (err) {
        console.error('Failed to load lookups:', err);
      }
    };
    loadLookups();
    // Pre-warm local on-device neural models in the background
    localVisionPipeline.prewarm().catch(() => {});
  }, [role]);

  // Handle preloaded label from photo scan match modal
  useEffect(() => {
    if (initialLabel) {
      setItemName(initialLabel);
    }
  }, [initialLabel]);

  // Start Camera stream when in CAMERA step
  const startCamera = async () => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unsupported:', err);
      setHasCameraAccess(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (showWebcam) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showWebcam, facingMode]);

  // Shutter Capture
  const handleCaptureShutter = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `campus_capture_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        // Auto-populate approximate time with capture time
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setApproximateTime(timeStr);

        setShowWebcam(false);
        stopCamera();
        handleSelectImage(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // Gallery Picker
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      getExifTimeFromFile(file).then((timeStr) => {
        if (timeStr) {
          setApproximateTime(timeStr);
        } else {
          setApproximateTime('');
        }
      });

      stopCamera();
      handleSelectImage(file);
    }
  };

  // Drag and drop handlers for desktop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        getExifTimeFromFile(file).then((timeStr) => {
          if (timeStr) {
            setApproximateTime(timeStr);
          } else {
            setApproximateTime('');
          }
        });

        stopCamera();
        handleSelectImage(file);
      }
    }
  };

  const handleAlertTeacherDirect = async (candidate: FoundMatchCandidate) => {
    setIsAlerting(true);
    try {
      const res = await api.alertTeacher({
        found_report_id: candidate.report_id,
        claim_notes: `Student matched item photo (${candidate.item_name}) during camera report intake.`,
      });
      setAlertSuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to alert custodian teacher.');
    } finally {
      setIsAlerting(false);
    }
  };

  // Retake / Replace photo
  const handleRetake = () => {
    handleClearImage();
    setFoundMatches([]);
    setAlertSuccess(null);
    setShowWebcam(false);
  };

  // Submit Final Report
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!itemName.trim() || !categoryId || !locationName.trim()) {
      setErrorMessage('Please fill in Item Name, Category, and Campus Location');
      return;
    }

    setIsSubmitting(true);
    try {
      const fallbackLocId = locationId || (locations.length > 0 ? locations[0].id : 1);
      const payload: any = {
        report_type: reportType,
        item_name: itemName.trim(),
        category_id: Number(categoryId),
        location_id: Number(fallbackLocId),
        location_name: locationName.trim(),
        manual_campus_location: locationName.trim(),
        handed_over_teacher_name: handedOverTeacherName.trim() || undefined,
        report_date: reportDate,
        approximate_event_time: approximateTime.trim() || undefined,
        detailed_description: description.trim() || itemName.trim(),
        visual_description: description.trim() || itemName.trim(),
        color: color.trim() || undefined,
        brand: brand.trim() || undefined,
        distinguishing_features: distinguishingFeatures.trim() || undefined,
        priority: 'NORMAL',
      };

      if (reportType === 'FOUND' && (role === 'TEACHER' || role === 'ADMIN')) {
        payload.confirm_physical_receipt = confirmReceipt;
        if (confirmReceipt && storageLocationId) {
          payload.storage_location_id = Number(storageLocationId);
        }
        if (finderStudentId) {
          payload.reported_found_by_student_id = Number(finderStudentId);
        }
      }

      // 1. Create Report
      const rep = await api.createReport(payload);

      // 2. Upload captured image
      if (capturedFile) {
        await api.uploadReportImage(rep.id, capturedFile);
      }

      setSubmittedReport({
        id: rep.id,
        report_number: rep.report_number,
        status: rep.status,
      });

      setCurrentStep('SUCCESS');
      if (onSuccess) onSuccess(rep.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard Esc listener for desktop accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        {currentStep === 'DETAILS' && (
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white shrink-0 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Shield className="w-3.5 h-3.5" />
                <span>{role === 'TEACHER' ? 'Faculty Custody Intake' : 'Found Item Intake'}</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                Unbroken Chain of Custody
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {reportType === 'FOUND'
                ? (role === 'TEACHER' ? 'Campus Faculty Custody Intake' : 'Report Found Belonging')
                : 'File Official Lost Report'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              {reportType === 'FOUND'
                ? 'Add a photo and details of the item found on campus. AI auto-detects the object to help match with the owner.'
                : 'Register details and description of your lost belonging so students and teachers can reach out.'}
            </p>
          </div>
        )}

        {/* Modal Body */}
        {currentStep === 'DETAILS' && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-slate-900 dark:text-white">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Photo Intake Section */}
            {capturedPreview ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={capturedPreview}
                      alt="Attached item"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-300 dark:border-slate-600 shrink-0 shadow-sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Photo Attached</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {capturedFile ? `${capturedFile.name} (${((capturedFile.size) / 1024).toFixed(0)} KB)` : 'Item photo ready'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 transition-colors shrink-0 ml-2"
                  >
                    Replace Photo
                  </button>
                </div>

                <EnhancedDetectionBar
                  hasImage={!!capturedPreview}
                  isLocalScanning={isLocalScanning}
                  isEnhancedScanning={isEnhancedScanning}
                  detectionStatus={detectionStatus}
                  showConsentModal={showConsentModal}
                  onRequestEnhancedScan={requestEnhancedScan}
                  onConfirmEnhancedScan={confirmEnhancedScan}
                  onDismissConsentModal={dismissConsentModal}
                />
              </div>
            ) : showWebcam ? (
              <div className="relative rounded-2xl overflow-hidden bg-black p-4 space-y-3 border border-slate-800 text-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Live Camera Viewfinder
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                      className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                      title="Flip camera"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWebcam(false)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {hasCameraAccess === false ? (
                  <div className="p-6 text-center text-white space-y-2">
                    <p className="text-xs text-rose-300">Live camera permission denied or unavailable on this device.</p>
                    <button
                      type="button"
                      onClick={() => setShowWebcam(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold hover:bg-slate-700"
                    >
                      Use File / Photo Upload Instead
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none" />
                  </div>
                )}

                {hasCameraAccess !== false && (
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCaptureShutter}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWebcam(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                />
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      Take a photo or upload an image of the found item
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Choose from files, take a photo, or drag & drop here.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose / Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowWebcam(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Use Live Webcam</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Supports JPG, PNG, WEBP &bull; AI auto-detects object & fills details
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFinalSubmit} className="space-y-4 pt-1">

            {/* Teacher Alert Success Banner */}
            {alertSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-sm font-bold">Custodian Alert Sent!</strong>
                  <p className="mt-0.5">{alertSuccess}</p>
                </div>
              </div>
            )}

            {/* Matching Items Found in Campus Custody */}
            {foundMatches.length > 0 && !alertSuccess && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{foundMatches.length} Matching Item{foundMatches.length > 1 ? 's' : ''} Already in Campus Custody!</span>
                </div>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  We found open recovered items matching your photo. Verify if this is your item:
                </p>

                <div className="space-y-2">
                  {foundMatches.map((cand) => (
                    <div
                      key={cand.report_id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {cand.primary_image_key ? (
                          <img
                            src={`/uploads/${cand.primary_image_key}`}
                            alt={cand.item_name}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{cand.item_name}</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              {Math.round(cand.confidence_score * 100)}% Match
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Custodian: <strong className="text-indigo-600 dark:text-indigo-400">{cand.handed_over_teacher_name || 'Faculty Staff'}</strong> • {cand.location_name}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAlertTeacherDirect(cand)}
                        disabled={isAlerting}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-3 h-3" />
                        <span>{isAlerting ? 'Alerting...' : 'Yes, This is Mine — Alert Teacher'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Item Title *
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  markFieldEdited('itemName');
                }}
                placeholder="e.g. Silver MacBook Air or Navy Backpack"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(Number(e.target.value));
                    markFieldEdited('categoryId');
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Campus Location *
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder={reportType === 'LOST' ? 'Enter where the item was lost' : 'Enter where the item was found'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Date {reportType === 'LOST' ? 'Lost' : 'Found'} *
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Approx Time
                </label>
                <input
                  type="text"
                  value={approximateTime}
                  onChange={(e) => setApproximateTime(e.target.value)}
                  placeholder="e.g. 10:30 AM"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    markFieldEdited('color');
                  }}
                  placeholder="e.g. Silver, Black"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Description / Circumstances
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markFieldEdited('description');
                }}
                placeholder="Where on campus, what desk or bench, specific marks..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-1.5 shadow-xs">
              <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Teacher / Staff Handed To {reportType === 'FOUND' && <span className="text-rose-500">*</span>}</span>
              </label>
              <input
                type="text"
                value={handedOverTeacherName}
                onChange={(e) => setHandedOverTeacherName(e.target.value)}
                placeholder="e.g. Prof. Sharma (CSE), Lab Incharge, or Department Office"
                required={reportType === 'FOUND'}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
              <span className="text-[11px] text-indigo-800/80 dark:text-indigo-300 block">
                Prime Custody Record: Specify which teacher, lab incharge, or faculty member received physical possession of the item.
              </span>
            </div>

            {/* Progressive Disclosure Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptionalFields(!showOptionalFields)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                <span>{showOptionalFields ? 'Hide optional details' : '+ Add Brand & Distinguishing Marks'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} />
              </button>

              {showOptionalFields && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Brand / Model</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Apple, Sony, Nike"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Distinguishing Features</label>
                    <input
                      type="text"
                      value={distinguishingFeatures}
                      onChange={(e) => setDistinguishingFeatures(e.target.value)}
                      placeholder="e.g. Scratch on corner, stickers, keychain..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Teacher Handover Section */}
            {reportType === 'FOUND' && (role === 'TEACHER' || role === 'ADMIN') && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2.5 text-xs">
                <span className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Faculty Handover & Custody Intake
                </span>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Finder (Who surrendered it)
                  </label>
                  <select
                    value={finderStudentId}
                    onChange={(e) => setFinderStudentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">-- Anonymous Finder --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name} ({st.institutional_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Vault Location *
                  </label>
                  <select
                    value={storageLocationId}
                    onChange={(e) => setStorageLocationId(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {storageLocations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.building})
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReceipt}
                    onChange={(e) => setConfirmReceipt(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    I confirm physical receipt into faculty custody.
                  </span>
                </label>
              </div>
            )}

            {/* Bottom Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  'Submitting Report...'
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit {reportType === 'LOST' ? 'Lost Report' : 'Found Report'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- STEP 4: SUCCESS CONFIRMATION ---------------- */}
      {currentStep === 'SUCCESS' && submittedReport && (
        <div className="flex-1 bg-slate-900 text-white p-6 flex flex-col justify-between max-w-md mx-auto w-full animate-in zoom-in-95 duration-200">
          <div className="text-right">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
              <Check className="w-8 h-8 stroke-3" />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight">Report Submitted</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
                Your report has been submitted. Any potential matches will appear on the report details page.
              </p>
            </div>

            {/* Confirmation Pill */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">Report Number</span>
                <span className="font-mono font-bold text-indigo-400">{submittedReport.report_number}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">Type & Status</span>
                <span className="font-semibold text-emerald-400 uppercase text-[11px]">
                  {reportType} &bull; {submittedReport.status}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <button
              onClick={() => {
                onClose();
                navigate(`/reports/${submittedReport.id}`);
              }}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              View Report Details
            </button>

            <button
              onClick={() => {
                onClose();
                navigate('/');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

