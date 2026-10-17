import * as ort from 'onnxruntime-web';
import { BoundingBox, DetectedObject } from './types';
import { COCO_CLASSES, COCO_CAMPUS_MAP } from './taxonomyMapper';

// Configure ONNX Runtime wasm paths locally
if (typeof window !== 'undefined' || typeof self !== 'undefined') {
  ort.env.wasm.wasmPaths = '/ort-wasm/';
  ort.env.wasm.numThreads = 1; // Single thread to avoid SharedArrayBuffer / COOP requirements
}

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  } else if (e === 0x1f) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

function floatToHalf(val: number): number {
  const f32 = new Float32Array([val]);
  const u32 = new Uint32Array(f32.buffer)[0];
  const sign = (u32 >> 16) & 0x8000;
  const exp = ((u32 >> 23) & 0xff) - 127 + 15;
  const frac = (u32 >> 13) & 0x3ff;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | frac;
}

export class YoloDetector {
  private session: ort.InferenceSession | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private inputType: string = 'float16';

  public async initialize(modelPath: string = '/models/yolov5n.onnx'): Promise<void> {
    if (this.session) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        ort.env.wasm.wasmPaths = '/ort-wasm/';
        ort.env.wasm.numThreads = 1;

        const options: ort.InferenceSession.SessionOptions = {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        };

        this.session = await ort.InferenceSession.create(modelPath, options);
        if (this.session.inputNames.length > 0) {
          this.inputType = 'float16';
        }
      } catch (err) {
        console.warn('YOLO detector session creation failed:', err);
        this.session = null;
        this.initPromise = null;
        throw err;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  public isReady(): boolean {
    return this.session !== null;
  }

  /**
   * Runs local YOLO object detection on an image canvas.
   */
  public async detect(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    originalWidth: number,
    originalHeight: number,
    scoreThreshold: number = 0.25,
    iouThreshold: number = 0.45
  ): Promise<DetectedObject[]> {
    if (!this.session) {
      await this.initialize();
    }
    if (!this.session) {
      throw new Error('YOLO Detector session failed to initialize');
    }

    const targetDim = 640;
    const scale = Math.min(targetDim / originalWidth, targetDim / originalHeight);
    const scaledW = Math.round(originalWidth * scale);
    const scaledH = Math.round(originalHeight * scale);
    const dx = Math.round((targetDim - scaledW) / 2);
    const dy = Math.round((targetDim - scaledH) / 2);

    // Create 640x640 letterbox canvas
    let letterboxCanvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      letterboxCanvas = new OffscreenCanvas(targetDim, targetDim);
      ctx = letterboxCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    } else {
      letterboxCanvas = document.createElement('canvas');
      letterboxCanvas.width = targetDim;
      letterboxCanvas.height = targetDim;
      ctx = (letterboxCanvas as HTMLCanvasElement).getContext('2d');
    }

    if (!ctx) throw new Error('Could not create letterbox 2D context');

    // Fill with YOLO letterbox color: RGB(114, 114, 114)
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, targetDim, targetDim);
    ctx.drawImage(sourceCanvas as any, 0, 0, originalWidth, originalHeight, dx, dy, scaledW, scaledH);

    const imgData = ctx.getImageData(0, 0, targetDim, targetDim);
    const rgba = imgData.data;
    const pixelCount = targetDim * targetDim;

    // Convert RGBA HWC -> RGB CHW normalized [0, 1]
    const u16TensorData = new Uint16Array(3 * pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const r = rgba[i * 4] / 255.0;
      const g = rgba[i * 4 + 1] / 255.0;
      const b = rgba[i * 4 + 2] / 255.0;

      u16TensorData[i] = floatToHalf(r);
      u16TensorData[pixelCount + i] = floatToHalf(g);
      u16TensorData[2 * pixelCount + i] = floatToHalf(b);
    }

    const inputTensor = new ort.Tensor('float16', u16TensorData, [1, 3, targetDim, targetDim]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = inputTensor;

    const runResults = await this.session.run(feeds);
    const outputTensor = runResults[this.session.outputNames[0]];

    // Post-process [1, 25200, 85]
    return this.postProcess(
      outputTensor,
      originalWidth,
      originalHeight,
      scale,
      dx,
      dy,
      scoreThreshold,
      iouThreshold
    );
  }

