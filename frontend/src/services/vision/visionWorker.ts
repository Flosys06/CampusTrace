import * as ort from 'onnxruntime-web';
import { yoloDetector } from './yoloDetector';
import { mobileNetClassifier } from './mobilenetClassifier';
import { extractDominantColor } from './colorExtractor';
import {
  generateFactualTitle,
  generateFactualDescription,
  matchCategoryId,
  COCO_CAMPUS_MAP,
} from './taxonomyMapper';
import { Category } from '../../types';

// Setup worker wasm path
if (typeof self !== 'undefined') {
  ort.env.wasm.wasmPaths = '/ort-wasm/';
  ort.env.wasm.numThreads = 1;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, imageBitmap, categories } = e.data;

  if (type === 'PREWARM') {
    try {
      await yoloDetector.initialize('/models/yolov5n.onnx');
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
      const detectedObjects = await yoloDetector.detect(canvas, origW, origH, 0.22, 0.45);
      const inferenceTimeMs = Math.round(performance.now() - infStart);

      const nonPersonItems = detectedObjects.filter((d) => d.className !== 'person');
      const personItem = detectedObjects.find((d) => d.className === 'person');

      let bestItem = nonPersonItems.length > 0 ? nonPersonItems[0] : null;
      let cropBox = { x: 0, y: 0, width: origW, height: origH };

      if (bestItem) {
        cropBox = {
          x: bestItem.box.x,
          y: bestItem.box.y,
          width: bestItem.box.width,
          height: bestItem.box.height,
        };
      } else if (personItem) {
        cropBox = {
          x: personItem.box.x,
          y: personItem.box.y,
          width: personItem.box.width,
          height: personItem.box.height,
        };
      } else {
        cropBox = {
          x: Math.round(origW * 0.15),
          y: Math.round(origH * 0.15),
          width: Math.round(origW * 0.7),
          height: Math.round(origH * 0.7),
        };
      }

      const colorResult = extractDominantColor(ctx as any, cropBox.x, cropBox.y, cropBox.width, cropBox.height);
      const dominantColor = colorResult.primaryColor;

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
          console.warn('Worker MobileNet error:', err);
        }
      }

      if (!bestItem && personItem && !secondaryUsed) {
        categoryName = 'Apparel & Outerwear';
        cleanName = 'Campus Apparel / Jacket';
        confidence = 0.55;
        defaultDescriptor = 'clothing or worn campus item';
      }

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

      const finalTitle = generateFactualTitle(cleanName, dominantColor);
      const finalDescription = generateFactualDescription(
        cleanName,
        dominantColor,
        defaultDescriptor
      );
      const categoryId = matchCategoryId(categoryName, categories as Category[]);

      const totalTimeMs = Math.round(performance.now() - startTime);
      const modelEngine = secondaryUsed
        ? 'YOLOv5n + MobileNetV2 (Worker)'
        : bestItem
        ? 'YOLOv5n (Worker Nano)'
        : 'Color & Texture Analyzer (Worker)';

      const headline = finalTitle;

      const topPredictions = nonPersonItems.slice(0, 4).map((d) => ({
        label: d.cleanName,
        category: d.categoryName,
        confidence: Math.round(d.confidence * 100) / 100,
        percentage: `${Math.round(d.confidence * 100)}%`,
      }));

      self.postMessage({
        id,
        status: 'SUCCESS',
        result: {
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
        },
      });
    } catch (err: any) {
      self.postMessage({ id, status: 'ERROR', error: err.message });
    }
  }
};
