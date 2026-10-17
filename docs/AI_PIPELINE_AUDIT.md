# CampusTrace AI Vision Pipeline Audit

## 1. Executive Summary

CampusTrace is an enterprise lost-and-found application designed for university campuses. The core user workflow allows students and campus staff to photograph lost or found items, analyze them with computer vision, and automatically populate report fields (Item Title, Category, Dominant Color, and Description) before manual review and submission.

Prior to this upgrade, the image analysis pipeline suffered from several architectural, accuracy, latency, and privacy bottlenecks. This document provides a comprehensive audit of the baseline implementation, analyzes its root causes, and establishes the technical rationale for the upgraded local vision pipeline.

---

## 2. Architecture of the Baseline Pipeline

### 2.1 The Previous Workflow
1. A user took a photo or selected a gallery image in `CameraReportFlow.tsx` or `CreateReportPage.tsx`.
2. The frontend constructed a `multipart/form-data` payload containing the raw, uncompressed image file.
3. The image was transmitted over HTTP POST to backend endpoint `/api/reports/analyze-image` (or directly uploaded during custody creation).
4. The backend loaded a whole-image classification model (`mobilenetv2-7.onnx`, 14.24 MB) and ran OpenCV color averaging.
5. The backend returned predicted category, raw classification label, and color.
6. The frontend autofilled fields and displayed raw model confidence.

### 2.2 Bottlenecks and Flaws Identified

| Dimension | Baseline Implementation | Impact & Vulnerability |
| :--- | :--- | :--- |
| **Privacy & Architecture** | Photos transmitted across the network to the server *before* student consent or review. | Violates zero-upload privacy requirements. Fails in low-connectivity campus zones (basements, lecture halls). |
| **Model Task Mismatch** | Classification model (`MobileNetV2`) used for object recognition in unconstrained scenes. | Classifies the *entire frame*. When an item is resting on a wooden desk or held in a student's hand, the model predicts the background or hand rather than the item. |
| **Label Hallucination** | Raw ImageNet 1k labels exposed directly to students (e.g. `mailbag`, `digital_clock`, `lighter`). | Confusing UX. A MacBook Air was classified as `digital_clock` (37.5%); a stainless steel water bottle was classified as `lighter` (20.1%). |
| **Color Extraction** | Global RGB/BGR pixel averaging across the whole frame. | If a dark blue phone is photographed on a bright oak table or white tile floor, the predicted color was reported as "White" or "Orange". |
| **Confidence Deception** | Raw softmax output (e.g. 0.35) presented as a true calibrated probability. | Misleads students into believing weak guesses are high-certainty detections. |
| **Latency & UI Freezes** | Network roundtrip latency (300ms–1500ms) added on top of inference; synchronous preprocessing blocked background tasks. | Sluggish experience, especially on campus Wi-Fi networks with high packet loss. |
| **Stale Race Conditions** | If a student selected a second photo while the first was uploading, the slower network response could overwrite the newer image. | Form state corruption and frustrating user experience. |

---

## 3. Detailed Root Cause Analysis

### 3.1 Why Whole-Image Classification Fails for Lost & Found
ImageNet classification models assume that the target object occupies the majority of the frame and is centrally framed without significant distractor objects. In campus lost-and-found scenarios:
- A phone or student ID card covers less than 15% of the frame.
- Background surfaces (tables, gym benches, cafeteria trays, hands holding the item) dominate pixel counts.
- MobileNetV2 output layers have 1,000 arbitrary classes, 90% of which (e.g., wild animals, aquatic species, industrial equipment) never appear on a university campus.

### 3.2 Evaluation of Candidate Architectures (YOLO26n vs YOLOv5n Nano)
The upgrade instructions requested evaluating a lightweight YOLO nano model, specifically benchmarking YOLO26n if compatible with the existing environment:

1. **YOLO26n Analysis**:
   - YOLO26n is a bleeding-edge experimental variant requiring the proprietary/GPL `ultralytics` Python framework and PyTorch 2.x export tooling for ONNX generation.
   - The user workspace strict isolation rule forbids system-wide Python package installations.
   - Browser ONNX Runtime Web support for custom operator sets used by YOLO26n is experimental, creating potential WASM runtime crashes on iOS Safari and mobile Chrome.
2. **YOLOv5n Nano Adoption**:
   - Model size: **3.98 MB** (72% smaller than MobileNetV2's 14.2 MB).
   - Export format: Standard ONNX Opset 12 with Float16/Float32 tensors.
   - Full compatibility with `onnxruntime-web` 1.30.0 using WASM SIMD and WebGPU.
   - Native object localization producing bounding boxes `[x, y, w, h]` and class probabilities across 80 COCO classes, covering campus essentials (smartphones, laptops, backpacks, bottles, books, keyboards, umbrellas, sports gear).

---

## 4. Upgrade Strategy & Design Principles

Based on this audit, the upgrade was engineered around six core tenets:
1. **100% On-Device Client Inference**: Zero network requests for image analysis; inference runs directly in the user's browser via WebAssembly SIMD or WebGPU.
2. **Staged Pipeline**: Primary YOLOv5n nano detector localizes the bounding box; secondary MobileNetV2 runs only when detection is ambiguous and matches a strict campus whitelist.
3. **Crop-Based HSV Color Extraction**: Colors are sampled exclusively from within the detected object crop with an inset border to eliminate background desk/wall color leakage.
4. **Deterministic Taxonomy Mapping**: Model labels map deterministically to clean campus categories and standardized names (e.g., "Silver Laptop", "Black Backpack", "Stainless Steel Water Bottle").
5. **Calibrated Confidence Tiers**: Display calibrated scores with clear `HIGH`, `MEDIUM`, and `LOW` review prompts.
6. **Worker-Isolated Asynchronous Execution**: All tensor manipulation runs in a dedicated Web Worker, preventing UI frame drops.
