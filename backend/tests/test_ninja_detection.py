import io
import pytest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)

def test_ninja_status_unconfigured():
    """Returns configured: False when key is missing or set to placeholder."""
    original_key = settings.API_NINJAS_API_KEY
    try:
        settings.API_NINJAS_API_KEY = None
        res1 = client.get("/api/detection/status")
        assert res1.status_code == 200
        assert res1.json()["configured"] is False

        settings.API_NINJAS_API_KEY = "PASTE_YOUR_API_KEY_HERE"
        res2 = client.get("/api/detection/status")
        assert res2.status_code == 200
        assert res2.json()["configured"] is False
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_status_configured():
    """Returns configured: True when valid key is set, and does not leak key."""
    original_key = settings.API_NINJAS_API_KEY
    secret = "sample_ninja_secret_xyz123"
    try:
        settings.API_NINJAS_API_KEY = secret
        res = client.get("/api/detection/status")
        assert res.status_code == 200
        data = res.json()
        assert data["configured"] is True
        assert data["provider"] == "API Ninjas Object Detection"
        assert secret not in res.text
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_missing_key():
    """Returns 503 Service Unavailable when trying to detect without key."""
    original_key = settings.API_NINJAS_API_KEY
    try:
        settings.API_NINJAS_API_KEY = None
        file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
        files = {"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
        res = client.post("/api/detection/ninja-detect", files=files)
        assert res.status_code == 503
        assert "not configured" in res.json()["detail"].lower()
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_invalid_mime():
    """Rejects unsupported MIME types."""
    original_key = settings.API_NINJAS_API_KEY
    try:
        settings.API_NINJAS_API_KEY = "test_key"
        files = {"file": ("test.txt", io.BytesIO(b"Hello text"), "text/plain")}
        res = client.post("/api/detection/ninja-detect", files=files)
        assert res.status_code == 400
        assert "unsupported" in res.json()["detail"].lower()
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_successful_mock():
    """Parses upstream API Ninjas object detection array and maps categories properly."""
    original_key = settings.API_NINJAS_API_KEY
    secret = "secret_ninja_api_key_456"
    settings.API_NINJAS_API_KEY = secret

    mock_json = [
        {
            "label": "backpack",
            "confidence": "0.965",
            "bounding_box": {
                "x1": "110",
                "y1": "70",
                "x2": "430",
                "y2": "600"
            }
        },
        {
            "label": "laptop",
            "confidence": "0.852",
            "bounding_box": {
                "x1": "50",
                "y1": "200",
                "x2": "500",
                "y2": "500"
            }
        }
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_json,
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00fakeimagebytes"
            files = {"file": ("campus_photo.jpg", io.BytesIO(file_content), "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["count"] == 2
            assert data["top_label"] == "Backpack"
            assert data["top_confidence"] == 0.965
            assert data["suggested_category"] == "Bags & Backpacks"
            assert len(data["detected_objects"]) == 2
            assert data["detected_objects"][0]["label"] == "backpack"
            assert data["detected_objects"][1]["label"] == "laptop"

            # Check header was sent correctly
            mock_post.assert_called_once()
            called_headers = mock_post.call_args.kwargs["headers"]
            assert called_headers["X-Api-Key"] == secret

            # Security verification: key is NEVER present in response
            assert secret not in res.text
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_upstream_auth_failure():
    """Handles 401/403 from upstream without leaking key."""
    original_key = settings.API_NINJAS_API_KEY
    secret = "wrong_api_key_secret"
    settings.API_NINJAS_API_KEY = secret

    mock_resp = httpx.Response(
        status_code=401,
        json={"error": "Invalid API key."},
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00fakeimage"
            files = {"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 502
            assert "authentication failed" in res.json()["detail"].lower()
            assert secret not in res.text
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_upstream_rate_limit():
    """Handles 429 Too Many Requests from API Ninjas."""
    original_key = settings.API_NINJAS_API_KEY
    settings.API_NINJAS_API_KEY = "test_key"

    mock_resp = httpx.Response(
        status_code=429,
        json={"error": "Rate limit exceeded."},
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00fakeimage"
            files = {"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 429
            assert "rate limit" in res.json()["detail"].lower()
    finally:
        settings.API_NINJAS_API_KEY = original_key

def test_ninja_detect_upstream_timeout():
    """Handles upstream timeout with 504 status code."""
    original_key = settings.API_NINJAS_API_KEY
    settings.API_NINJAS_API_KEY = "test_key"

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Connection timed out")

            file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00fakeimage"
            files = {"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")}
            res = client.post("/api/detection/ninja-detect", files=files)

            assert res.status_code == 504
            assert "timed out" in res.json()["detail"].lower()
    finally:
        settings.API_NINJAS_API_KEY = original_key


def test_ninja_scan_found_matches_and_alert_teacher():
    """Tests private photo scan matching against active found items and alerting custodian teacher."""
    from app.api.deps import get_current_user
    from app.models.user import User, UserRole
    from app.models.report import Report, ReportType, ReportStatus
    from app.models.item import Item
    from app.models.category_location import CampusLocation, Category
    from app.database import get_db

    # Create mock current user
    mock_user = User(
        id=999,
        email="teststudent@example.edu",
        full_name="Arjun Student",
        role=UserRole.STUDENT,
        is_active=True,
        college_id=1,
        student_id_usn="1RV22CS999"
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user

    original_key = settings.API_NINJAS_API_KEY
    settings.API_NINJAS_API_KEY = "test_ninja_key_abc"

    # Setup database with a sample FOUND report
    db_gen = get_db()
    db = next(db_gen)

    # Get or create category & location
    cat = db.query(Category).filter(Category.name == "Bottles & Lunchboxes").first()
    if not cat:
        cat = Category(name="Bottles & Lunchboxes", icon="Wine", is_active=True)
        db.add(cat)
        db.flush()

    loc = db.query(CampusLocation).first()
    if not loc:
        loc = CampusLocation(name="Library Ground Floor", building="Main Block", college_id=1, is_active=True)
        db.add(loc)
        db.flush()

    # Create sample FOUND report held by Prof. Sharma
    import uuid
    found_report = Report(
        report_number=f"FND-{uuid.uuid4().hex[:6].upper()}",
        report_type=ReportType.FOUND,
        college_id=1,
        created_by_user_id=mock_user.id,
        location_id=loc.id,
        status=ReportStatus.IN_CUSTODY,
        detailed_description="Found blue Milton thermos flask bottle near study table 4",
        handed_over_teacher_name="Prof. Sharma"
    )
    db.add(found_report)
    db.flush()

    found_item = Item(
        report_id=found_report.id,
        item_name="Blue Water Bottle",
        category_id=cat.id,
        color="Blue"
    )
    db.add(found_item)
    db.commit()

    # Mock API Ninjas response detecting "bottle"
    mock_json = [
        {
            "label": "bottle",
            "confidence": "0.94",
            "bounding_box": {"x1": "20", "y1": "20", "x2": "120", "y2": "300"}
        }
    ]
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_json,
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            # 1. Privately scan lost item photo
            file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00mockbluebottle"
            files = {"file": ("my_lost_bottle.jpg", io.BytesIO(file_content), "image/jpeg")}
            scan_res = client.post("/api/detection/scan-found-matches", files=files)

            assert scan_res.status_code == 200
            scan_data = scan_res.json()
            assert scan_data["success"] is True
            assert scan_data["detected_label"] == "Bottle"
            assert scan_data["matches_count"] >= 1
            
            # Find the created report in candidate matches
            matched_candidate = next((c for c in scan_data["matches"] if c["report_id"] == found_report.id), None)
            assert matched_candidate is not None
            assert matched_candidate["handed_over_teacher_name"] == "Prof. Sharma"
            assert matched_candidate["confidence_score"] >= 0.70

            # 2. Confirm match and alert custodian teacher
            alert_payload = {
                "found_report_id": found_report.id,
                "claim_notes": "Identified my Milton thermos bottle with stickers."
            }
            alert_res = client.post("/api/detection/alert-teacher", json=alert_payload)
            assert alert_res.status_code == 200
            alert_data = alert_res.json()
            assert alert_data["success"] is True
            assert alert_data["teacher_name"] == "Prof. Sharma"
            assert "Prof. Sharma" in alert_data["message"]
            assert "pickup_instructions" in alert_data

            # Verify report status moved to CLAIM_PENDING
            db.refresh(found_report)
            assert found_report.status == ReportStatus.CLAIM_PENDING

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        settings.API_NINJAS_API_KEY = original_key


def test_ninja_detect_caching():
    """Identical image bytes must hit server cache and make zero second upstream requests."""
    from app.services.ninja_detection_service import ninja_detection_service
    ninja_detection_service.clear_cache()

    original_key = settings.API_NINJAS_API_KEY
    settings.API_NINJAS_API_KEY = "test_cache_secret_key"

    mock_json = [
        {"label": "backpack", "confidence": "0.95", "bounding_box": {"x1": "0", "y1": "0", "x2": "100", "y2": "100"}}
    ]
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_json,
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            file_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00same_image_bytes_123"
            
            # Request 1: Fresh detection
            files1 = {"file": ("item.jpg", io.BytesIO(file_bytes), "image/jpeg")}
            res1 = client.post("/api/detection/ninja-detect", files=files1)
            assert res1.status_code == 200
            data1 = res1.json()
            assert data1["cached"] is False
            assert data1["top_label"] == "Backpack"
            assert mock_post.call_count == 1

            # Request 2: Re-request identical image
            files2 = {"file": ("item_copy.jpg", io.BytesIO(file_bytes), "image/jpeg")}
            res2 = client.post("/api/detection/ninja-detect", files=files2)
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["cached"] is True
            assert data2["top_label"] == "Backpack"
            # Crucial: Upstream was NOT called again! Call count remains 1!
            assert mock_post.call_count == 1
    finally:
        settings.API_NINJAS_API_KEY = original_key
        ninja_detection_service.clear_cache()


def test_ninja_detect_rate_limiting():
    """Exceeding the request rate limit returns HTTP 429."""
    from app.services.ninja_detection_service import ninja_detection_service
    ninja_detection_service.clear_cache()

    original_key = settings.API_NINJAS_API_KEY
    settings.API_NINJAS_API_KEY = "test_ratelimit_key"

    mock_json = [{"label": "bottle", "confidence": "0.9"}]
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_json,
        request=httpx.Request("POST", "https://api.api-ninjas.com/v1/objectdetection")
    )

    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            # Hit rate limit (configured as 15 requests/minute)
            for i in range(15):
                unique_bytes = f"\xFF\xD8\xFF\xE0unique_file_{i}".encode("utf-8")
                files = {"file": (f"test_{i}.jpg", io.BytesIO(unique_bytes), "image/jpeg")}
                res = client.post("/api/detection/ninja-detect", files=files)
                assert res.status_code == 200

            # 16th request should be rate-limited
            overflow_bytes = b"\xFF\xD8\xFF\xE0overflow_file"
            files = {"file": ("overflow.jpg", io.BytesIO(overflow_bytes), "image/jpeg")}
            overflow_res = client.post("/api/detection/ninja-detect", files=files)
            assert overflow_res.status_code == 429
            assert "rate limit exceeded" in overflow_res.json()["detail"].lower()
    finally:
        settings.API_NINJAS_API_KEY = original_key
        ninja_detection_service.clear_cache()