  private postProcess(
    outputTensor: ort.Tensor,
    origW: number,
    origH: number,
    scale: number,
    dx: number,
    dy: number,
    scoreThreshold: number,
    iouThreshold: number
  ): DetectedObject[] {
    const rawData = outputTensor.data;
    const isFloat16 = outputTensor.type === 'float16';
    const numRows = 25200;
    const numCols = 85;

    interface Candidate {
      box: BoundingBox;
      classId: number;
      className: string;
      score: number;
    }

    const candidates: Candidate[] = [];

    // Helper to get float value from float16 (Uint16Array) or Float32Array
    const getVal = (index: number): number => {
      if (isFloat16) {
        return halfToFloat((rawData as Uint16Array)[index]);
      }
      return (rawData as Float32Array)[index];
    };

    for (let r = 0; r < numRows; r++) {
      const rowOffset = r * numCols;
      const objConf = getVal(rowOffset + 4);
      if (objConf < 0.15) continue; // Early exit on background anchors

      // Find top class
      let maxClassScore = 0;
      let maxClassId = -1;
      for (let c = 0; c < 80; c++) {
        const clsScore = getVal(rowOffset + 5 + c);
        if (clsScore > maxClassScore) {
          maxClassScore = clsScore;
          maxClassId = c;
        }
      }

      const totalScore = objConf * maxClassScore;
      if (totalScore >= scoreThreshold && maxClassId >= 0) {
        const cx = getVal(rowOffset);
        const cy = getVal(rowOffset + 1);
        const bw = getVal(rowOffset + 2);
        const bh = getVal(rowOffset + 3);

        // Convert from letterbox 640x640 space to original image coords
        const x1 = Math.max(0, Math.min(origW, (cx - bw / 2 - dx) / scale));
        const y1 = Math.max(0, Math.min(origH, (cy - bh / 2 - dy) / scale));
        const x2 = Math.max(0, Math.min(origW, (cx + bw / 2 - dx) / scale));
        const y2 = Math.max(0, Math.min(origH, (cy + bh / 2 - dy) / scale));

        const width = Math.max(1, x2 - x1);
        const height = Math.max(1, y2 - y1);
        const className = COCO_CLASSES[maxClassId] || 'item';

        candidates.push({
          score: totalScore,
          classId: maxClassId,
          className,
          box: {
            x: Math.round(x1),
            y: Math.round(y1),
            width: Math.round(width),
            height: Math.round(height),
            normalized: [
              Math.max(0, Math.min(1, x1 / origW)),
              Math.max(0, Math.min(1, y1 / origH)),
              Math.max(0, Math.min(1, width / origW)),
              Math.max(0, Math.min(1, height / origH)),
            ],
            score: Math.round(totalScore * 1000) / 1000,
            classId: maxClassId,
            className,
          },
        });
      }
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    // Non-Maximum Suppression (NMS)
    const nmsResults: Candidate[] = [];

    for (const cand of candidates) {
      let isOverlap = false;
      for (const accepted of nmsResults) {
        const iou = this.calculateIoU(cand.box, accepted.box);
        if (iou > iouThreshold) {
          isOverlap = true;
          break;
        }
      }
      if (!isOverlap) {
        nmsResults.push(cand);
        if (nmsResults.length >= 6) break; // Maximum 6 top items
      }
    }

    // Convert to DetectedObject
    return nmsResults.map((c) => {
      const mapping = COCO_CAMPUS_MAP[c.className] || {
        categoryName: 'Other Belongings',
        cleanName: c.className.charAt(0).toUpperCase() + c.className.slice(1),
        defaultDescriptor: 'campus item',
      };

      return {
        className: c.className,
        categoryName: mapping.categoryName,
        cleanName: mapping.cleanName,
        confidence: c.score,
        box: c.box,
      };
    });
  }

  private calculateIoU(a: BoundingBox, b: BoundingBox): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);

    const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (interArea <= 0) return 0;

    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return interArea / (areaA + areaB - interArea);
  }
}

export const yoloDetector = new YoloDetector();
