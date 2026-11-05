import { useState, useRef, useCallback } from 'react';
import { Category, NinjaDetectionResult } from '../../types';
import { localVisionPipeline, StaleInferenceError } from '../vision/localVisionPipeline';
import {
  DetectedCandidate,
  AbstentionReason,
  BoundingBox,
  RelevanceTier,
} from '../vision/types';
import { taxonomyEngine } from '../vision/taxonomyEngine';
import { assessObjectRelevance } from '../vision/relevanceScorer';
import { api } from '../api';

export type DetectionStatusType = 'local' | 'enhanced' | 'cached' | 'abstain' | 'error' | null;

export interface DetectionStatusInfo {
  type: DetectionStatusType;
  message: string;
}

export interface UseReportDetectionProps {
  categories: Category[];
  initialFile?: File | null;
  initialLabel?: string | null;
  onApplyFields: (fields: {
    itemName?: string;
    categoryId?: number;
    color?: string;
    description?: string;
  }) => void;
  onEnhancedComplete?: (file: File, result: NinjaDetectionResult) => Promise<void> | void;
}

export const useReportDetection = ({
  categories,
  initialFile = null,
  initialLabel = null,
  onApplyFields,
  onEnhancedComplete,
}: UseReportDetectionProps) => {
  // Attached image state
  const [imageFile, setImageFile] = useState<File | null>(initialFile);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Multi-candidate detection state
  const [candidates, setCandidates] = useState<DetectedCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [hasReportableObject, setHasReportableObject] = useState<boolean>(false);
  const [abstentionReason, setAbstentionReason] = useState<AbstentionReason | undefined>(undefined);

  // User manual edits tracking: any field in this set will NEVER be overwritten
  const manuallyEditedFields = useRef<Set<string>>(new Set());

  // Scanning & status states
  const [isLocalScanning, setIsLocalScanning] = useState(false);
  const [isEnhancedScanning, setIsEnhancedScanning] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatusInfo | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Active request guard for cancelling stale runs
  const activeRequestId = useRef<number>(0);

  // Mark a field as manually edited so subsequent detection does not overwrite it
  const markFieldEdited = useCallback((field: string) => {
    manuallyEditedFields.current.add(field);
  }, []);

  const hasFieldBeenEdited = useCallback((field: string) => {
    return manuallyEditedFields.current.has(field);
  }, []);

  // Safe image preview cleanup
  const cleanupPreview = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  // Apply candidate selection to form fields (respecting manual edits)
  const applyCandidateToForm = useCallback(
    (candidate: DetectedCandidate) => {
      const updates: {
        itemName?: string;
        categoryId?: number;
        color?: string;
        description?: string;
      } = {};

      const dominantColor = candidate.visualAttributes?.primaryColor || 'Unknown';
      const factualTitle = taxonomyEngine.generateFactualTitle(
        candidate.normalizedLabel,
        dominantColor
      );
      const factualDesc = taxonomyEngine.generateFactualDescription(
        candidate.normalizedLabel,
        dominantColor,
        candidate.defaultDescriptor
      );

      if (!manuallyEditedFields.current.has('itemName') && factualTitle) {
        updates.itemName = factualTitle;
      }

      if (!manuallyEditedFields.current.has('categoryId') && candidate.categoryId) {
        updates.categoryId = candidate.categoryId;
      }

      if (
        !manuallyEditedFields.current.has('color') &&
        dominantColor &&
        dominantColor !== 'Unknown'
      ) {
        updates.color = dominantColor;
      }

      if (!manuallyEditedFields.current.has('description') && factualDesc) {
        updates.description = factualDesc;
      }

      if (Object.keys(updates).length > 0) {
        onApplyFields(updates);
      }
    },
    [onApplyFields]
  );

  // User explicitly selects one of multiple detected candidates
  const selectCandidate = useCallback(
    (candidateId: string) => {
      const found = candidates.find((c) => c.id === candidateId);
      if (!found) return;

      setSelectedCandidateId(candidateId);
      applyCandidateToForm(found);

      setDetectionStatus({
        type: 'local',
        message: `Selected: ${found.normalizedLabel}`,
      });
    },
    [candidates, applyCandidateToForm]
  );

  // Execute on-device local vision analysis (ZERO external API calls)
  const runLocalDetection = useCallback(
    async (file: File, reqId: number) => {
      setIsLocalScanning(true);
      setDetectionStatus(null);
      setCandidates([]);
      setSelectedCandidateId(null);

      try {
        const result = await localVisionPipeline.analyzeImage(file, categories);
        // Stale check
        if (reqId !== activeRequestId.current) return;

        setCandidates(result.candidates);
        setHasReportableObject(result.hasReportableObject);
        setAbstentionReason(result.abstentionReason);

        if (result.hasReportableObject && result.primaryCandidate) {
          setSelectedCandidateId(result.primaryCandidate.id);
          applyCandidateToForm(result.primaryCandidate);

          setDetectionStatus({
            type: 'local',
            message:
              result.candidates.length > 1
                ? `${result.candidates.length} items detected — primary suggested`
                : 'Details suggested from photo',
          });
        } else {
          // Principled abstention: do not fill fake items
          setDetectionStatus({
            type: 'abstain',
            message: 'No distinct item detected. Enter details below or enhance with AI.',
          });
        }
      } catch (err: any) {
        if (!(err instanceof StaleInferenceError)) {
          console.warn('Local on-device analysis note:', err);
        }
      } finally {
        if (reqId === activeRequestId.current) {
          setIsLocalScanning(false);
        }
      }
    },
    [categories, applyCandidateToForm]
  );

  // Handle image file selection (Upload / Drop / Camera Shutter)
  const handleSelectImage = useCallback(
    (file: File) => {
      // Validate format
      const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validMimes.includes(file.type)) {
        setDetectionStatus({
          type: 'error',
          message: 'Unsupported format. Please select a JPG, PNG, or WEBP image.',
        });
        return;
      }

      // Validate size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setDetectionStatus({
          type: 'error',
          message: 'Image exceeds maximum 10MB size limit.',
        });
        return;
      }

      const reqId = ++activeRequestId.current;

      cleanupPreview();
      const previewUrl = URL.createObjectURL(file);
      setImageFile(file);
      setImagePreview(previewUrl);
      setDetectionStatus(null);
      setIsEnhancedScanning(false);
      setShowConsentModal(false);

      // Start local detection on-device only
      runLocalDetection(file, reqId);
    },
    [cleanupPreview, runLocalDetection]
  );

  const handleClearImage = useCallback(() => {
    activeRequestId.current++;
    cleanupPreview();
    setImageFile(null);
    setImagePreview(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setHasReportableObject(false);
    setAbstentionReason(undefined);
    setDetectionStatus(null);
    setIsLocalScanning(false);
    setIsEnhancedScanning(false);
    setShowConsentModal(false);
  }, [cleanupPreview]);

  // User clicked "Enhance with AI" -> Prompt for explicit privacy consent
  const requestEnhancedScan = useCallback(() => {
    if (!imageFile || isEnhancedScanning) return;
    setShowConsentModal(true);
  }, [imageFile, isEnhancedScanning]);

  const dismissConsentModal = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  // Calculate Intersection over Union between two normalized or pixel bounding boxes
  const calculateIoU = (
    boxA: [number, number, number, number],
    boxB: [number, number, number, number]
  ): number => {
    const [ax, ay, aw, ah] = boxA;
    const [bx, by, bw, bh] = boxB;

    const x1 = Math.max(ax, bx);
    const y1 = Math.max(ay, by);
    const x2 = Math.min(ax + aw, bx + bw);
    const y2 = Math.min(ay + ah, by + bh);

    const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (interArea <= 0) return 0;

    const areaA = aw * ah;
    const areaB = bw * bh;
    return interArea / (areaA + areaB - interArea);
  };

  // User confirmed consent -> Call backend API Ninjas proxy with multi-model fusion
  const confirmEnhancedScan = useCallback(async () => {
    if (!imageFile) return;
    setShowConsentModal(false);
    setIsEnhancedScanning(true);
    setDetectionStatus(null);

    const reqId = activeRequestId.current;

    try {
      const res: NinjaDetectionResult = await api.ninjaDetectObjects(imageFile);

      // Stale check
      if (reqId !== activeRequestId.current) return;

      if (!res.detected_objects || res.detected_objects.length === 0) {
        setDetectionStatus({
          type: 'abstain',
          message: 'Cloud AI did not detect distinct belongings in the photo.',
        });
        return;
      }

      // Multi-Model Result Fusion: Reconcile Cloud detections with existing Local candidates
      const fusedCandidates = [...candidates];

      for (let ci = 0; ci < res.detected_objects.length; ci++) {
        const cloudItem = res.detected_objects[ci];
        const cloudLabel = cloudItem.label.toLowerCase().trim();

        // 1. Map to canonical taxonomy
        const taxResult = taxonomyEngine.mapModelLabel(cloudItem.label, categories);

        // 2. Synthesize or normalize bounding box
        let normBox: [number, number, number, number] = [0.1, 0.1, 0.8, 0.8];
        if (cloudItem.bounding_box) {
          const rawB = cloudItem.bounding_box;
          normBox = [
            rawB.x1,
            rawB.y1,
            Math.max(0.01, rawB.x2 - rawB.x1),
            Math.max(0.01, rawB.y2 - rawB.y1),
          ];
        }

        const bbox: BoundingBox = {
          x: Math.round(normBox[0] * 640),
          y: Math.round(normBox[1] * 640),
          width: Math.round(normBox[2] * 640),
          height: Math.round(normBox[3] * 640),
          normalized: normBox,
          score: cloudItem.confidence,
          classId: 0,
          className: cloudItem.label,
        };

        const relevance = assessObjectRelevance(cloudItem.label, bbox, 640, 640);
        if (!relevance.isReportable || relevance.relevanceTier === 'EXCLUDED') {
          continue; // Skip non-belongings (e.g. table, chair, person)
        }

        // Check if an existing local candidate overlaps with this cloud item
        let matchedIdx = -1;
        for (let li = 0; li < fusedCandidates.length; li++) {
          const localCand = fusedCandidates[li];
          const iou = calculateIoU(normBox, localCand.boundingBox.normalized);
          const labelMatch =
            localCand.label.toLowerCase() === cloudLabel ||
            localCand.normalizedLabel.toLowerCase().includes(cloudLabel) ||
            cloudLabel.includes(localCand.normalizedLabel.toLowerCase());

          if (iou > 0.35 || (iou > 0.15 && labelMatch)) {
            matchedIdx = li;
            break;
          }
        }

        if (matchedIdx >= 0) {
          // Fuse into existing candidate: boost confidence & clarify label
          const matched = fusedCandidates[matchedIdx];
          matched.source = 'fused';
          matched.confidence = Math.min(0.99, Math.max(matched.confidence, cloudItem.confidence));
          matched.rankingScore = Math.max(matched.rankingScore, relevance.compositeRankingScore);
          if (taxResult.isKnown && matched.categoryName === 'Other Belongings') {
            matched.normalizedLabel = taxResult.normalizedLabel;
            matched.categoryName = taxResult.categoryName;
            matched.categoryId = taxResult.categoryId;
            matched.defaultDescriptor = taxResult.defaultDescriptor;
          }
        } else {
          // Cloud identified a candidate local vision missed (e.g. small badge or keys)
          fusedCandidates.push({
            id: `cand_cloud_${ci}_${cloudItem.label}`,
            label: cloudItem.label,
            normalizedLabel: taxResult.normalizedLabel,
            categoryName: taxResult.categoryName,
            categoryId: taxResult.categoryId,
            confidence: cloudItem.confidence,
            relevanceScore: relevance.relevanceScore,
            rankingScore: relevance.compositeRankingScore,
            relevanceTier: relevance.relevanceTier,
            isReportable: true,
            source: 'cloud',
            boundingBox: bbox,
            visualAttributes: relevance.visualAttributes,
            defaultDescriptor: taxResult.defaultDescriptor,
          });
        }
      }

      // Re-sort fused candidates descending by ranking score
      fusedCandidates.sort((a, b) => b.rankingScore - a.rankingScore);
      const reportableFused = fusedCandidates.filter((c) => c.isReportable);

      setCandidates(reportableFused);
      setHasReportableObject(reportableFused.length > 0);

      if (reportableFused.length > 0) {
        const topCandidate = reportableFused[0];
        setSelectedCandidateId(topCandidate.id);
        applyCandidateToForm(topCandidate);

        setDetectionStatus({
          type: res.cached ? 'cached' : 'enhanced',
          message: res.cached
            ? 'Cloud AI details applied (cached)'
            : 'Enhanced details applied from Cloud AI',
        });
      }

      if (onEnhancedComplete) {
        try {
          await onEnhancedComplete(imageFile, res);
        } catch (cbErr) {
          console.warn('onEnhancedComplete callback note:', cbErr);
        }
      }
    } catch (err: any) {
      if (reqId !== activeRequestId.current) return;
      const msg = err.message || '';
      if (msg.includes('rate limit')) {
        setDetectionStatus({
          type: 'error',
          message: 'Rate limit reached. Please wait a moment before analyzing again.',
        });
      } else if (msg.includes('not configured')) {
        setDetectionStatus({
          type: 'error',
          message: 'Cloud AI is not configured. Local on-device detection remains fully functional.',
        });
      } else {
        setDetectionStatus({
          type: 'error',
          message: 'Cloud AI scan could not be completed. You may continue manually.',
        });
      }
    } finally {
      if (reqId === activeRequestId.current) {
        setIsEnhancedScanning(false);
      }
    }
  }, [imageFile, candidates, categories, applyCandidateToForm, onEnhancedComplete]);

  return {
    imageFile,
    imagePreview,
    candidates,
    selectedCandidateId,
    hasReportableObject,
    abstentionReason,
    isLocalScanning,
    isEnhancedScanning,
    detectionStatus,
    showConsentModal,
    handleSelectImage,
    handleClearImage,
    selectCandidate,
    requestEnhancedScan,
    confirmEnhancedScan,
    dismissConsentModal,
    markFieldEdited,
    hasFieldBeenEdited,
  };
};
