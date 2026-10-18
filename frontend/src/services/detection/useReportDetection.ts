import { useState, useRef, useCallback, useEffect } from 'react';
import { Category, NinjaDetectionResult } from '../../types';
import { localVisionPipeline, StaleInferenceError } from '../vision/localVisionPipeline';
import { api } from '../api';

export type DetectionStatusType = 'local' | 'enhanced' | 'cached' | 'error' | null;

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // User manual edits tracking: any field in this set will NEVER be overwritten
  const manuallyEditedFields = useRef<Set<string>>(new Set());

  // Scanning & status states
  const [isLocalScanning, setIsLocalScanning] = useState(false);
  const [isEnhancedScanning, setIsEnhancedScanning] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatusInfo | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Cancellation and active request guard
  const activeRequestId = useRef<number>(0);

  // Mark a field as manually edited so subsequent detection does not overwrite it
  const markFieldEdited = useCallback((field: string) => {
    manuallyEditedFields.current.add(field);
  }, []);

  const hasFieldBeenEdited = useCallback((field: string) => {
    return manuallyEditedFields.current.has(field);
  }, []);

  // Safe image cleanup
  const cleanupPreview = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  // Execute on-device local vision analysis (ZERO external API calls)
  const runLocalDetection = useCallback(
    async (file: File, reqId: number) => {
      setIsLocalScanning(true);
      setDetectionStatus(null);

      try {
        const result = await localVisionPipeline.analyzeImage(file, categories);
        // Stale check
        if (reqId !== activeRequestId.current) return;

        const updates: {
          itemName?: string;
          categoryId?: number;
          color?: string;
          description?: string;
        } = {};

        if (!manuallyEditedFields.current.has('itemName') && result.itemName && result.itemName !== 'Campus Belonging') {
          updates.itemName = result.itemName;
        }

        if (!manuallyEditedFields.current.has('categoryId') && result.categoryId) {
          updates.categoryId = result.categoryId;
        }

        if (
          !manuallyEditedFields.current.has('color') &&
          result.primaryColor &&
          result.primaryColor !== 'Unknown'
        ) {
          updates.color = result.primaryColor;
        }

        if (
          !manuallyEditedFields.current.has('description') &&
          result.suggestedDescription &&
          !result.suggestedDescription.startsWith('Item photographed')
        ) {
          updates.description = result.suggestedDescription;
        }

        // Apply non-overridden fields
        if (Object.keys(updates).length > 0) {
          onApplyFields(updates);
          setDetectionStatus({
            type: 'local',
            message: 'Details suggested from photo',
          });
        }
      } catch (err: any) {
        if (!(err instanceof StaleInferenceError)) {
          // Local failure is non-blocking; user continues manually without scary errors
          console.warn('Local on-device analysis note:', err);
        }
      } finally {
        if (reqId === activeRequestId.current) {
          setIsLocalScanning(false);
        }
      }
    },
    [categories, onApplyFields]
  );

  // Handle image file selection (Upload / Drop / Shutter)
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

      // Start local detection on-device only (Zero external API Ninjas calls)
      runLocalDetection(file, reqId);
    },
    [cleanupPreview, runLocalDetection]
  );

  // User clicked "Enhance with AI" -> Prompt for explicit privacy consent
  const requestEnhancedScan = useCallback(() => {
    if (!imageFile || isEnhancedScanning) return;
    setShowConsentModal(true);
  }, [imageFile, isEnhancedScanning]);

  const dismissConsentModal = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  // User confirmed consent -> Call backend API Ninjas proxy with SHA-256 caching
  const confirmEnhancedScan = useCallback(async () => {
    if (!imageFile) return;
    setShowConsentModal(false);
    setIsEnhancedScanning(true);
    setDetectionStatus(null);

    const reqId = activeRequestId.current;

    try {
      const res: NinjaDetectionResult = await api.ninjaDetectObjects(imageFile);

      // Stale check: if image was changed or cleared during analysis, discard result
      if (reqId !== activeRequestId.current) return;

      const updates: {
        itemName?: string;
        categoryId?: number;
        color?: string;
        description?: string;
      } = {};

      if (res.detected_objects && res.detected_objects.length > 0) {
        const top = res.detected_objects[0];
        const formattedLabel = top.label.charAt(0).toUpperCase() + top.label.slice(1);

        if (!manuallyEditedFields.current.has('itemName')) {
          updates.itemName = formattedLabel;
        }

        if (!manuallyEditedFields.current.has('categoryId') && res.suggested_category) {
          const matched = categories.find(
            (c) =>
              c.name.toLowerCase() === res.suggested_category?.toLowerCase() ||
              c.name.toLowerCase().includes(res.suggested_category?.toLowerCase() || '')
          );
          if (matched) {
            updates.categoryId = matched.id;
          }
        }

        if (!manuallyEditedFields.current.has('description')) {
          updates.description = res.suggested_description || `Identified ${formattedLabel} in campus photograph.`;
        }
      }

      if (Object.keys(updates).length > 0) {
        onApplyFields(updates);
      }

      setDetectionStatus({
        type: res.cached ? 'cached' : 'enhanced',
        message: res.cached
          ? 'Cloud AI details applied (from cache)'
          : 'Enhanced details applied from Cloud AI',
      });

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
          message: 'Cloud AI service is not configured on this server.',
        });
      } else if (msg.includes('timed out')) {
        setDetectionStatus({
          type: 'error',
          message: 'Cloud AI request timed out. You can continue filling details manually.',
        });
      } else {
        setDetectionStatus({
          type: 'error',
          message: 'Could not complete Cloud AI scan. You can continue filling details manually.',
        });
      }
    } finally {
      if (reqId === activeRequestId.current) {
        setIsEnhancedScanning(false);
      }
    }
  }, [imageFile, categories, onApplyFields]);

  // Clear / replace image
  const handleClearImage = useCallback(() => {
    activeRequestId.current++;
    cleanupPreview();
    setImageFile(null);
    setImagePreview(null);
    setDetectionStatus(null);
    setIsLocalScanning(false);
    setIsEnhancedScanning(false);
    setShowConsentModal(false);
  }, [cleanupPreview]);

  // Handle preloaded initialFile (e.g. from photo scan match modal)
  useEffect(() => {
    if (initialFile) {
      handleSelectImage(initialFile);
      if (initialLabel) {
        onApplyFields({ itemName: initialLabel });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  return {
    imageFile,
    imagePreview,
    isLocalScanning,
    isEnhancedScanning,
    detectionStatus,
    showConsentModal,
    markFieldEdited,
    hasFieldBeenEdited,
    handleSelectImage,
    handleClearImage,
    requestEnhancedScan,
    confirmEnhancedScan,
    dismissConsentModal,
  };
};
