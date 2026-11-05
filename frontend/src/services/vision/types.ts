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

export type CandidateSource = 'yolo' | 'mobilenet' | 'cloud' | 'fused';

export type RelevanceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'EXCLUDED';

export interface VisualAttributes {
  primaryColor: string;
  secondaryColor?: string;
  aspectRatio: number;
  shapeDescriptor: 'elongated' | 'square' | 'wide' | 'compact';
}

/**
 * Generalized, structured candidate representation for all detected objects.
 * Preserves model provenance, bounding geometry, context-aware relevance,
 * and canonical taxonomy category.
 */
export interface DetectedCandidate {
  id: string;                          // Unique identifier for UI selection
  label: string;                       // Raw model label
  normalizedLabel: string;             // Clean, human-readable display label
  categoryName: string;                // Canonical CampusTrace category
  categoryId: number | null;           // Mapped backend category ID
  confidence: number;                  // Raw detector/classifier confidence (0..1)
  relevanceScore: number;              // Context-aware lost-and-found relevance (0..1)
  rankingScore: number;                // Composite ranking score combining relevance, confidence & geometry
  relevanceTier: RelevanceTier;
  isReportable: boolean;               // True if suitable for a lost/found report target
  source: CandidateSource;
  boundingBox: BoundingBox;
  visualAttributes?: VisualAttributes;
  cropPreviewDataUrl?: string;         // Optional crop thumbnail for UI selection
  defaultDescriptor?: string;
}

export type AbstentionReason =
  | 'NO_OBJECTS_DETECTED'
  | 'NO_REPORTABLE_OBJECT'
  | 'LOW_CONFIDENCE'
  | 'EXCLUDED_SCENE_ELEMENTS_ONLY'
  | 'MANUAL_SELECTION_REQUIRED';

export interface LocalVisionResult {
  hasReportableObject: boolean;        // True if at least one reportable candidate passes threshold
  abstentionReason?: AbstentionReason;
  primaryCandidate: DetectedCandidate | null;
  candidates: DetectedCandidate[];     // Full list of preserved candidates
  itemName: string;                    // Factual title of primary candidate (or empty if abstained)
  categoryName: string;
  categoryId: number | null;
  primaryColor: string;
  confidence: number;                  // 0.0 to 1.0 (calibrated composite confidence)
  confidencePercentage: string;        // e.g. "87%"
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
