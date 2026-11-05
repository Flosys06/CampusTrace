import * as ort from 'onnxruntime-web';
import { yoloDetector } from './yoloDetector';
import { mobileNetClassifier } from './mobilenetClassifier';
import { extractDominantColor } from './colorExtractor';
import { taxonomyEngine } from './taxonomyEngine';
import { assessObjectRelevance } from './relevanceScorer';
import {
  LocalVisionResult,
  DetectedCandidate,
  DetectedObject,
  BoundingBox,
  AbstentionReason,
  PredictionCandidate,
  CandidateSource,
} from './types';

// Setup worker wasm path
if (typeof self !== 'undefined') {
  ort.env.wasm.wasmPaths = '/ort-wasm/';
  ort.env.wasm.numThreads = 1;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, imageBitmap, categories } = e.data;

  if (type === 'PREWARM') {
    try {
      await yoloDetector.initialize('/models/yolov5s.onnx');
      self.postMessage({ id, status: 'READY' });
    } catch (err: any) {
      self.postMessage({ id, status: 'ERROR', error: err.message });
    }
    return;
  }

  if (type === 'ANALYZE') {
    const startTime = performance.now();
    try {
      const origW = imageBitmap.width;
      const origH = imageBitmap.height;

      // Draw onto OffscreenCanvas
      const canvas = new OffscreenCanvas(origW, origH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
      ctx.drawImage(imageBitmap, 0, 0, origW, origH);

      // Run YOLO detector
      const infStart = performance.now();
      let detectedObjects: DetectedObject[] = [];
      try {
        detectedObjects = await yoloDetector.detect(canvas, origW, origH, 0.22, 0.45);
      } catch (detErr) {
        console.warn('Worker YOLO detection note:', detErr);
      }
      const inferenceTimeMs = Math.round(performance.now() - infStart);

      const candidates: DetectedCandidate[] = [];

      for (let i = 0; i < detectedObjects.length; i++) {
        const obj = detectedObjects[i];
        const box = obj.box;

        // Candidate-specific dominant color
        const colorResult = extractDominantColor(ctx as any, box.x, box.y, box.width, box.height);
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
            console.warn('Worker secondary MobileNet check note:', secErr);
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
        const colorResult = extractDominantColor(ctx as any, cropX, cropY, cropW, cropH);

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
          console.warn('Worker MobileNet center pass note:', mobErr);
        }
      }

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

      let result: LocalVisionResult;

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

        result = {
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
      } else {
        const topPredictions: PredictionCandidate[] = candidates.slice(0, 5).map((c) => ({
          label: c.normalizedLabel,
          category: c.categoryName,
          confidence: c.confidence,
          percentage: `${Math.round(c.confidence * 100)}%`,
        }));

        result = {
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

      self.postMessage({ id, status: 'SUCCESS', result });
    } catch (err: any) {
      self.postMessage({ id, status: 'ERROR', error: err.message });
    }
  }
};
