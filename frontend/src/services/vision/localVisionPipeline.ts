import { Category } from '../../types';
import { LocalVisionResult, DetectedObject } from './types';
import { yoloDetector } from './yoloDetector';
import { mobileNetClassifier } from './mobilenetClassifier';
import { extractDominantColor } from './colorExtractor';
import {
  generateFactualTitle,
  generateFactualDescription,
  matchCategoryId,
  COCO_CAMPUS_MAP,
} from './taxonomyMapper';

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
  private workerReady: boolean = false;
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
   * so cold-start time is eliminated before the user even snaps the photo!
   */
  public async prewarm(): Promise<void> {
    if (this.isPrewarmed) return;
    if (this.prewarmPromise) return this.prewarmPromise;

    this.prewarmPromise = (async () => {
      try {
        if (this.worker) {
          this.worker.postMessage({ id: -1, type: 'PREWARM' });
        }
        await yoloDetector.initialize();
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
    // 2. Load into HTML Image
    const imgBitmap = await this.loadImage(file);
    const origW = imgBitmap.width;
    const origH = imgBitmap.height;

    // Check cancellation
    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // 3. Prepare canvas
    const canvas = document.createElement('canvas');
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');
    ctx.drawImage(imgBitmap, 0, 0, origW, origH);

    // 4. Primary Stage: YOLO Nano Object Detection
    let detectedObjects: DetectedObject[] = [];
    let inferenceTimeMs = 0;
    const infStart = performance.now();

    try {
      detectedObjects = await yoloDetector.detect(canvas, origW, origH, 0.22, 0.45);
      inferenceTimeMs = Math.round(performance.now() - infStart);
    } catch (err) {
      console.warn('YOLO detector failed, falling back to color & secondary classifier:', err);
      inferenceTimeMs = Math.round(performance.now() - infStart);
    }

    // Check cancellation
    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // Filter out 'person' unless person is the only thing detected (e.g. jacket/apparel worn)
    const nonPersonItems = detectedObjects.filter((d) => d.className !== 'person');
    const personItem = detectedObjects.find((d) => d.className === 'person');

    let bestItem: DetectedObject | null = null;
    let cropBox = { x: 0, y: 0, width: origW, height: origH };

    if (nonPersonItems.length > 0) {
      bestItem = nonPersonItems[0];
      cropBox = {
        x: bestItem.box.x,
        y: bestItem.box.y,
        width: bestItem.box.width,
        height: bestItem.box.height,
      };
    } else if (personItem) {
      // Apparel candidate
      cropBox = {
        x: personItem.box.x,
        y: personItem.box.y,
        width: personItem.box.width,
        height: personItem.box.height,
      };
    } else {
      // Center 70% crop fallback
      cropBox = {
        x: Math.round(origW * 0.15),
        y: Math.round(origH * 0.15),
        width: Math.round(origW * 0.7),
        height: Math.round(origH * 0.7),
      };
    }

    // 5. Crop-Based Dominant Color Extraction (ignoring background)
    const colorResult = extractDominantColor(ctx, cropBox.x, cropBox.y, cropBox.width, cropBox.height);
    const dominantColor = colorResult.primaryColor;

    // Check cancellation
    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // 6. Secondary Stage: MobileNetV2 Whitelist Verification (when beneficial)
    // Run secondary classifier only if no strong YOLO item was found (or if item is ambiguous)
    let secondaryUsed = false;
    let cleanName = bestItem ? bestItem.cleanName : 'Campus Belonging';
    let categoryName = bestItem ? bestItem.categoryName : 'Other Belongings';
    let confidence = bestItem ? bestItem.confidence : 0.35;
    let defaultDescriptor = bestItem
      ? COCO_CAMPUS_MAP[bestItem.className]?.defaultDescriptor || 'campus item'
      : 'personal item';

    if (!bestItem || bestItem.confidence < 0.45) {
      try {
        const mobResult = await mobileNetClassifier.classify(
          canvas,
          cropBox.x,
          cropBox.y,
          cropBox.width,
          cropBox.height
        );
        if (mobResult && mobResult.confidence > 0.15) {
          secondaryUsed = true;
          cleanName = mobResult.cleanName;
          categoryName = mobResult.categoryName;
          confidence = Math.max(confidence, mobResult.confidence);
          defaultDescriptor = 'identified via campus item catalog';
        }
      } catch (err) {
        console.warn('Secondary MobileNet pass error:', err);
      }
    }

    // Check cancellation
    if (requestId !== this.currentRequestId) throw new StaleInferenceError();

    // Handle person/clothing fallback
    if (!bestItem && personItem && !secondaryUsed) {
      categoryName = 'Apparel & Outerwear';
      cleanName = 'Campus Apparel / Jacket';
      confidence = 0.55;
      defaultDescriptor = 'clothing or worn campus item';
    }

    // 7. Calibrated Confidence Tiering
    const calibratedScore = Math.min(0.98, Math.max(0.25, confidence));
    const confidencePct = `${Math.round(calibratedScore * 100)}%`;

    let confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let needsReview = false;

    if (calibratedScore >= 0.70) {
      confidenceTier = 'HIGH';
    } else if (calibratedScore >= 0.45) {
      confidenceTier = 'MEDIUM';
    } else {
      confidenceTier = 'LOW';
      needsReview = true;
    }

    // 8. Generate Factual Title & Description
    const finalTitle = generateFactualTitle(cleanName, dominantColor);
    const finalDescription = generateFactualDescription(
      cleanName,
      dominantColor,
      defaultDescriptor
    );
    const categoryId = matchCategoryId(categoryName, categories);

    const totalTimeMs = Math.round(performance.now() - startTime);
    const modelEngine = secondaryUsed
      ? 'YOLOv5n + MobileNetV2 (Local)'
      : bestItem
      ? 'YOLOv5n (Local Nano)'
      : 'Color & Texture Analyzer (Local)';

    const headline = finalTitle;

    // Top candidates formatting
    const topPredictions = nonPersonItems.slice(0, 4).map((d) => ({
      label: d.cleanName,
      category: d.categoryName,
      confidence: Math.round(d.confidence * 100) / 100,
      percentage: `${Math.round(d.confidence * 100)}%`,
    }));

    return {
      itemName: finalTitle,
      categoryName,
      categoryId,
      primaryColor: dominantColor,
      confidence: calibratedScore,
      confidencePercentage: confidencePct,
      confidenceTier,
      headline,
      suggestedDescription: finalDescription,
      modelEngine,
      inferenceTimeMs,
      totalTimeMs,
      boundingBox: bestItem ? bestItem.box : null,
      topPredictions,
      needsReview,
      isFallback: !bestItem && !secondaryUsed,
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
