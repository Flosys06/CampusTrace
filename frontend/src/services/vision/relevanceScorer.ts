import { BoundingBox, RelevanceTier, VisualAttributes } from './types';

// Sets of normalized labels mapped to relevance tiers
const EXCLUDED_LABELS = new Set([
  // People (Strict Privacy & Safety: CampusTrace NEVER reports people)
  'person', 'people', 'human', 'face', 'man', 'woman', 'child', 'boy', 'girl',
  // Room Fixtures & Architecture
  'chair', 'dining table', 'table', 'desk', 'couch', 'sofa', 'bed', 'toilet', 'sink',
  'bench', 'potted plant', 'plant', 'vase', 'refrigerator', 'oven', 'microwave', 'toaster',
  'wall', 'floor', 'ceiling', 'window', 'door', 'building', 'room', 'fence', 'tree',
  // Heavy Infrastructure & Large Vehicles
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter',
  'airplane', 'truck', 'train', 'boat', 'bus', 'car', 'motorcycle',
  // Animals
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'
]);

const HIGH_RELEVANCE_LABELS = new Set([
  // Electronics
  'cell phone', 'cellular_telephone', 'smartphone', 'phone', 'laptop', 'hand-held_computer',
  'tablet', 'mouse', 'keyboard', 'computer_keyboard', 'remote', 'calculator', 'charger',
  'power bank', 'usb', 'hard drive', 'hard_disc', 'flash drive', 'pendrive',
  // Audio
  'headphones', 'earphones', 'earbuds', 'airpods', 'ipod', 'speaker', 'loudspeaker',
  // Bags & Carry Goods
  'backpack', 'handbag', 'suitcase', 'briefcase', 'mailbag', 'tote', 'duffel', 'bag',
  // Identity & Cards & Wallets
  'wallet', 'purse', 'card', 'id card', 'badge', 'cardholder', 'lanyard',
  // Keys & Locks
  'key', 'keys', 'keychain', 'lock', 'padlock', 'combination_lock',
  // Containers & Bottles
  'bottle', 'water_bottle', 'pop_bottle', 'cup', 'coffee_mug', 'mug', 'flask', 'tumbler', 'thermos',
  // Books & Stationery
  'book', 'book_jacket', 'comic_book', 'notebook', 'textbook', 'ballpoint', 'fountain_pen',
  'pen', 'pencil', 'marker', 'pencil_box', 'pencil_sharpener', 'rubber_eraser', 'eraser',
  'slide_rule', 'ruler', 'binder', 'folder', 'envelope', 'scissors',
  // Personal Accessories
  'watch', 'smartwatch', 'digital_watch', 'analog_clock', 'digital_clock', 'stopwatch',
  'clock', 'sunglasses', 'sunglass', 'spectacles', 'glasses', 'umbrella', 'crash_helmet'
]);

const MEDIUM_RELEVANCE_LABELS = new Set([
  // Apparel & Outerwear
  'tie', 'jacket', 'cardigan', 'sweatshirt', 'hoodie', 'lab_coat', 'suit', 'trench_coat',
  'coat', 'sweater', 'shirt', 'hat', 'cap', 'shoe', 'shoes', 'glove',
  // Sports Gear
  'sports ball', 'tennis racket', 'skateboard', 'frisbee', 'baseball bat', 'baseball glove'
]);

export interface RelevanceScoreResult {
  relevanceTier: RelevanceTier;
  relevanceScore: number;       // Prior 0.0 .. 1.0
  centralityScore: number;      // 0.0 .. 1.0 (closeness to frame center)
  scaleScore: number;           // 0.0 .. 1.0 (optimal bounding area ratio)
  compositeRankingScore: number;// Combined ranking score
  isReportable: boolean;        // Whether suitable for lost/found reporting
  exclusionReason?: string;
  visualAttributes: VisualAttributes;
}

/**
 * Evaluates context-aware lost-and-found relevance for an object detection.
 * Considers semantic category prior, spatial centrality, scale in frame, and aspect ratio.
 */
