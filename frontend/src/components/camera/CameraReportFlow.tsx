import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  X,
  RotateCw,
  Image as ImageIcon,
  Check,
  Sparkles,
  ArrowRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  Package,
  ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Category, CampusLocation, StorageLocation, User } from '../../types';

interface CameraReportFlowProps {
  initialType?: 'LOST' | 'FOUND';
  onClose: () => void;
  onSuccess?: (reportId: number) => void;
}

export const CameraReportFlow: React.FC<CameraReportFlowProps> = ({
  initialType = 'LOST',
  onClose,
  onSuccess,
}) => {
  const { role } = useAuth();
  const navigate = useNavigate();

  // Step 1: TYPE, Step 2: CAMERA, Step 3: AI_ANALYSIS, Step 4: DETAILS, Step 5: CONFIRMATION
  const [currentStep, setCurrentStep] = useState<
    'TYPE' | 'CAMERA' | 'AI_ANALYSIS' | 'DETAILS' | 'SUCCESS'
  >('TYPE');

  const [reportType, setReportType] = useState<'LOST' | 'FOUND'>(initialType);

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);

  // Captured photo
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Suggestions
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    storage_key?: string;
    primary_color: string;
    suggested_category_id: number | null;
    suggested_category_name: string;
    suggested_item_name: string;
    suggested_description: string;
    headline: string;
  } | null>(null);

  // Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [approximateTime, setApproximateTime] = useState('12:00');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [distinguishingFeatures, setDistinguishingFeatures] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

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
  }, [role]);

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
    if (currentStep === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [currentStep, facingMode]);

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
        setCapturedFile(file);
        setCapturedPreview(URL.createObjectURL(file));
        stopCamera();
        runAiAnalysis(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // Gallery Picker
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCapturedFile(file);
      setCapturedPreview(URL.createObjectURL(file));
      stopCamera();
      runAiAnalysis(file);
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
        setCapturedFile(file);
        setCapturedPreview(URL.createObjectURL(file));
        stopCamera();
        runAiAnalysis(file);
      }
    }
  };

  // AI Analysis Step
  const runAiAnalysis = async (file: File) => {
    setCurrentStep('AI_ANALYSIS');
    setIsAnalyzing(true);
    try {
      const result = await api.analyzeImage(file);
      setAiSuggestions(result);

      // Pre-fill form fields based on AI suggestions
      setItemName(result.suggested_item_name);
      if (result.suggested_category_id) {
        setCategoryId(result.suggested_category_id);
      }
      setColor(result.primary_color);
      setDescription(result.suggested_description);
    } catch (err) {
      console.error('AI analysis fallback:', err);
      // Fallback
      setItemName('Campus Belonging');
      setAiSuggestions({
        primary_color: 'Unspecified',
        suggested_category_id: categories.length > 0 ? categories[0].id : null,
        suggested_category_name: 'Personal Item',
        suggested_item_name: 'Personal Item',
        suggested_description: 'Item photographed on campus.',
        headline: 'Item photograph ready for submission',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setCapturedFile(null);
    setCapturedPreview(null);
    setAiSuggestions(null);
    setCurrentStep('CAMERA');
  };

  // Submit Final Report
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!itemName.trim() || !categoryId || !locationId) {
      setErrorMessage('Please fill in Item Name, Category, and Campus Location');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        report_type: reportType,
        item_name: itemName.trim(),
        category_id: Number(categoryId),
        location_id: Number(locationId),
        report_date: reportDate,
        approximate_event_time: approximateTime,
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl md:max-w-2xl bg-slate-900 sm:rounded-3xl sm:border sm:border-slate-800 sm:shadow-2xl overflow-y-auto flex flex-col relative text-white">
        {/* ---------------- STEP 1: REPORT TYPE ---------------- */}
        {currentStep === 'TYPE' && (
          <div className="flex-1 flex flex-col justify-between p-6 max-w-xl mx-auto w-full text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">Camera Intake</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 my-auto">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold tracking-tight">What happened?</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Snap a photo. Our computer vision model cross-matches colors and features instantly.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setReportType('LOST');
                  setCurrentStep('CAMERA');
                }}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-rose-950 to-slate-900 border-2 border-rose-500/40 hover:border-rose-400 active:scale-98 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">I lost something</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Take a photo of a similar item or upload receipts / specs
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-rose-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => {
                  setReportType('FOUND');
                  setCurrentStep('CAMERA');
                }}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-emerald-950 to-slate-900 border-2 border-emerald-500/40 hover:border-emerald-400 active:scale-98 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">I found something</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Photograph item to initiate secure faculty custody intake
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-500">
            CampusTrace &bull; Track it. Verify it. Return it.
          </div>
        </div>
      )}

      {/* ---------------- STEP 2: CAMERA CAPTURE ---------------- */}
      {currentStep === 'CAMERA' && (
        <div className="flex-1 flex flex-col justify-between relative bg-black select-none">
          {/* Top Camera Controls */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => setCurrentStep('TYPE')}
              className="p-2.5 rounded-full bg-slate-900/60 backdrop-blur-md text-white hover:bg-slate-800"
              aria-label="Back"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-xs font-bold uppercase tracking-wider text-white/90 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
              {reportType === 'LOST' ? 'Photograph Lost Item' : 'Photograph Found Item'}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                className="p-2.5 rounded-full bg-slate-900/60 backdrop-blur-md text-white hover:bg-slate-800"
                title="Flip Camera"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Video Viewfinder */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 relative flex items-center justify-center overflow-hidden transition-colors ${
              isDragging ? 'bg-indigo-950/60 ring-2 ring-indigo-500' : ''
            }`}
          >
            {isDragging && (
              <div className="absolute inset-0 z-30 bg-indigo-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-indigo-400">
                <ImageIcon className="w-12 h-12 text-indigo-300 animate-bounce mb-2" />
                <p className="text-sm font-bold text-white">Drop photo to analyze with AI</p>
                <p className="text-xs text-indigo-200 mt-1">MobileNetV2 feature extractor will run automatically</p>
              </div>
            )}

            {hasCameraAccess === false ? (
              <div
                className={`p-8 text-center text-white space-y-4 max-w-sm rounded-2xl border-2 border-dashed transition-colors ${
                  isDragging ? 'border-indigo-400 bg-indigo-900/30' : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-indigo-400">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Live Camera Unavailable</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Camera permissions were not granted or device camera is in use. Drag & drop an image here or choose from your files:
                  </p>
                </div>
                <label className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-md active:scale-95 transition-all">
                  <ImageIcon className="w-4 h-4" />
                  Choose from Files
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Target Reticle */}
                <div className="absolute inset-x-8 inset-y-24 border-2 border-white/50 rounded-2xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <div className="flex justify-between text-white/70">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
                  </div>
                  <div className="text-center text-[11px] font-semibold text-white/90 drop-shadow-md bg-black/40 px-3 py-1 rounded-full mx-auto backdrop-blur-xs">
                    Keep the entire item in frame
                  </div>
                  <div className="flex justify-between text-white/70">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom Shutter Action Bar */}
          <div className="p-6 bg-gradient-to-t from-black to-transparent flex items-center justify-around z-20">
            {/* Gallery Picker */}
            <label className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 cursor-pointer active:scale-95 transition-transform">
              <ImageIcon className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handleGalleryUpload}
                className="hidden"
              />
            </label>

            {/* Central Shutter Button */}
            <button
              onClick={handleCaptureShutter}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1.5 active:scale-95 transition-transform shadow-2xl"
              aria-label="Capture photo"
            >
              <div className="w-full h-full bg-white rounded-full hover:bg-slate-100 transition-colors" />
            </button>

            {/* Close / Skip button */}
            <button
              onClick={() => {
                stopCamera();
                setCurrentStep('DETAILS');
              }}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900/60"
            >
              Skip Photo
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: AI ASSISTED ANALYSIS ---------------- */}
      {currentStep === 'AI_ANALYSIS' && (
        <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full text-white overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Visual Analysis
            </span>
            <button
              onClick={handleRetake}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retake
            </button>
          </div>

          {/* Image Preview with Scanning Overlay */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500/50 shadow-2xl bg-black aspect-4/3 flex items-center justify-center my-auto">
            {capturedPreview && (
              <img
                src={capturedPreview}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            )}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-purple-950/40 backdrop-blur-xs flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-bold tracking-tight">Extracting 512-dim feature vector...</span>
                <span className="text-[10px] text-purple-200 mt-0.5">Analyzing color histograms & edges</span>
              </div>
            )}
          </div>

          {/* AI Insights Card */}
          {aiSuggestions && !isAnalyzing && (
            <div className="space-y-4 my-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="bg-gradient-to-r from-purple-950 to-slate-900 border border-purple-400/40 p-4 rounded-2xl shadow-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <h3 className="text-sm font-bold text-white capitalize">
                    {aiSuggestions.headline}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                  <div className="bg-black/30 p-2 rounded-lg">
                    <span className="text-[10px] text-purple-300 block uppercase font-bold">Category</span>
                    <span className="font-semibold">{aiSuggestions.suggested_category_name}</span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg">
                    <span className="text-[10px] text-purple-300 block uppercase font-bold">Detected Color</span>
                    <span className="font-semibold">{aiSuggestions.primary_color}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed italic pt-1">
                  "{aiSuggestions.suggested_description}"
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('DETAILS')}
                  className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Looks Right (Proceed)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionalFields(true);
                    setCurrentStep('DETAILS');
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Edit Details
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- STEP 4: MINIMAL FORM DETAILS ---------------- */}
      {currentStep === 'DETAILS' && (
        <div className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col justify-between overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
            <button
              onClick={() => setCurrentStep(capturedPreview ? 'AI_ANALYSIS' : 'CAMERA')}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              &larr; Back
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {reportType === 'LOST' ? 'Lost Item Details' : 'Found Item Details'}
            </span>
            <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMessage && (
            <div className="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleFinalSubmit} className="p-5 space-y-4 max-w-md mx-auto w-full">
            {/* Small photo thumbnail pill */}
            {capturedPreview && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <img
                  src={capturedPreview}
                  alt="Captured"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Photo Attached</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Scanned via MobileNetV2 Neural Network</p>
                </div>
              </div>
            )}

            {/* AI Auto-Detection Feedback Banner */}
            {aiSuggestions && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border border-purple-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {aiSuggestions.headline || `AI Detected: ${aiSuggestions.suggested_item_name}`}
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-300">
                      Auto-filled below &bull; Modify any field before submitting
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  Editable
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Item Title *
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
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
                  onChange={(e) => setCategoryId(Number(e.target.value))}
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
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
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
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where on campus, what desk or bench, specific marks..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            {/* Progressive Disclosure Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptionalFields(!showOptionalFields)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                <span>{showOptionalFields ? 'Hide optional fields' : '+ Add Brand, Specific Time & Distinguishing Marks'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} />
              </button>

              {showOptionalFields && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Brand</label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="e.g. Apple, Sony"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Approx Time</label>
                      <input
                        type="time"
                        value={approximateTime}
                        onChange={(e) => setApproximateTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
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
                  'Submitting & Running AI Matching...'
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

      {/* ---------------- STEP 5: SUCCESS CONFIRMATION ---------------- */}
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
                CampusTrace is actively comparing your item's computer vision embedding with campus records.
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
              <Sparkles className="w-4 h-4 text-purple-300" />
              Check Potential AI Matches
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
};
