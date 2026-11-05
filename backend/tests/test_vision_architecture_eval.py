import pytest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.ninja_detection_service import (
    ninja_detection_service,
    get_label_relevance_score,
    EXCLUDED_SCENE_LABELS,
    HIGH_RELEVANCE_LABELS,
    LABEL_TO_CATEGORY,
)

client = TestClient(app)

class TestVisionArchitectureEvaluation:
    """
    Generalized Computer-Vision & Relevance Layer Evaluation Suite.
    Verifies multi-object preservation, context-aware relevance ranking,
    furniture/person suppression, principled abstention, and taxonomy alignment.
    """

    def setup_method(self):
        ninja_detection_service.clear_cache()
        self.original_key = settings.API_NINJAS_API_KEY
        settings.API_NINJAS_API_KEY = "eval_test_ninja_key_2026"

    def teardown_method(self):
        settings.API_NINJAS_API_KEY = self.original_key
        ninja_detection_service.clear_cache()

    # 1. Context-Aware Relevance Layer Priors
    def test_relevance_layer_prior_classification(self):
        """Excluded scene fixtures, humans, and infrastructure must score 0.0 relevance."""
        excluded_samples = [
            "person", "man", "woman", "dining table", "table", "chair", "desk",
            "couch", "sofa", "bed", "toilet", "sink", "bench", "potted plant",
            "wall", "floor", "car", "bus", "truck", "traffic light", "dog", "cat"
        ]
        for label in excluded_samples:
            score = get_label_relevance_score(label)
            assert score == 0.0, f"Expected excluded score 0.0 for '{label}', got {score}"

        # High-relevance campus belongings must score >= 0.90
        belonging_samples = [
            "backpack", "laptop", "cell phone", "smartphone", "wallet", "keys",
            "water bottle", "book", "notebook", "pen", "ballpoint", "watch",
            "sunglasses", "headphones", "earbuds"
        ]
        for label in belonging_samples:
            score = get_label_relevance_score(label)
            assert score >= 0.90, f"Expected high relevance >= 0.90 for '{label}', got {score}"

    # 2. Cluttered Background & Furniture Filtering (Root Cause Defect Fix)
    def test_furniture_suppressed_in_favor_of_belonging(self):
        """
        When scene fixtures (dining table, chair) have higher detector confidence than
        a small personal item (wristwatch, phone), the personal item MUST be selected.
        """
        mock_cluttered_scene = [
            {
                "label": "dining table",
                "confidence": "0.98",
                "bounding_box": {"x1": 0, "y1": 100, "x2": 640, "y2": 640}
            },
            {
                "label": "chair",
                "confidence": "0.92",
                "bounding_box": {"x1": 20, "y1": 50, "x2": 200, "y2": 400}
            },
            {
                "label": "watch",
                "confidence": "0.76",
                "bounding_box": {"x1": 250, "y1": 280, "x2": 320, "y2": 350}
            }
        ]

        mock_resp = httpx.Response(
            status_code=200,
            json=mock_cluttered_scene,
            request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
        )

        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            files = {"file": ("desk_scene.jpg", b"\xFF\xD8\xFF\xE0clutter", "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 200
            data = res.json()

            # Must preserve all 3 detections (no premature dropping)
            assert data["count"] == 3
            assert len(data["detected_objects"]) == 3

            # Dining table MUST NOT be the top label despite having 0.98 confidence!
            assert data["top_label"] == "Watch"
            assert data["suggested_category"] == "Eyewear & Accessories"
            assert data["suggested_title"] == "Watch"

    # 3. People / Person Exclusion & Safety
    def test_person_excluded_from_belonging_suggestion(self):
        """
        CampusTrace strictly protects privacy: detections of 'person' must never
        become report titles or categories when a belonging is present.
        """
        mock_person_scene = [
            {
                "label": "person",
                "confidence": "0.96",
                "bounding_box": {"x1": 100, "y1": 50, "x2": 500, "y2": 600}
            },
            {
                "label": "backpack",
                "confidence": "0.82",
                "bounding_box": {"x1": 180, "y1": 150, "x2": 380, "y2": 450}
            }
        ]

        mock_resp = httpx.Response(
            status_code=200,
            json=mock_person_scene,
            request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
        )

        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            files = {"file": ("student_with_bag.jpg", b"\xFF\xD8\xFF\xE0personbag", "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 200
            data = res.json()
            assert data["top_label"] == "Backpack"
            assert data["suggested_category"] == "Bags & Backpacks"
            assert data["top_label"] != "Person"

    # 4. Principled Abstention on Empty or Furniture-Only Scenes
    def test_principled_abstention_furniture_only(self):
        """
        When an image contains only room background fixtures (e.g. empty classroom chairs/tables),
        the system must honestly abstain and NOT fabricate 'Campus Belonging'.
        """
        mock_fixtures_only = [
            {"label": "dining table", "confidence": "0.95"},
            {"label": "chair", "confidence": "0.91"},
            {"label": "potted plant", "confidence": "0.74"}
        ]

        mock_resp = httpx.Response(
            status_code=200,
            json=mock_fixtures_only,
            request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
        )

        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            files = {"file": ("empty_room.jpg", b"\xFF\xD8\xFF\xE0emptyroom", "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 200
            data = res.json()
            # Retain all detected scene objects for debugging / transparency
            assert data["count"] == 3
            # But top suggested label and title must abstain (None)
            assert data["top_label"] is None
            assert data["suggested_title"] is None
            assert data["suggested_category"] is None
            assert "No reportable personal belongings" in data["suggested_description"]

    # 5. Multi-Object Candidate Preservation
    def test_multi_object_scene_candidate_preservation(self):
        """All valid candidate detections in a multi-item photo must be preserved."""
        mock_study_desk = [
            {"label": "laptop", "confidence": "0.94"},
            {"label": "cell phone", "confidence": "0.89"},
            {"label": "notebook", "confidence": "0.85"},
            {"label": "bottle", "confidence": "0.82"},
            {"label": "pen", "confidence": "0.77"}
        ]

        mock_resp = httpx.Response(
            status_code=200,
            json=mock_study_desk,
            request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
        )

        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            files = {"file": ("study_desk.jpg", b"\xFF\xD8\xFF\xE0multidesk", "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 200
            data = res.json()
            assert data["count"] == 5
            labels = [item["label"] for item in data["detected_objects"]]
            assert "laptop" in labels
            assert "cell phone" in labels
            assert "notebook" in labels
            assert "bottle" in labels
            assert "pen" in labels

    # 6. Stationery & Books Granularity
    def test_stationery_and_study_materials_mapping(self):
        """Stationery items must map accurately to 'Books & Stationery'."""
        stationery_items = [
            ("notebook", "Books & Stationery"),
            ("textbook", "Books & Stationery"),
            ("ballpoint", "Books & Stationery"),
            ("pen", "Books & Stationery"),
            ("pencil box", "Books & Stationery"),
            ("scissors", "Books & Stationery"),
            ("binder", "Books & Stationery")
        ]

        for label, expected_category in stationery_items:
            cat = ninja_detection_service.map_label_to_category(label)
            assert cat == expected_category, f"Failed mapping for {label}: got {cat}"

    # 7. Safe Unknown Object Fallback
    def test_unknown_label_safe_fallback(self):
        """Unknown or unmapped labels must safely fallback to 'Other Belongings' without throwing."""
        unknown_labels = ["laser pointer", "unusual tool", "lab specimen tube"]
        for unk in unknown_labels:
            cat = ninja_detection_service.map_label_to_category(unk)
            assert cat == "Other Belongings"
