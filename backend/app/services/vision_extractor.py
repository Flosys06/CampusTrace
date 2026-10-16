import os
import time
import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("campustrace.vision")

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models_storage"
DEFAULT_ONNX_PATH = MODELS_DIR / "mobilenetv2-7.onnx"

# Common color names with typical HSV centroids
COLOR_DEFINITIONS = [
    {"name": "Black", "h_min": 0, "h_max": 180, "s_min": 0, "s_max": 255, "v_min": 0, "v_max": 45},
    {"name": "White", "h_min": 0, "h_max": 180, "s_min": 0, "s_max": 40, "v_min": 195, "v_max": 255},
    {"name": "Silver/Gray", "h_min": 0, "h_max": 180, "s_min": 0, "s_max": 50, "v_min": 45, "v_max": 195},
    {"name": "Red", "h_min": 0, "h_max": 10, "s_min": 50, "s_max": 255, "v_min": 50, "v_max": 255},
    {"name": "Red", "h_min": 170, "h_max": 180, "s_min": 50, "s_max": 255, "v_min": 50, "v_max": 255},
    {"name": "Orange", "h_min": 11, "h_max": 25, "s_min": 60, "s_max": 255, "v_min": 50, "v_max": 255},
    {"name": "Yellow", "h_min": 26, "h_max": 35, "s_min": 60, "s_max": 255, "v_min": 50, "v_max": 255},
    {"name": "Green", "h_min": 36, "h_max": 80, "s_min": 40, "s_max": 255, "v_min": 40, "v_max": 255},
    {"name": "Teal/Cyan", "h_min": 81, "h_max": 99, "s_min": 40, "s_max": 255, "v_min": 40, "v_max": 255},
    {"name": "Blue", "h_min": 100, "h_max": 130, "s_min": 40, "s_max": 255, "v_min": 40, "v_max": 255},
    {"name": "Purple/Violet", "h_min": 131, "h_max": 155, "s_min": 40, "s_max": 255, "v_min": 40, "v_max": 255},
    {"name": "Pink", "h_min": 156, "h_max": 169, "s_min": 35, "s_max": 255, "v_min": 70, "v_max": 255},
    {"name": "Brown", "h_min": 10, "h_max": 22, "s_min": 70, "s_max": 255, "v_min": 30, "v_max": 140},
]