export function assessObjectRelevance(
  label: string,
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number,
  primaryColor: string = 'Unknown'
): RelevanceScoreResult {
  const normLabel = label.trim().toLowerCase();

  // 1. Semantic Prior Evaluation
  let relevanceTier: RelevanceTier = 'LOW';
  let relevanceScore = 0.25;
  let isReportable = true;
  let exclusionReason: string | undefined = undefined;

  if (EXCLUDED_LABELS.has(normLabel)) {
    relevanceTier = 'EXCLUDED';
    relevanceScore = 0.0;
    isReportable = false;
    exclusionReason = `Scene element, fixture, or non-belonging class: "${label}"`;
  } else if (HIGH_RELEVANCE_LABELS.has(normLabel)) {
    relevanceTier = 'HIGH';
    relevanceScore = 1.0;
    isReportable = true;
  } else if (MEDIUM_RELEVANCE_LABELS.has(normLabel)) {
    relevanceTier = 'MEDIUM';
    relevanceScore = 0.65;
    isReportable = true;
  } else {
    // Check keyword substrings (e.g. "student id card", "water bottle", "blue pen")
    if (
      normLabel.includes('phone') ||
      normLabel.includes('laptop') ||
      normLabel.includes('bottle') ||
      normLabel.includes('wallet') ||
      normLabel.includes('card') ||
      normLabel.includes('key') ||
      normLabel.includes('pen') ||
      normLabel.includes('book') ||
      normLabel.includes('bag') ||
      normLabel.includes('watch')
    ) {
      relevanceTier = 'HIGH';
      relevanceScore = 0.90;
      isReportable = true;
    } else if (
      normLabel.includes('table') ||
      normLabel.includes('chair') ||
      normLabel.includes('couch') ||
      normLabel.includes('person') ||
      normLabel.includes('wall') ||
      normLabel.includes('floor')
    ) {
      relevanceTier = 'EXCLUDED';
      relevanceScore = 0.0;
      isReportable = false;
      exclusionReason = `Contains fixture or non-belonging keyword: "${label}"`;
    }
  }

  // 2. Spatial Centrality Score (Closeness to frame center)
  // [norm_x, norm_y, norm_w, norm_h]
  const [normX, normY, normW, normH] = box.normalized;
  const centerX = normX + normW / 2;
  const centerY = normY + normH / 2;

  // Normalized Euclidean distance to (0.5, 0.5)
  const distFromCenter = Math.sqrt(
    Math.pow(centerX - 0.5, 2) + Math.pow(centerY - 0.5, 2)
  );
  // Max distance in a 1x1 box is ~0.707; map to 0..1
  const centralityScore = Math.max(0, Math.min(1, 1 - distFromCenter * 1.6));

  // 3. Scale / Area Score
  const areaRatio = normW * normH;
  let scaleScore = 1.0;

  if (areaRatio > 0.85) {
    // Massive bounding box covering almost entire frame -> likely background surface or room
    scaleScore = 0.15;
    if (relevanceTier === 'LOW') {
      isReportable = false;
      exclusionReason = 'Bounding box fills entire frame (background surface)';
    }
  } else if (areaRatio < 0.003) {
    // Microscopic detection -> likely edge artifact or noise
    scaleScore = 0.25;
  } else if (areaRatio >= 0.01 && areaRatio <= 0.65) {
    // Standard lost-and-found photograph sweet spot
    scaleScore = 1.0;
  } else {
    scaleScore = 0.70;
  }

  // 4. Geometry & Visual Attributes
  const pixelW = Math.max(1, box.width);
  const pixelH = Math.max(1, box.height);
  const aspectRatio = pixelW / pixelH;

  let shapeDescriptor: 'elongated' | 'square' | 'wide' | 'compact' = 'square';
  if (aspectRatio >= 2.2 || aspectRatio <= 0.45) {
    shapeDescriptor = 'elongated';
  } else if (aspectRatio > 1.35) {
    shapeDescriptor = 'wide';
  } else if (aspectRatio < 0.75) {
    shapeDescriptor = 'compact';
  } else {
    shapeDescriptor = 'square';
  }

  const visualAttributes: VisualAttributes = {
    primaryColor,
    aspectRatio: Math.round(aspectRatio * 100) / 100,
    shapeDescriptor,
  };

  // 5. Composite Candidate Ranking Score
  // Combines relevance prior, detection confidence, centrality, and scale
  const detConfidence = Math.max(0, Math.min(1, box.score));
  const compositeRankingScore =
    relevanceScore *
    (0.50 * detConfidence + 0.30 * centralityScore + 0.20 * scaleScore);

  return {
    relevanceTier,
    relevanceScore: Math.round(relevanceScore * 100) / 100,
    centralityScore: Math.round(centralityScore * 100) / 100,
    scaleScore: Math.round(scaleScore * 100) / 100,
    compositeRankingScore: Math.round(compositeRankingScore * 1000) / 1000,
    isReportable: isReportable && compositeRankingScore >= 0.15,
    exclusionReason,
    visualAttributes,
  };
}
