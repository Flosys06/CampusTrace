# CampusTrace Local AI Vision Pipeline: Technical Implementation

## 1. Architectural Overview

The upgraded CampusTrace AI vision pipeline operates completely within the client browser. It eliminates external cloud vision APIs, prevents unnecessary image uploads prior to report submission, and achieves sub-90ms local inference using modern WebAssembly SIMD and WebGPU hardware acceleration.

```
+-----------------------------------------------------------------------------------+
|                            CLIENT BROWSER (Vite + React)                          |
|                                                                                   |
|  +--------------------+        +---------------------+      +------------------+  |
|  | Camera / Gallery   | -----> | localVisionPipeline | ---> | Dedicated Web    |  |
|  | File Selection     |        | Orchestrator        |      | Worker           |  |
|  +--------------------+        +----------+----------+      +--------+---------+  |
|                                           |                          |            |
|                                           |                          v            |
|                                           |             +-----------------------+ |
|                                           |             | ONNX Runtime Web      | |
|                                           |             | WASM SIMD / WebGPU    | |
|                                           |             +-----------+-----------+ |
|                                           |                         |             |
|                                           |     Stage 1: YOLOv5n    v             |
|                                           |     Object Detection & Localization   |
|                                           |     [640x640 Letterbox Preprocess]    |
|                                           |                         |             |
|                                           |     Stage 2: Crop-Based v             |
|                                           |     HSV Color Extraction              |
|                                           |                         |             |
|                                           |     Stage 3: Ambiguity Check          |
|                                           |     (Secondary MobileNet Whitelist)   |
|                                           |                         |             |
|                                           |     Stage 4: Taxonomy Mapping         |
|                                           |     & Non-Hallucinatory Formatting    |
|                                           |                         |             |
|                                           v                         v             |
|  +-----------------------------------------------------------------------------+  |
|  | Non-Destructive Autofill: Item Title, Category, Color, Factual Description   |  |
|  | Interactive Bounding Box Overlay & Calibrated Confidence Indicator Badge    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure & Key Modules

All vision services are located under `frontend/src/services/vision/`:

| Module | File Path | Core Responsibility |
| :--- | :--- | :--- |
| **Types & Contracts** | `src/services/vision/types.ts` | Type definitions for `BoundingBox`, `DetectedObject`, `ColorExtractionResult`, and `LocalVisionResult`. |
| **YOLO Detector** | `src/services/vision/yoloDetector.ts` | 640x640 letterboxing, IEEE-754 FP16/FP32 tensor assembly, ONNX Runtime session execution, and Non-Maximum Suppression (IoU: 0.45, Threshold: 0.22). |
| **MobileNet Classifier** | `src/services/vision/mobilenetClassifier.ts` | Targeted secondary classifier with a strict 30-class campus whitelist for ambiguous objects (keys, wallets, locks, watches). |
| **Color Extractor** | `src/services/vision/colorExtractor.ts` | Inset bounding-box crop isolation, HSV chromatic histogram binning (12 distinct campus colors), and achromatic silver/grey/black/white detection. |
| **Taxonomy Mapper** | `src/services/vision/taxonomyMapper.ts` | Deterministic mapping between COCO 80 / ImageNet classes and CampusTrace categories; factual title and description formulation. |
| **Web Worker** | `src/services/vision/visionWorker.ts` | Dedicated background Web Worker executing image decoding, tensor allocation, and inference off the UI thread. |
| **Pipeline Orchestrator** | `src/services/vision/localVisionPipeline.ts` | Singleton orchestrator managing lifecycle, prewarming, request ID stale-result cancellation, and worker-to-main-thread fallback. |

---

## 3. Staged Pipeline Execution Workflow

### Stage 1: Validation & Aspect-Ratio Preserving Letterbox
- The user selects a photo (`JPEG`, `PNG`, or `WebP` up to 10MB).
- Image dimensions are validated. A 640x640 letterbox canvas is initialized with neutral grey padding (`rgb(114, 114, 114)`), preserving the aspect ratio of the photographed item without distortion.

### Stage 2: Primary YOLOv5n Nano Detection
- Input tensor dimensions: `[1, 3, 640, 640]`.
- Output tensor dimensions: `[1, 25200, 85]` containing center coordinates, width, height, objectness score, and 80 class logits.
- Efficient NMS (Non-Maximum Suppression) extracts the highest-confidence campus object bounding box.
- Model size: **3.98 MB**, delivering typical browser inference in 65ms–95ms on WASM SIMD.

### Stage 3: Crop-Based Dominant Color Extraction
- Rather than calculating average RGB over the whole picture, the color extractor crops the bounding box coordinates.
- A 15% inner margin is applied to discard surrounding desk, floor, or wall pixels.
- The pixel data is mapped into Hue, Saturation, and Value (HSV):
  - Achromatic detection: Saturation < 38 maps into Black, Grey, Silver, or White based on brightness.
  - Chromatic detection: Hue is binned across 12 calibrated ranges: Red, Orange, Yellow, Green, Teal, Blue, Purple, Pink, Brown, Gold, Navy, and Multi-color.

### Stage 4: Targeted Secondary Classification (When Ambiguous)
- If the primary detector finds no confident match (confidence < 0.22), the secondary `MobileNetV2` classifier evaluates the image.
- Results are strictly filtered against a **Campus Whitelist** (`IMAGENET_CAMPUS_MAP`), rejecting nonsensical predictions like wild animals or vehicles.
- If no whitelisted class is found, the system conservatively falls back to `Other Belongings` / `Campus Belonging` with a `LOW` confidence tier.

### Stage 5: Field-Level Prediction Formatting (Zero Hallucination)
- **Item Title**: Combines color and clean category name (e.g., "Silver Laptop", "Black Backpack", "Blue Smartphone").
- **Category**: Deterministically mapped to existing active campus categories.
- **Color**: Standardized campus color vocabulary.
- **Description**: Factual and objective (e.g., *"Silver laptop detected on campus. Please review condition and specific marks before submitting."*). The model never guesses brands, internal specs, or unseen contents.
- **Location & Date**: Location is never guessed from the image; date defaults to the current local date.

---

## 4. UI Non-Destructive Autofill Integration

In both `CameraReportFlow.tsx` and `CreateReportPage.tsx`:
1. **Model Prewarming**: On modal or page mount, `localVisionPipeline.prewarm()` initializes the WASM engine in the background, eliminating cold-start latency.
2. **Interactive Bounding Box**: When an object is detected, an animated bounding box with tag chips overlays the preview image, showing the student exactly what the AI localized.
3. **Non-Destructive Filling**: Fields are only filled if they are currently blank or have default values. A student's manual typing is never overwritten.
4. **Confidence Badge**:
   - `HIGH (>= 75%)`: Emerald badge indicating strong detection.
   - `MEDIUM (50%–74%)`: Amber badge indicating likely match.
   - `LOW (< 50%)`: Rose/Amber badge prompting the student to confirm details.

---

## 5. Offline Capabilities & Local Asset Storage

To guarantee 100% offline functionality:
- All models reside in `frontend/public/models/`:
  - `yolov5n.onnx` (3.98 MB)
  - `mobilenetv2-7.onnx` (14.24 MB)
  - `imagenet_classes.json` (35.3 KB)
- All WASM runtime binaries reside in `frontend/public/ort-wasm/`:
  - `ort-wasm-simd-threaded.wasm`
  - `ort-wasm-simd-threaded.jsep.wasm`
  - `ort-wasm-simd-threaded.mjs`
- Zero CDN requests are made during runtime (`ort.env.wasm.wasmPaths = '/ort-wasm/'`).
