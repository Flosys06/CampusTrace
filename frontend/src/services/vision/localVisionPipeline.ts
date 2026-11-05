import { Category } from '../../types';
import {
  LocalVisionResult,
  DetectedCandidate,
  DetectedObject,
  BoundingBox,
  AbstentionReason,
  PredictionCandidate,
  CandidateSource,
} from './types';
import { yoloDetector } from './yoloDetector';
import { mobileNetClassifier } from './mobilenetClassifier';
import { extractDominantColor } from './colorExtractor';
import { taxonomyEngine } from './taxonomyEngine';
import { assessObjectRelevance } from './relevanceScorer';

export class StaleInferenceError extends Error {
  constructor() {
    super('Inference cancelled by newer request');
    this.name = 'StaleInferenceError';
  }
}

export class LocalVisionPipeline {
  private currentRequestId: number = 0;
  private isPrewarmed: boolean = false;
  private prewarmPromise: Promise<void> | null = null;
  private worker: Worker | null = null;
  private pendingWorkerCallbacks: Map<
    number,
    { resolve: (res: LocalVisionResult) => void; reject: (err: any) => void }
  > = new Map();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(new URL('./visionWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        const { id, status, result, error } = e.data;
        const cb = this.pendingWorkerCallbacks.get(id);
        if (!cb) return;

        this.pendingWorkerCallbacks.delete(id);
        if (status === 'SUCCESS') {
          cb.resolve(result);
        } else {
          cb.reject(new Error(error || 'Worker inference failed'));
        }
      };

      this.worker.onerror = (err) => {
        console.warn('Vision worker encountered error, will fallback to main thread:', err);
        this.worker = null;
      };
    } catch (err) {
      console.warn('Vision Web Worker could not be instantiated, using main thread:', err);
      this.worker = null;
    }
  }

  /**
   * Pre-warms local models in the background when the user opens the camera modal
   * so cold-start time is eliminated before the user even snaps the photo.
   */
  public async prewarm(): Promise<void> {
    if (this.isPrewarmed) return;
    if (this.prewarmPromise) return this.prewarmPromise;

    this.prewarmPromise = (async () => {
      try {
        if (this.worker) {
          this.worker.postMessage({ id: -1, type: 'PREWARM' });
        }
        await yoloDetector.initialize('/models/yolov5s.onnx');
        this.isPrewarmed = true;
      } catch (err) {
        console.warn('LocalVisionPipeline prewarm notice:', err);
      }
    })();

    return this.prewarmPromise;
  }

  /**
   * Primary entry point: Analyzes an image file locally on-device.
   * Zero external API requests, zero server uploads.
   */
  public async analyzeImage(
    file: File | Blob,
    categories: Category[] = []
  ): Promise<LocalVisionResult> {
    const requestId = ++this.currentRequestId;
    const startTime = performance.now();

    // 1. Validation
    if (!file || file.size === 0) {
      throw new Error('Invalid image file provided for analysis');
    }

    // Try Web Worker path first if supported and image bitmap can be transferred
    if (this.worker && typeof createImageBitmap === 'function') {
      try {
        const imageBitmap = await createImageBitmap(file);
        if (requestId !== this.currentRequestId) {
          imageBitmap.close();
          throw new StaleInferenceError();
        }

        const workerResult = await new Promise<LocalVisionResult>((resolve, reject) => {
          this.pendingWorkerCallbacks.set(requestId, { resolve, reject });
          this.worker!.postMessage(
            {
              id: requestId,
              type: 'ANALYZE',
              imageBitmap,
              categories,
            },
            [imageBitmap]
          );
        });

        if (requestId !== this.currentRequestId) throw new StaleInferenceError();
        return workerResult;
      } catch (err) {
        if (err instanceof StaleInferenceError) throw err;
        console.warn('Worker execution failed, falling back to main thread WASM:', err);
      }
    }

    // Main thread execution fallback
    return this.analyzeMainThread(file, categories, requestId, startTime);
  }

  private async analyzeMainThread(
    file: File | Blob,
    categories: Category[],
    requestId: number,
    startTime: number
  ): Promise<LocalVisionResult> {
    const imgBitmap = await this.loadImage(file);
    const origW = imgBitmap.width;
    const origH = imgBitmap.height;

    // Check cancellation
    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    const canvas = document.createElement('canvas');
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');
    ctx.drawImage(imgBitmap, 0, 0, origW, origH);

    // Primary Stage: YOLO Object Detection
    let detectedObjects: DetectedObject[] = [];
    let inferenceTimeMs = 0;
    const infStart = performance.now();

    try {
      detectedObjects = await yoloDetector.detect(canvas, origW, origH, 0.22, 0.45);
      inferenceTimeMs = Math.round(performance.now() - infStart);
    } catch (err) {
      console.warn('YOLO detector failed, falling back to classifier:', err);
      inferenceTimeMs = Math.round(performance.now() - infStart);
    }

    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // Process all detections into structured candidates
    const candidates: DetectedCandidate[] = [];

    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const box = obj.box;

      // Candidate-specific dominant color
      const colorResult = extractDominantColor(ctx, box.x, box.y, box.width, box.height);
      const primaryColor = colorResult.primaryColor;

      // Canonical taxonomy mapping
      const taxResult = taxonomyEngine.mapModelLabel(obj.className, categories);

      // Context-aware relevance scoring
      const relevance = assessObjectRelevance(obj.className, box, origW, origH, primaryColor);

      let finalLabel = taxResult.normalizedLabel;
      let finalCategory = taxResult.categoryName;
      let finalCategoryId = taxResult.categoryId;
      let finalDescriptor = taxResult.defaultDescriptor;
      let finalConfidence = obj.confidence;
      let source: CandidateSource = 'yolo';

      // Secondary verification for ambiguous items, books, or thin stationery proxies
      const isElongated = relevance.visualAttributes.shapeDescriptor === 'elongated';
      const isThinProxy = ['toothbrush', 'knife', 'scissors', 'remote', 'cell phone', 'baseball bat'].includes(
        obj.className
      );
      const shouldRunSecondary =
        !relevance.isReportable ||
        obj.confidence < 0.55 ||
        isThinProxy ||
        isElongated ||
        obj.className === 'book';

      if (shouldRunSecondary) {
        try {
          const mob = await mobileNetClassifier.classify(canvas, box.x, box.y, box.width, box.height);
          if (mob && mob.confidence >= 0.035) {
            const mobTax = taxonomyEngine.mapModelLabel(mob.rawLabel, categories);
            const mobRelevance = assessObjectRelevance(mob.rawLabel, box, origW, origH, primaryColor);

            if (
              mobTax.categoryName === 'Books & Stationery' ||
              mobTax.categoryName === 'IDs, Cards & Wallets' ||
              mobRelevance.relevanceScore > relevance.relevanceScore
            ) {
              finalLabel = mobTax.normalizedLabel;
              finalCategory = mobTax.categoryName;
              finalCategoryId = mobTax.categoryId;
              finalDescriptor = mobTax.defaultDescriptor;
              source = 'fused';
              finalConfidence = Math.max(obj.confidence, Math.min(0.92, mob.confidence * 4.5));
              relevance.relevanceTier = mobRelevance.relevanceTier;
              relevance.relevanceScore = mobRelevance.relevanceScore;
              relevance.isReportable = mobRelevance.isReportable;
              relevance.compositeRankingScore = Math.max(
                relevance.compositeRankingScore,
                mobRelevance.compositeRankingScore
              );
            }
          }
        } catch (secErr) {
          console.warn('Secondary MobileNet check note:', secErr);
        }
      }

      candidates.push({
        id: `cand_${i}_${obj.className}`,
        label: obj.className,
        normalizedLabel: finalLabel,
        categoryName: finalCategory,
        categoryId: finalCategoryId,
        confidence: Math.round(finalConfidence * 1000) / 1000,
        relevanceScore: relevance.relevanceScore,
        rankingScore: relevance.compositeRankingScore,
        relevanceTier: relevance.relevanceTier,
        isReportable: relevance.isReportable,
        source,
        boundingBox: box,
        visualAttributes: relevance.visualAttributes,
        defaultDescriptor: finalDescriptor,
      });
    }

    // Fallback if YOLO detected nothing: inspect center 70% crop with MobileNet
    if (candidates.length === 0) {
      const cropX = Math.round(origW * 0.15);
      const cropY = Math.round(origH * 0.15);
      const cropW = Math.round(origW * 0.7);
      const cropH = Math.round(origH * 0.7);
      const colorResult = extractDominantColor(ctx, cropX, cropY, cropW, cropH);

      try {
        const mob = await mobileNetClassifier.classify(canvas, cropX, cropY, cropW, cropH);
        if (mob && mob.confidence >= 0.04) {
          const mobTax = taxonomyEngine.mapModelLabel(mob.rawLabel, categories);
          const fakeBox: BoundingBox = {
            x: cropX,
            y: cropY,
            width: cropW,
            height: cropH,
            normalized: [0.15, 0.15, 0.7, 0.7],
            score: mob.confidence,
            classId: 0,
            className: mob.rawLabel,
          };
          const relevance = assessObjectRelevance(
            mob.rawLabel,
            fakeBox,
            origW,
            origH,
            colorResult.primaryColor
          );

          candidates.push({
            id: 'cand_mobilenet_center',
            label: mob.rawLabel,
            normalizedLabel: mobTax.normalizedLabel,
            categoryName: mobTax.categoryName,
            categoryId: mobTax.categoryId,
            confidence: Math.round(Math.min(0.88, mob.confidence * 4.0) * 1000) / 1000,
            relevanceScore: relevance.relevanceScore,
            rankingScore: relevance.compositeRankingScore,
            relevanceTier: relevance.relevanceTier,
            isReportable: relevance.isReportable,
            source: 'mobilenet',
            boundingBox: fakeBox,
            visualAttributes: relevance.visualAttributes,
            defaultDescriptor: mobTax.defaultDescriptor,
          });
        }
      } catch (mobErr) {
        console.warn('MobileNet center pass note:', mobErr);
      }
    }

    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // Sort all candidates descending by rankingScore
    candidates.sort((a, b) => b.rankingScore - a.rankingScore);

    // Filter reportable candidates
    const reportableCandidates = candidates.filter(
      (c) => c.isReportable && c.confidence >= 0.20 && c.relevanceTier !== 'EXCLUDED'
    );

    const hasReportableObject = reportableCandidates.length > 0;
    const primaryCandidate = hasReportableObject ? reportableCandidates[0] : null;

    let abstentionReason: AbstentionReason | undefined = undefined;
    if (!hasReportableObject) {
      if (candidates.length === 0) {
        abstentionReason = 'NO_OBJECTS_DETECTED';
      } else if (candidates.every((c) => c.relevanceTier === 'EXCLUDED')) {
        abstentionReason = 'EXCLUDED_SCENE_ELEMENTS_ONLY';
      } else {
        abstentionReason = 'LOW_CONFIDENCE';
      }
    }

    const totalTimeMs = Math.round(performance.now() - startTime);

    if (hasReportableObject && primaryCandidate) {
      const dominantColor = primaryCandidate.visualAttributes?.primaryColor || 'Unknown';
      const itemName = taxonomyEngine.generateFactualTitle(
        primaryCandidate.normalizedLabel,
        dominantColor
      );
      const suggestedDescription = taxonomyEngine.generateFactualDescription(
        primaryCandidate.normalizedLabel,
        dominantColor,
        primaryCandidate.defaultDescriptor
      );

      const calibratedConfidence = Math.min(
        0.98,
        Math.max(0.35, primaryCandidate.rankingScore)
      );
      const confidencePercentage = `${Math.round(calibratedConfidence * 100)}%`;
      const confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' =
        calibratedConfidence >= 0.70 ? 'HIGH' : calibratedConfidence >= 0.45 ? 'MEDIUM' : 'LOW';

      const modelEngine =
        primaryCandidate.source === 'fused'
          ? 'YOLOv5s + MobileNetV2 (Fused Local)'
          : primaryCandidate.source === 'mobilenet'
          ? 'MobileNetV2 (Campus Catalog)'
          : 'YOLOv5s (Local Small)';

      const topPredictions: PredictionCandidate[] = reportableCandidates
        .slice(0, 5)
        .map((c) => ({
          label: c.normalizedLabel,
          category: c.categoryName,
          confidence: c.confidence,
          percentage: `${Math.round(c.confidence * 100)}%`,
        }));

      return {
        hasReportableObject: true,
        primaryCandidate,
        candidates: reportableCandidates,
        itemName,
        categoryName: primaryCandidate.categoryName,
        categoryId: primaryCandidate.categoryId,
        primaryColor: dominantColor,
        confidence: calibratedConfidence,
        confidencePercentage,
        confidenceTier,
        headline: itemName,
        suggestedDescription,
        modelEngine,
        inferenceTimeMs,
        totalTimeMs,
        boundingBox: primaryCandidate.boundingBox,
        topPredictions,
        needsReview: confidenceTier === 'LOW',
        isFallback: false,
      };
    }

    // Principled Abstention: do NOT fabricate title or category
    const topPredictions: PredictionCandidate[] = candidates.slice(0, 5).map((c) => ({
      label: c.normalizedLabel,
      category: c.categoryName,
      confidence: c.confidence,
      percentage: `${Math.round(c.confidence * 100)}%`,
    }));

    return {
      hasReportableObject: false,
      abstentionReason,
      primaryCandidate: null,
      candidates,
      itemName: '',
      categoryName: '',
      categoryId: null,
      primaryColor: 'Unknown',
      confidence: 0.0,
      confidencePercentage: '0%',
      confidenceTier: 'LOW',
      headline: 'No distinct belonging recognized',
      suggestedDescription: '',
      modelEngine: 'YOLOv5s (Local Small)',
      inferenceTimeMs,
      totalTimeMs,
      boundingBox: null,
      topPredictions,
      needsReview: true,
      isFallback: true,
    };
  }

  private loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image file'));
      };
      img.src = url;
    });
  }
}

export const localVisionPipeline = new LocalVisionPipeline();
