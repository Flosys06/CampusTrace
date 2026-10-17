export interface BoundingBox {
  x: number;      // top-left x in original image coords
  y: number;      // top-left y in original image coords
  width: number;  // width in original image coords
  height: number; // height in original image coords
  normalized: [number, number, number, number]; // [norm_x, norm_y, norm_w, norm_h] (0..1)
  score: number;
  classId: number;
  className: string;
}

export interface DetectedObject {
  className: string;
  categoryName: string;
  cleanName: string;
  confidence: number;
  box: BoundingBox;
}

export interface ColorExtractionResult {
  primaryColor: string;
  secondaryColor?: string;
  isAchromatic: boolean;
  confidence: number;
  sampleRgb: [number, number, number];
}

export interface PredictionCandidate {
  label: string;
  category: string;
  confidence: number;
  percentage: string;
}

export interface LocalVisionResult {
  itemName: string;
  categoryName: string;
  categoryId: number | null;
  primaryColor: string;
  confidence: number;           // 0.0 to 1.0 (calibrated)
  confidencePercentage: string; // e.g. "87.4%"
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  headline: string;
  suggestedDescription: string;
  modelEngine: string;
  inferenceTimeMs: number;
  totalTimeMs: number;
  boundingBox?: BoundingBox | null;
  topPredictions: PredictionCandidate[];
  needsReview: boolean;
  isFallback: boolean;
}

export interface VisionPipelineOptions {
  enableSecondaryClassification?: boolean;
  scoreThreshold?: number;
  iouThreshold?: number;
  preferredRuntime?: 'webgpu' | 'wasm';
}
