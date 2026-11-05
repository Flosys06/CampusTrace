import React from 'react';
import { Sparkles, Loader2, ShieldCheck, AlertCircle, X, CheckCircle2, Layers } from 'lucide-react';
import { DetectionStatusInfo } from '../../services/detection/useReportDetection';
import { DetectedCandidate } from '../../services/vision/types';

interface EnhancedDetectionBarProps {
  hasImage: boolean;
  isLocalScanning: boolean;
  isEnhancedScanning: boolean;
  detectionStatus: DetectionStatusInfo | null;
  showConsentModal: boolean;
  candidates?: DetectedCandidate[];
  selectedCandidateId?: string | null;
  onSelectCandidate?: (candidateId: string) => void;
  onRequestEnhancedScan: () => void;
  onConfirmEnhancedScan: () => void;
  onDismissConsentModal: () => void;
}

export const EnhancedDetectionBar: React.FC<EnhancedDetectionBarProps> = ({
  hasImage,
  isLocalScanning,
  isEnhancedScanning,
  detectionStatus,
  showConsentModal,
  candidates = [],
  selectedCandidateId = null,
  onSelectCandidate,
  onRequestEnhancedScan,
  onConfirmEnhancedScan,
  onDismissConsentModal,
}) => {
  if (!hasImage) return null;

  return (
    <div className="space-y-2">
      {/* Action & Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
        {/* Status Indicator */}
        <div className="flex items-center gap-2 min-w-0">
          {isLocalScanning ? (
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Analyzing photo locally...</span>
            </div>
          ) : isEnhancedScanning ? (
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Analyzing with Cloud AI...</span>
            </div>
          ) : detectionStatus?.type === 'error' ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{detectionStatus.message}</span>
            </div>
          ) : detectionStatus?.type === 'enhanced' || detectionStatus?.type === 'cached' ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{detectionStatus.message}</span>
            </div>
          ) : detectionStatus?.type === 'abstain' ? (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{detectionStatus.message}</span>
            </div>
          ) : detectionStatus?.type === 'local' ? (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{detectionStatus.message}</span>
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Photo attached</span>
          )}
        </div>

        {/* Explicit Enhance with AI button */}
        {!isLocalScanning && (
          <button
            type="button"
            onClick={onRequestEnhancedScan}
            disabled={isEnhancedScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-600 shadow-xs transition-all active:scale-95 disabled:opacity-50 shrink-0 ml-auto"
            title="Request detailed cloud object analysis"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isEnhancedScanning ? 'Scanning...' : 'Enhance with AI'}</span>
          </button>
        )}
      </div>

      {/* Multi-Candidate Selection Chips: When multiple objects are detected in the image */}
      {!isLocalScanning && candidates.length > 1 && (
        <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-900/60 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Multiple items detected — choose the item to report:
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
              {candidates.length} candidates
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {candidates.map((cand) => {
              const isSelected = cand.id === selectedCandidateId;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold ring-2 ring-indigo-400/50'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50'
                  }`}
                >
                  <span>{cand.normalizedLabel}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {cand.categoryName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Privacy Disclosure & Consent Dialog */}
      {showConsentModal && (
        <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-slate-800 dark:text-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-150 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>External AI Analysis Disclosure</span>
            </div>
            <button
              type="button"
              onClick={onDismissConsentModal}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            This will send the selected photograph to our external cloud object detection service to identify subtle details.
            <strong> No personal information, names, or campus locations are shared.</strong>
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onDismissConsentModal}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmEnhancedScan}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze Photo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
