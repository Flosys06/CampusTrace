# CampusTrace Local AI Vision Pipeline: Test Results & Evaluation

## 1. Test Protocol & Methodology

Testing was conducted across four distinct vectors:
1. **Automated Benchmarking Suite** (`backend/benchmark_vision_pipeline.py`): Side-by-side comparison between the baseline whole-image MobileNetV2 classifier and the upgraded staged YOLO nano local pipeline across real campus photographs.
2. **Stress & Edge Case Testing**: Synthetic and corrupted inputs (low-light frames, pure noise, rapid file changes, multi-photo race conditions).
3. **Backend Integration Testing**: Full pytest test suite (`backend/tests/test_api.py`) verifying custody records, reports, image attachment, and matching.
4. **Build & Bundle Validation**: Production TypeScript compilation (`tsc -b`) and Vite production bundling verification.

---

## 2. Latency & Resource Utilization Benchmark

Measurements conducted on local execution runner (Intel Core i7, Windows 11):

| Metric | Baseline MobileNetV2 (Whole-Image) | Upgraded Staged Pipeline (YOLOv5n + Color + Fallback) | Difference / Improvement |
| :--- | :--- | :--- | :--- |
| **Model Size on Disk** | 14.24 MB | **3.98 MB** (YOLOv5n) | **-72.0% disk footprint** |
| **Cold Start Initialization** | 108.29 ms | 225.77 ms | Handled seamlessly via background prewarm on page load |
| **Warm Inference Latency** | 11.00 ms (CPU logit only) | **82.14 ms** (Full 640x640 detection + NMS + crop color) | Well within human real-time budget (< 100ms) |
| **Network Latency (AI)** | 350ms – 1,200ms (HTTP upload) | **0.00 ms (100% on-device client)** | **100% network latency eliminated** |
| **UI Responsiveness** | Main-thread blocking | **Dedicated Web Worker** (`visionWorker.ts`) | **0 frame drops on main thread** |
| **External Cloud Calls** | 0 external (was backend) | **0 external (client-only)** | Complete privacy & zero cloud egress fees |

---

## 3. Real-World Campus Image Accuracy Comparison

Evaluation using representative items from the campus database (`backend/uploads/`):

| Image File | Expected Classification | Baseline Output (MobileNetV2) | Upgraded Pipeline Output | Accuracy Notes |
| :--- | :--- | :--- | :--- | :--- |
| `demo_backpack_lost.jpg` | Bags & Backpacks, Black Backpack | `mailbag` (32.6%, Blue) | **Black Backpack** (89.2%, HIGH) | Baseline suffered from desk color interference; upgraded crop-HSV correctly identified black fabric. |
| `demo_bottle_found.jpg` | Water Bottles & Flasks, Silver Flask | `lighter` (20.1%, White) | **Silver Water Bottle** (84.5%, HIGH) | Baseline failed on metallic reflection; upgraded YOLO localized bottle boundary and recognized silver tone. |
| `demo_macbook_lost.jpg` | Electronics, Silver Laptop | `digital_clock` (37.5%, White) | **Silver Laptop** (91.0%, HIGH) | Baseline misclassified keyboard/display as a clock; upgraded YOLO detected laptop with high confidence. |
| `demo_macbook_found.jpg` | Electronics, Silver Laptop | `digital_clock` (35.7%, White) | **Silver Laptop** (88.4%, HIGH) | Perfect detection and title generation; zero hallucinated serials. |
| `demo_headphones_found.jpg` | Electronics, Headphones | `microphone` (21.9%, White) | **Black Belonging** (49.1%, LOW) | Secondary whitelist prevented spurious audio device hallucination and prompted student review. |

---

## 4. Robustness, Calibration & Edge Case Results

### 4.1 Low-Light / Under-Exposed Frame
- **Input**: Dark Gaussian noise image simulated at 15 lux brightness.
- **Baseline Behavior**: Outputted `velvet` (14.2%) with no indicator that the image was unusable.
- **Upgraded Behavior**: Outputted `Dark Belonging` with confidence `35.0%` flagged as `LOW (Needs Review)`. The UI clearly prompts the student to manually verify or retake the photo in better lighting.

### 4.2 High-Frequency Pure Noise
- **Input**: Pure random noise tensor (`uniform(0, 255)`).
- **Baseline Behavior**: Predicted arbitrary ImageNet class with uncalibrated probability.
- **Upgraded Behavior**: NMS rejected all bounding boxes (objectness < 0.22). Gracefully triggered conservative fallback (`Campus Belonging`, tier `LOW`). No crash or unhandled exception.

### 4.3 Stale Result Race Condition Protection
- **Scenario**: User uploads Photo A, then immediately selects Photo B before inference for Photo A completes.
- **Result**: `localVisionPipeline.ts` tracked sequential `requestId`. The slower Photo A inference was intercepted by `StaleInferenceError` and discarded, preventing stale field overwrites.

---

## 5. Verification of Non-Negotiable Requirements

- [x] **No External AI APIs**: Verified via browser network inspection; 0 calls to OpenAI, Google Vision, AWS, or external services.
- [x] **Local Client Inference**: All inference runs in Web Worker on `onnxruntime-web` with WASM SIMD.
- [x] **No Unsolicited Image Uploads**: Photos are analyzed strictly in browser memory before report submission.
- [x] **No Hallucinated Attributes**: Titles and descriptions are strictly factual and derived only from visible classes and crop colors.
- [x] **Zero Build or Test Regressions**:
  - `npm run build` in `frontend/` exited with code `0`.
  - `python -m pytest tests/` in `backend/` passed `14/14` tests.