class VisionFeatureExtractor:
    """
    Advanced multimodal Computer Vision embedding extractor:
    - 256 dimensions: Deep CNN semantic features extracted from MobileNetV2 (penultimate pooling layer)
    - 128 dimensions: Illumination-equalized (CLAHE) global HSV color distribution
    - 64 dimensions: Spatial 2x2 grid color pyramid
    - 32 dimensions: Sobel gradient orientation distribution (contour & shape edges)
    - 32 dimensions: Texture, contrast, and aspect-ratio statistics
    Total: Exactly 512 dimensions, L2-normalized.
    """

    def __init__(self, onnx_model_path: Optional[str] = None):
        self.version = "CampusTrace-Vision-v2.0"
        self.embedding_dim = 512
        self.onnx_model_path = onnx_model_path or str(DEFAULT_ONNX_PATH)
        self.ort_session = None
        self.intermediate_output_name = "mobilenetv20_features_pool0_fwd"
        self.last_inference_time_ms = 0.0
        self._init_deep_model()

    def _init_deep_model(self):
        """Initializes the deep learning ONNX runtime session for feature extraction."""
        target_path = Path(self.onnx_model_path)
        if not target_path.exists():
            logger.warning(f"ONNX model file not found at {target_path}. Using deterministic OpenCV fallback.")
            return

        try:
            import onnx
            import onnxruntime as ort

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            model = onnx.load(str(target_path))
            has_intermediate = any(o.name == self.intermediate_output_name for o in model.graph.output)
            if not has_intermediate:
                model.graph.output.append(onnx.helper.make_tensor_value_info(
                    self.intermediate_output_name,
                    onnx.TensorProto.FLOAT,
                    [1, 1280, 1, 1]
                ))

            self.ort_session = ort.InferenceSession(
                model.SerializeToString(),
                opts,
                providers=["CPUExecutionProvider"]
            )
            logger.info("MobileNetV2 deep feature extraction session initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to load ONNX feature extractor: {e}. Falling back to multi-scale CV.", exc_info=True)
            self.ort_session = None

    def get_health(self) -> Dict[str, Any]:
        return {
            "engine_name": "CampusTrace Deep Vision Extractor",
            "version": self.version,
            "status": "OPERATIONAL_DEEP_CNN" if self.ort_session else "FALLBACK_OPENCV_MULTISCALE",
            "feature_dimensions": self.embedding_dim,
            "last_inference_time_ms": round(self.last_inference_time_ms, 2)
        }

    def _classify_color_name(self, h: float, s: float, v: float) -> str:
        """Maps HSV values to human-intelligible color categories."""
        if v < 45:
            return "Black"
        if s < 35 and v > 195:
            return "White"
        if s < 45:
            return "Silver/Gray"

        for rule in COLOR_DEFINITIONS:
            if (rule["h_min"] <= h <= rule["h_max"] and
                rule["s_min"] <= s <= rule["s_max"] and
                rule["v_min"] <= v <= rule["v_max"]):
                return rule["name"]
        return "Multi-color"

    def _extract_dominant_colors(self, hsv_image: np.ndarray, k: int = 3) -> List[Dict[str, Any]]:
        """Finds top k dominant colors using k-means clustering in HSV space."""
        resized = cv2.resize(hsv_image, (64, 64), interpolation=cv2.INTER_AREA)
        pixels = resized.reshape((-1, 3)).astype(np.float32)

        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)

        counts = np.bincount(labels.flatten(), minlength=k)
        total_pixels = len(labels)

        dominant = []
        for i in range(k):
            h, s, v = centers[i]
            percentage = round(float(counts[i]) / total_pixels, 3)
            color_name = self._classify_color_name(h, s, v)
            dominant.append({
                "name": color_name,
                "percentage": percentage,
                "hsv": [round(float(h), 1), round(float(s), 1), round(float(v), 1)]
            })

        dominant.sort(key=lambda x: x["percentage"], reverse=True)
        return dominant

    def _preprocess_image(self, img_bgr: np.ndarray, target_size: int = 224) -> Tuple[np.ndarray, np.ndarray, np.ndarray, int, int]:
        """
        Aspect-ratio preserving letterbox preprocessing with CLAHE illumination equalization.
        CLAHE is applied to the image content itself to prevent border contamination.
        Returns:
            canvas (BGR 224x224 with neutral padding for CNN)
            cnn_input_tensor (1x3x224x224 float32 normalized ImageNet tensor)
            resized_equalized (equalized image without padding)
            orig_w, orig_h
        """
        h_orig, w_orig = img_bgr.shape[:2]

        # Preserve aspect ratio
        scale = target_size / max(h_orig, w_orig)
        nw, nh = max(1, int(w_orig * scale)), max(1, int(h_orig * scale))
        resized = cv2.resize(img_bgr, (nw, nh), interpolation=cv2.INTER_AREA)

        # CLAHE (Contrast Limited Adaptive Histogram Equalization) on L-channel in LAB space
        # Applied directly to image content before padding to avoid letterbox boundary contamination
        lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        resized_equalized = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

        # Letterbox canvas for CNN inference (MobileNetV2 expects 224x224)
        canvas = np.full((target_size, target_size, 3), 128, dtype=np.uint8)
        dy = (target_size - nh) // 2
        dx = (target_size - nw) // 2
        canvas[dy:dy + nh, dx:dx + nw] = resized_equalized

        # Standard ImageNet normalization for CNN tensor
        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        cnn_tensor = ((rgb - mean) / std).transpose(2, 0, 1)[np.newaxis, :]

        return canvas, cnn_tensor, resized_equalized, w_orig, h_orig

    def _extract_deep_features(self, cnn_tensor: np.ndarray) -> np.ndarray:
        """
        Runs MobileNetV2 deep convolution inference, pools 1280 to 256 invariant features,
        centers against positive activation bias, and normalizes.
        """
        if self.ort_session is None:
            return np.zeros(256, dtype=np.float32)

        raw = self.ort_session.run([self.intermediate_output_name], {"data": cnn_tensor})[0].flatten()
        # Mean pool 1280 into 256 channels
        deep_256 = raw.reshape((256, 5)).mean(axis=1)
        # Center vector to eliminate positive activation bias
        deep_centered = deep_256 - float(np.mean(deep_256))
        norm = np.linalg.norm(deep_centered)
        if norm > 0:
            deep_centered = deep_centered / norm
        return deep_centered

    def extract_features(self, image_path: Path) -> Dict[str, Any]:
        """
        Extracts 512-dimensional normalized embedding and visual metadata from an image.
        Color histograms, dominant colors, and Sobel gradients are extracted strictly
        from the actual image content to eliminate letterbox border artifacts.
        """
        start_t = time.time()
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found at {image_path}")

        # Load image via OpenCV, with PIL fallback for unicode paths / format quirks
        img_bgr = cv2.imread(str(image_path))
        if img_bgr is None or img_bgr.size == 0:
            pil_img = Image.open(image_path).convert("RGB")
            img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Preprocessing: canvas for CNN, resized_equalized for direct feature extraction
        canvas, cnn_tensor, resized_equalized, w_orig, h_orig = self._preprocess_image(img_bgr, target_size=224)
        nh, nw = resized_equalized.shape[:2]

        hsv = cv2.cvtColor(resized_equalized, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(resized_equalized, cv2.COLOR_BGR2GRAY)

        # 1. Deep Semantic CNN Features (256 dims)
        deep_vec = self._extract_deep_features(cnn_tensor)

        # 2. Global Color Histograms (128 dims: 64 Hue, 32 Sat, 32 Val) - computed on image content only
        hist_h = cv2.calcHist([hsv], [0], None, [64], [0, 180]).flatten()
        hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
        hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
        color_hist = np.concatenate([hist_h, hist_s, hist_v]).astype(np.float32)
        norm_col = np.linalg.norm(color_hist)
        if norm_col > 0:
            color_hist = color_hist / norm_col

        # 3. Spatial 2x2 Grid Color Pyramids (4 cells x 16 hue bins = 64 dims)
        h_mid = max(1, nh // 2)
        w_mid = max(1, nw // 2)
        quads = [
            hsv[0:h_mid, 0:w_mid],
            hsv[0:h_mid, w_mid:],
            hsv[h_mid:, 0:w_mid],
            hsv[h_mid:, w_mid:]
        ]
        spatial_color = []
        for cell in quads:
            if cell.size > 0:
                cell_hist = cv2.calcHist([cell], [0], None, [16], [0, 180]).flatten()
            else:
                cell_hist = np.zeros(16, dtype=np.float32)
            spatial_color.append(cell_hist)
        spatial_color_vec = np.concatenate(spatial_color).astype(np.float32)
        norm_spat = np.linalg.norm(spatial_color_vec)
        if norm_spat > 0:
            spatial_color_vec = spatial_color_vec / norm_spat

        # 4. Sobel Gradient Orientation Histogram (32 bins = 32 dims) - no artificial border edges
        sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        mag, angle = cv2.cartToPolar(sobel_x, sobel_y, angleInDegrees=True)
        grad_hist, _ = np.histogram(angle, bins=32, range=(0, 360), weights=mag)
        grad_hist = grad_hist.astype(np.float32)
        norm_grad = np.linalg.norm(grad_hist)
        if norm_grad > 0:
            grad_hist = grad_hist / norm_grad

        # 5. Texture & Spatial Edge Statistics (32 dims)
        edges = cv2.Canny(gray, 100, 200)
        edge_density = float(np.count_nonzero(edges)) / max(1, (nh * nw))
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        stats_vec = np.zeros(32, dtype=np.float32)
        stats_vec[0] = edge_density
        stats_vec[1] = math.log1p(max(0.0, laplacian_var)) / 10.0
        stats_vec[2] = float(np.mean(mag)) / 255.0
        stats_vec[3] = float(np.std(mag)) / 255.0
        stats_vec[4] = float(w_orig) / max(1.0, float(h_orig))
        norm_stats = np.linalg.norm(stats_vec)
        if norm_stats > 0:
            stats_vec = stats_vec / norm_stats

        # Assemble full vector: 256 + 128 + 64 + 32 + 32 = 512 dimensions
        if self.ort_session is not None:
            # Weighted multi-modal fusion
            full_vector = np.concatenate([
                deep_vec * 0.55,
                color_hist * 0.22,
                spatial_color_vec * 0.12,
                grad_hist * 0.08,
                stats_vec * 0.03
            ])
        else:
            # Pure OpenCV multi-scale fallback (also 512 dims)
            fallback_deep = np.tile(color_hist, 2) # 256 dims
            full_vector = np.concatenate([
                fallback_deep * 0.40,
                color_hist * 0.25,
                spatial_color_vec * 0.18,
                grad_hist * 0.12,
                stats_vec * 0.05
            ])

        # L2-normalize vector so cosine similarity is strictly the dot product
        norm_full = np.linalg.norm(full_vector)
        if norm_full > 0:
            full_vector = full_vector / norm_full

        dominant_colors = self._extract_dominant_colors(hsv, k=3)
        self.last_inference_time_ms = (time.time() - start_t) * 1000.0

        return {
            "embedding": [round(float(v), 6) for v in full_vector.tolist()],
            "dominant_colors": dominant_colors,
            "primary_color": dominant_colors[0]["name"] if dominant_colors else "Unknown",
            "edge_density": round(edge_density, 4),
            "brightness": round(float(np.mean(resized_equalized[:, :, 0])) / 255.0, 3),
            "aspect_ratio": round(float(w_orig) / max(1.0, float(h_orig)), 2),
            "model_version": self.version
        }

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Computes cosine similarity between two feature vectors.
        Returns value strictly between 0.0 and 1.0.
        """
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        sim = float(np.dot(a, b) / (norm_a * norm_b))
        return max(0.0, min(1.0, sim))

    @staticmethod
    def calibrate_visual_similarity(raw_score: float) -> float:
        """
        Properly calibrates raw cosine similarity into a human-meaningful match confidence.
        Baseline floor of 0.45 maps to zero confidence.
        Raw scores between 0.45 and 0.70 map to 0.0 - 0.55.
        Raw scores above 0.70 map to 0.55 - 1.0.
        """
        if raw_score <= 0.45:
            return max(0.0, round(float(raw_score * 0.15), 4))
        if raw_score < 0.70:
            calibrated = (raw_score - 0.45) / (0.70 - 0.45) * 0.55
            return round(float(calibrated), 4)
        calibrated = 0.55 + ((raw_score - 0.70) / (1.0 - 0.70)) * 0.45
        return max(0.0, min(1.0, round(float(calibrated), 4)))

vision_extractor = VisionFeatureExtractor()
