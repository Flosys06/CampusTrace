import { ColorExtractionResult } from './types';

interface ColorBin {
  name: string;
  count: number;
  totalR: number;
  totalG: number;
  totalB: number;
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const diff = max - min;

  let h = 0;
  if (diff === 0) {
    h = 0;
  } else if (max === rf) {
    h = ((gf - bf) / diff) % 6;
  } else if (max === gf) {
    h = (bf - rf) / diff + 2;
  } else {
    h = (rf - gf) / diff + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return [h, s, v];
}

/**
 * Extracts true dominant color specifically from a cropped object region.
 * Excludes background border pixels to minimize background table/desk contamination.
 */
export function extractDominantColor(
  ctx: CanvasRenderingContext2D,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number
): ColorExtractionResult {
  const cw = Math.max(1, Math.round(cropWidth));
  const ch = Math.max(1, Math.round(cropHeight));

  // Inset by 10% on each edge to ignore background boundaries
  const insetX = Math.round(cw * 0.1);
  const insetY = Math.round(ch * 0.1);
  const sampleX = Math.max(0, Math.round(cropX) + insetX);
  const sampleY = Math.max(0, Math.round(cropY) + insetY);
  const sampleW = Math.max(1, cw - insetX * 2);
  const sampleH = Math.max(1, ch - insetY * 2);

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
  } catch {
    return {
      primaryColor: 'Unknown',
      isAchromatic: true,
      confidence: 0.5,
      sampleRgb: [128, 128, 128],
    };
  }

  const data = imgData.data;
  const totalPixels = sampleW * sampleH;
  if (totalPixels === 0) {
    return {
      primaryColor: 'Unknown',
      isAchromatic: true,
      confidence: 0.5,
      sampleRgb: [128, 128, 128],
    };
  }

  // Pre-defined color bins
  const bins: Record<string, ColorBin> = {
    Black: { name: 'Black', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    White: { name: 'White', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    'Silver / Gray': { name: 'Silver / Gray', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Blue: { name: 'Blue', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Navy: { name: 'Navy', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Red: { name: 'Red', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Green: { name: 'Green', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Yellow: { name: 'Yellow', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Orange: { name: 'Orange', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Brown: { name: 'Brown', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Purple: { name: 'Purple', count: 0, totalR: 0, totalG: 0, totalB: 0 },
    Pink: { name: 'Pink', count: 0, totalR: 0, totalG: 0, totalB: 0 },
  };

  let validPixels = 0;
  // Step sample for high resolution images to ensure <5ms execution
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels) / 60));

  for (let y = 0; y < sampleH; y += step) {
    for (let x = 0; x < sampleW; x += step) {
      const idx = (y * sampleW + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 128) continue; // transparent pixel

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, v] = rgbToHsv(r, g, b);
      validPixels++;

      // Achromatic classification
      if (v < 0.20 || (v < 0.26 && s < 0.30)) {
        bins.Black.count++;
        bins.Black.totalR += r;
        bins.Black.totalG += g;
        bins.Black.totalB += b;
      } else if (v > 0.82 && s < 0.16) {
        bins.White.count++;
        bins.White.totalR += r;
        bins.White.totalG += g;
        bins.White.totalB += b;
      } else if (s < 0.18 && v >= 0.20 && v <= 0.82) {
        bins['Silver / Gray'].count++;
        bins['Silver / Gray'].totalR += r;
        bins['Silver / Gray'].totalG += g;
        bins['Silver / Gray'].totalB += b;
      } else {
        // Chromatic classification by circular hue sectors
        let targetKey = 'Blue';
        if (h >= 345 || h < 15) {
          targetKey = 'Red';
        } else if (h >= 15 && h < 42) {
          targetKey = v < 0.45 ? 'Brown' : 'Orange';
        } else if (h >= 42 && h < 68) {
          targetKey = 'Yellow';
        } else if (h >= 68 && h < 165) {
          targetKey = 'Green';
        } else if (h >= 165 && h < 258) {
          targetKey = v < 0.45 ? 'Navy' : 'Blue';
        } else if (h >= 258 && h < 315) {
          targetKey = 'Purple';
        } else {
          targetKey = 'Pink';
        }

        bins[targetKey].count++;
        bins[targetKey].totalR += r;
        bins[targetKey].totalG += g;
        bins[targetKey].totalB += b;
      }
    }
  }

  if (validPixels === 0) {
    return {
      primaryColor: 'Unknown',
      isAchromatic: true,
      confidence: 0.5,
      sampleRgb: [128, 128, 128],
    };
  }

  // Sort bins by frequency
  const sortedBins = Object.values(bins).sort((a, b) => b.count - a.count);
  const primary = sortedBins[0];
  const secondary = sortedBins[1];

  const primaryRatio = primary.count / validPixels;
  const secondaryRatio = secondary ? secondary.count / validPixels : 0;

  let selectedColor = primary.name;
  let isAchromatic = ['Black', 'White', 'Silver / Gray'].includes(primary.name);
  let confidence = Math.min(0.95, Math.max(0.40, primaryRatio));

  if (primaryRatio < 0.32 && secondaryRatio > 0.22) {
    selectedColor = 'Multi-color';
    isAchromatic = false;
    confidence = 0.70;
  }

  const sampleR = primary.count > 0 ? Math.round(primary.totalR / primary.count) : 128;
  const sampleG = primary.count > 0 ? Math.round(primary.totalG / primary.count) : 128;
  const sampleB = primary.count > 0 ? Math.round(primary.totalB / primary.count) : 128;

  return {
    primaryColor: selectedColor,
    secondaryColor: secondaryRatio > 0.20 ? secondary.name : undefined,
    isAchromatic,
    confidence: Math.round(confidence * 100) / 100,
    sampleRgb: [sampleR, sampleG, sampleB],
  };
}
