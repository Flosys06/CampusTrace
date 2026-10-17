import * as ort from 'onnxruntime-web';
import { IMAGENET_CAMPUS_MAP } from './taxonomyMapper';

export interface MobileNetPrediction {
  rawLabel: string;
  categoryName: string;
  cleanName: string;
  confidence: number;
}

export class MobileNetClassifier {
  private session: ort.InferenceSession | null = null;
  private classesMap: Record<string, [string, string]> | null = null;
  private initPromise: Promise<void> | null = null;

  public async initialize(): Promise<void> {
    if (this.session && this.classesMap) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        ort.env.wasm.wasmPaths = '/ort-wasm/';
        ort.env.wasm.numThreads = 1;

        const [sess, classResp] = await Promise.all([
          ort.InferenceSession.create('/models/mobilenetv2-7.onnx', {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
          }),
          fetch('/models/imagenet_classes.json').then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading classes`);
            return r.json();
          }),
        ]);

        this.session = sess;
        this.classesMap = classResp;
      } catch (err) {
        console.warn('MobileNetClassifier initialization failed:', err);
        this.session = null;
        this.classesMap = null;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public isReady(): boolean {
    return this.session !== null && this.classesMap !== null;
  }

  /**
   * Runs classification on a cropped object canvas.
   */
  public async classify(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number
  ): Promise<MobileNetPrediction | null> {
    if (!this.session || !this.classesMap) {
      await this.initialize();
    }
    if (!this.session || !this.classesMap) {
      return null;
    }

    const targetDim = 224;
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(targetDim, targetDim);
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = targetDim;
      canvas.height = targetDim;
      ctx = (canvas as HTMLCanvasElement).getContext('2d');
    }

    if (!ctx) return null;

    ctx.drawImage(
      sourceCanvas as any,
      Math.max(0, Math.round(cropX)),
      Math.max(0, Math.round(cropY)),
      Math.max(1, Math.round(cropWidth)),
      Math.max(1, Math.round(cropHeight)),
      0,
      0,
      targetDim,
      targetDim
    );

    const imgData = ctx.getImageData(0, 0, targetDim, targetDim);
    const rgba = imgData.data;
    const pixelCount = targetDim * targetDim;

    // ImageNet mean and std
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    const tensorData = new Float32Array(3 * pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const r = rgba[i * 4] / 255.0;
      const g = rgba[i * 4 + 1] / 255.0;
      const b = rgba[i * 4 + 2] / 255.0;

      tensorData[i] = (r - mean[0]) / std[0];
      tensorData[pixelCount + i] = (g - mean[1]) / std[1];
      tensorData[2 * pixelCount + i] = (b - mean[2]) / std[2];
    }

    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, targetDim, targetDim]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = inputTensor;

    const results = await this.session.run(feeds);
    const outputTensor = results[this.session.outputNames[0]];
    const rawScores = outputTensor.data as Float32Array;

    // Compute softmax
    let maxLogit = -Infinity;
    for (let i = 0; i < rawScores.length; i++) {
      if (rawScores[i] > maxLogit) maxLogit = rawScores[i];
    }

    let sumExp = 0;
    const probs = new Float32Array(rawScores.length);
    for (let i = 0; i < rawScores.length; i++) {
      probs[i] = Math.exp(rawScores[i] - maxLogit);
      sumExp += probs[i];
    }
    for (let i = 0; i < rawScores.length; i++) {
      probs[i] /= sumExp;
    }

    // Sort predictions descending
    const indices = Array.from({ length: probs.length }, (_, i) => i);
    indices.sort((a, b) => probs[b] - probs[a]);

    const classes = this.classesMap;
    if (!classes) return null;

    // Check top 15 predictions against campus whitelist
    for (let k = 0; k < Math.min(15, indices.length); k++) {
      const idx = indices[k];
      const prob = probs[idx];
      const classEntry: [string, string] | undefined = classes[String(idx)];
      if (!classEntry) continue;

      const rawLabel = classEntry[1];
      if (IMAGENET_CAMPUS_MAP[rawLabel]) {
        const mapping = IMAGENET_CAMPUS_MAP[rawLabel];
        return {
          rawLabel,
          categoryName: mapping.categoryName,
          cleanName: mapping.cleanName,
          confidence: Math.round(prob * 1000) / 1000,
        };
      }
    }

    return null;
  }
}

export const mobileNetClassifier = new MobileNetClassifier();
