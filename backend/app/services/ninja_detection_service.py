import io
import time
import hashlib
import asyncio
import logging
from typing import List, Optional, Dict, Any, Tuple
import httpx
from PIL import Image
import numpy as np
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.config import settings
from app.models.report import Report, ReportType, ReportStatus
from app.models.claim import Claim, ClaimStatus
from app.models.user import User, UserRole
from app.services.notification_service import create_notification
from app.schemas.ninja_detection import (
    NinjaBoundingBox,
    NinjaDetectedItem,
    NinjaDetectionResponse,
    FoundMatchCandidate,
    ScanMatchResponse,
    AlertTeacherRequest,
    AlertTeacherResponse,
)

logger = logging.getLogger(__name__)

# Map standard COCO labels from API Ninjas to CampusTrace category names
LABEL_TO_CATEGORY: Dict[str, str] = {
    "backpack": "Bags & Backpacks",
    "handbag": "Bags & Backpacks",
    "suitcase": "Bags & Backpacks",
    "briefcase": "Bags & Backpacks",
    "laptop": "Electronics & Gadgets",
    "cell phone": "Electronics & Gadgets",
    "mouse": "Electronics & Gadgets",
    "keyboard": "Electronics & Gadgets",
    "remote": "Electronics & Gadgets",
    "tv": "Electronics & Gadgets",
    "bottle": "Bottles & Lunchboxes",
    "cup": "Bottles & Lunchboxes",
    "fork": "Bottles & Lunchboxes",
    "knife": "Bottles & Lunchboxes",
    "spoon": "Bottles & Lunchboxes",
    "bowl": "Bottles & Lunchboxes",
    "book": "Books & Study Material",
    "umbrella": "Accessories & Umbrellas",
    "tie": "Clothing & Apparel",
    "shoe": "Clothing & Apparel",
    "hat": "Clothing & Apparel",
    "clock": "Accessories & Umbrellas",
    "scissors": "Stationery & Supplies",
}

class NinjaDetectionService:
    CACHE_TTL_SECONDS: float = 86400.0  # 24 hours
    MAX_CACHE_ENTRIES: int = 1000
    RATE_LIMIT_WINDOW_SECONDS: float = 60.0
    RATE_LIMIT_MAX_REQUESTS: int = 15

    def __init__(self):
        # In-memory SHA-256 fingerprint cache: hash -> (NinjaDetectionResponse, timestamp)
        self._cache: Dict[str, Tuple[NinjaDetectionResponse, float]] = {}
        # In-flight request deduplication: hash -> asyncio.Future
        self._in_flight: Dict[str, asyncio.Future] = {}
        # Client rate limiting: client_id -> list of request timestamps
        self._rate_limits: Dict[str, List[float]] = {}

    def clear_cache(self):
        """Clears memory caches and rate limiters (useful for testing)."""
        self._cache.clear()
        self._in_flight.clear()
        self._rate_limits.clear()

    def compute_image_hash(self, image_bytes: bytes) -> str:
        """Computes SHA-256 cryptographic fingerprint of the image bytes."""
        return hashlib.sha256(image_bytes).hexdigest()

    def get_cached_detection(self, image_hash: str) -> Optional[NinjaDetectionResponse]:
        """Retrieves valid unexpired detection result from cache if present."""
        now = time.time()
        entry = self._cache.get(image_hash)
        if not entry:
            return None
        cached_res, timestamp = entry
        if now - timestamp > self.CACHE_TTL_SECONDS:
            self._cache.pop(image_hash, None)
            return None
        # Return a copy marked with cached=True
        res_copy = cached_res.model_copy()
        res_copy.cached = True
        return res_copy

    def set_cached_detection(self, image_hash: str, response: NinjaDetectionResponse):
        """Saves a detection result to the memory cache with eviction guardrails."""
        now = time.time()
        if len(self._cache) >= self.MAX_CACHE_ENTRIES:
            # Purge expired
            self._cache = {k: v for k, v in self._cache.items() if now - v[1] <= self.CACHE_TTL_SECONDS}
            # If still exceeding capacity, drop oldest 100 entries
            if len(self._cache) >= self.MAX_CACHE_ENTRIES:
                oldest_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k][1])[:100]
                for k in oldest_keys:
                    self._cache.pop(k, None)
        self._cache[image_hash] = (response, now)

    def check_rate_limit(self, client_id: Optional[str]):
        """Enforces a basic sliding-window rate limit per client/IP."""
        if not client_id:
            return
        now = time.time()
        timestamps = self._rate_limits.setdefault(client_id, [])
        # Purge timestamps outside the active sliding window
        self._rate_limits[client_id] = [t for t in timestamps if now - t <= self.RATE_LIMIT_WINDOW_SECONDS]
        if len(self._rate_limits[client_id]) >= self.RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail="Image detection rate limit exceeded. Please wait a moment before analyzing more photos."
            )
        self._rate_limits[client_id].append(now)

    def _get_api_key(self) -> str:
        """
        Retrieves the API key securely.
        Ensures the key is present and not a placeholder.
        """
        key = settings.API_NINJAS_API_KEY
        if not key or not key.strip() or key.strip() == "PASTE_YOUR_API_KEY_HERE":
            raise HTTPException(
                status_code=503,
                detail="API Ninjas object detection service is not configured. Please set API_NINJAS_API_KEY in backend/.env."
            )
        return key.strip()

    def map_label_to_category(self, label: str) -> str:
        """Maps an object label to a campus category."""
        clean_label = label.lower().strip()
        for key, cat in LABEL_TO_CATEGORY.items():
            if key in clean_label or clean_label in key:
                return cat
        return "Other Belongings"

    async def detect_objects_from_bytes(
        self,
        image_bytes: bytes,
        filename: str = "upload.jpg",
        content_type: str = "image/jpeg",
        client_id: Optional[str] = None
    ) -> NinjaDetectionResponse:
        """
        Detects objects in an image with:
        1. Rate limiting per client.
        2. Cryptographic SHA-256 fingerprint caching (no external request on cache hit).
        3. In-flight request deduplication for concurrent identical images.
        4. Bounded retries and upstream timeouts.
        """
        if not image_bytes or len(image_bytes) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded image file is empty."
            )

        if len(image_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Image exceeds maximum permitted size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB."
            )

        # 1. Check rate limit
        self.check_rate_limit(client_id)

        # 2. Cryptographic fingerprint caching
        image_hash = self.compute_image_hash(image_bytes)
        cached = self.get_cached_detection(image_hash)
        if cached:
            logger.info(f"Serving cached detection for image hash {image_hash[:12]}...")
            return cached

        # 3. In-flight request deduplication
        if image_hash in self._in_flight:
            logger.info(f"Deduplicating in-flight detection request for image hash {image_hash[:12]}...")
            existing_future = self._in_flight[image_hash]
            result = await existing_future
            res_copy = result.model_copy()
            res_copy.cached = True
            return res_copy

        # 4. Create in-flight task future
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self._in_flight[image_hash] = future

        try:
            result = await self._perform_upstream_detection(image_bytes, filename, content_type)
            self.set_cached_detection(image_hash, result)
            if not future.done():
                future.set_result(result)
            return result
        except Exception as exc:
            if not future.done():
                future.set_exception(exc)
            raise
        finally:
            self._in_flight.pop(image_hash, None)

    async def _perform_upstream_detection(
        self,
        image_bytes: bytes,
        filename: str,
        content_type: str
    ) -> NinjaDetectionResponse:
        """
        Internal caller to API Ninjas Object Detection with bounded retry and timeout.
        """
        api_key = self._get_api_key()
        url = settings.API_NINJAS_OBJECT_DETECTION_URL

        headers = {
            "X-Api-Key": api_key,
            "Accept": "application/json"
        }
        files = {
            "image": (filename, image_bytes, content_type)
        }

        # Bounded retry: try up to 2 attempts for transient connection/timeout failures
        response = None
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(url, headers=headers, files=files)
                break
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt == 0:
                    logger.warning(f"Transient error querying API Ninjas (attempt 1/2): {exc.__class__.__name__}. Retrying once...")
                    await asyncio.sleep(0.5)
                    continue
                logger.warning(f"API Ninjas request failed after 2 attempts: {exc.__class__.__name__}")
                if isinstance(exc, httpx.TimeoutException):
                    raise HTTPException(
                        status_code=504,
                        detail="Upstream API Ninjas object detection service timed out. Please try again."
                    )
                raise HTTPException(
                    status_code=502,
                    detail="Failed to connect to upstream API Ninjas object detection service."
                )

        if response is None:
            raise HTTPException(
                status_code=502,
                detail="Failed to receive a response from API Ninjas object detection."
            )

        # Handle 200 OK
        if response.status_code == 200:
            try:
                raw_data = response.json()
            except Exception:
                raise HTTPException(
                    status_code=502,
                    detail="Received malformed JSON from API Ninjas object detection service."
                )

            if not isinstance(raw_data, list):
                raw_data = []

            detected_items: List[NinjaDetectedItem] = []
            for item in raw_data:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label", "unknown")).strip()
                try:
                    conf = float(item.get("confidence", 0.0))
                except (ValueError, TypeError):
                    conf = 0.0

                bbox = None
                raw_bbox = item.get("bounding_box")
                if isinstance(raw_bbox, dict):
                    try:
                        bbox = NinjaBoundingBox(
                            x1=float(raw_bbox.get("x1", 0)),
                            y1=float(raw_bbox.get("y1", 0)),
                            x2=float(raw_bbox.get("x2", 0)),
                            y2=float(raw_bbox.get("y2", 0)),
                        )
                    except (ValueError, TypeError):
                        bbox = None

                suggested_cat = self.map_label_to_category(label)
                detected_items.append(
                    NinjaDetectedItem(
                        label=label,
                        confidence=round(conf, 3),
                        bounding_box=bbox,
                        suggested_category=suggested_cat
                    )
                )

            # Sort descending by confidence
            detected_items.sort(key=lambda x: x.confidence, reverse=True)

            top_item = detected_items[0] if detected_items else None
            top_label = top_item.label.title() if top_item else None
            top_conf = top_item.confidence if top_item else None
            suggested_cat = top_item.suggested_category if top_item else "Other Belongings"

            suggested_title = f"{top_label}" if top_label else "Campus Belonging"
            suggested_desc = (
                f"Identified {top_label} via cloud object detection."
                if top_item
                else "No recognizable objects were detected in the photograph."
            )

            return NinjaDetectionResponse(
                success=True,
                count=len(detected_items),
                detected_objects=detected_items,
                top_label=top_label,
                top_confidence=top_conf,
                suggested_category=suggested_cat,
                suggested_title=suggested_title,
                suggested_description=suggested_desc,
                provider="API Ninjas Object Detection",
                cached=False
            )

        # Handle specific error status codes
        if response.status_code == 400:
            error_msg = ""
            try:
                err_json = response.json()
                if isinstance(err_json, dict):
                    error_msg = err_json.get("error", "")
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail=error_msg or "Invalid image format or parameter for API Ninjas object detection."
            )

        if response.status_code in (401, 403):
            logger.error("Upstream API Ninjas authentication failure (check API_NINJAS_API_KEY)")
            raise HTTPException(
                status_code=502,
                detail="Upstream API Ninjas authentication failed. Please verify API_NINJAS_API_KEY in backend/.env."
            )

        if response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="Upstream API Ninjas object detection endpoint not found."
            )

        if response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="API Ninjas object detection rate limit exceeded. Please try again later."
            )

        # 500 or any other upstream error
        logger.warning(f"Upstream API Ninjas returned unexpected status {response.status_code}")
        raise HTTPException(
            status_code=502,
            detail="Upstream API Ninjas object detection service encountered an error. Please try again later."
        )

    async def detect_from_upload(
        self,
        file: UploadFile,
        client_id: Optional[str] = None
    ) -> NinjaDetectionResponse:
        """Detects objects from an uploaded FastAPI UploadFile with deduplication and caching."""
        # Validate MIME type
        if file.content_type not in settings.ALLOWED_IMAGE_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image type '{file.content_type}'. Supported formats: JPEG, PNG, WEBP."
            )
        
        image_bytes = await file.read()
        return await self.detect_objects_from_bytes(
            image_bytes=image_bytes,
            filename=file.filename or "photo.jpg",
            content_type=file.content_type or "image/jpeg",
            client_id=client_id
        )

    def extract_color_from_bytes(self, image_bytes: bytes) -> str:
        """Determines dominant primary color from image bytes."""
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img = img.resize((64, 64))
            arr = np.array(img).reshape(-1, 3)
            mean_rgb = arr.mean(axis=0)
            r, g, b = float(mean_rgb[0]), float(mean_rgb[1]), float(mean_rgb[2])

            diff = max(r, g, b) - min(r, g, b)
            brightness = (r + g + b) / 3.0
            if diff < 20:
                if brightness < 50:
                    return "Black"
                elif brightness > 200:
                    return "White"
                return "Silver/Gray"

            if r > g and r > b:
                if g > 150 and b < 100:
                    return "Yellow"
                if g > 80 and b < 80:
                    return "Orange"
                return "Red"
            elif g > r and g > b:
                return "Green"
            elif b > r and b > g:
                if r > 100:
                    return "Purple/Violet"
                return "Blue"
            return "Multi-color"
        except Exception:
            return "Multi-color"

    async def scan_and_match_found_reports(
        self,
        db: Session,
        image_bytes: bytes,
        current_user: User,
        filename: str = "lost_photo.jpg",
        content_type: str = "image/jpeg",
        client_id: Optional[str] = None
    ) -> ScanMatchResponse:
        """
        Scans a student's lost item photograph with API Ninjas and searches active
        FOUND reports across campus to find high-confidence matches before reporting.
        """
        # 1. Detect objects using API Ninjas (reusing SHA-256 fingerprint cache)
        ninja_res = await self.detect_objects_from_bytes(image_bytes, filename, content_type, client_id=client_id)
        detected_color = self.extract_color_from_bytes(image_bytes)

        detected_labels = [o.label.lower() for o in ninja_res.detected_objects]
        top_label = ninja_res.top_label or "Item"
        top_conf = ninja_res.top_confidence or 0.5
        suggested_cat = ninja_res.suggested_category or "Other Belongings"

        # 2. Query open / in custody FOUND reports
        query = db.query(Report).filter(
            Report.report_type == ReportType.FOUND,
            Report.status.in_([ReportStatus.OPEN, ReportStatus.IN_CUSTODY, ReportStatus.PENDING_HANDOVER])
        )
        # Apply college multi-tenant scoping if applicable
        if current_user.college_id and current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
            query = query.filter(Report.college_id == current_user.college_id)

        found_reports = query.order_by(desc(Report.created_at)).limit(60).all()

        candidates: List[FoundMatchCandidate] = []

        for report in found_reports:
            item_name = report.item.item_name if report.item else ""
            cat_name = report.item.category.name if report.item and report.item.category else ""
            item_color = report.item.color if report.item else ""
            desc_text = report.detailed_description or ""

            # Check category compatibility
            cat_match = False
            if suggested_cat.lower() in cat_name.lower() or cat_name.lower() in suggested_cat.lower():
                cat_match = True

            # Check object label in title or description
            label_match = False
            matched_label_name = ""
            for lbl in detected_labels:
                if lbl in item_name.lower() or lbl in desc_text.lower():
                    label_match = True
                    matched_label_name = lbl.title()
                    break

            # If top label matches
            if top_label.lower() in item_name.lower() or top_label.lower() in desc_text.lower():
                label_match = True
                matched_label_name = top_label

            # Check color match
            color_match = False
            if item_color and detected_color:
                if detected_color.lower() in item_color.lower() or item_color.lower() in detected_color.lower():
                    color_match = True

            # Calculate composite confidence
            score = 0.20
            reasons = []

            if label_match:
                score += 0.45
                reasons.append(f"Matching Object: {matched_label_name} detected via API Ninjas")
            elif cat_match:
                score += 0.30
                reasons.append(f"Matching Category: {cat_name}")

            if cat_match and label_match:
                score += 0.10
                reasons.append(f"Compatible Category: {cat_name}")

            if color_match and detected_color != "Multi-color":
                score += 0.20
                reasons.append(f"Matching Color: {item_color}")

            if report.handed_over_teacher_name:
                reasons.append(f"Entrusted to Faculty Custodian: {report.handed_over_teacher_name}")

            final_conf = min(0.96, round(score, 2))

            # Plausible matches
            if final_conf >= 0.45:
                loc_name = report.manual_campus_location or (report.location.name if report.location else "Campus Grounds")
                primary_img = report.images[0].storage_key if report.images else None

                candidates.append(
                    FoundMatchCandidate(
                        report_id=report.id,
                        report_number=report.report_number,
                        item_name=item_name or "Found Belonging",
                        category_name=cat_name or "General",
                        color=item_color or None,
                        location_name=loc_name,
                        report_date=str(report.report_date),
                        status=report.status.value,
                        handed_over_teacher_name=report.handed_over_teacher_name,
                        primary_image_key=primary_img,
                        confidence_score=final_conf,
                        match_reasons=reasons,
                        detailed_description=desc_text
                    )
                )

        candidates.sort(key=lambda x: x.confidence_score, reverse=True)

        return ScanMatchResponse(
            success=True,
            detected_label=top_label,
            detected_confidence=top_conf,
            detected_category=suggested_cat,
            detected_color=detected_color,
            matches_count=len(candidates),
            matches=candidates
        )

    def alert_teacher_and_claim(
        self,
        db: Session,
        payload: AlertTeacherRequest,
        current_user: User
    ) -> AlertTeacherResponse:
        """
        Creates an ownership claim and immediately sends a high-priority in-app alert
        to the teacher who has custody of the found item.
        """
        report = db.query(Report).filter(Report.id == payload.found_report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Found report not found.")

        if report.report_type != ReportType.FOUND:
            raise HTTPException(status_code=400, detail="Only FOUND items can be claimed.")

        if report.status in (ReportStatus.RETURNED, ReportStatus.CLOSED):
            raise HTTPException(status_code=400, detail="This item has already been returned or closed.")

        # Check existing active claim
        existing_claim = db.query(Claim).filter(
            Claim.found_report_id == report.id,
            Claim.claimant_student_id == current_user.id,
            Claim.status.in_([ClaimStatus.PENDING, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED])
        ).first()

        claim_id = existing_claim.id if existing_claim else None

        if not existing_claim:
            claim = Claim(
                found_report_id=report.id,
                claimant_student_id=current_user.id,
                claim_description=f"Photo Scan Match: Student identified item '{report.item.item_name if report.item else 'item'}' via AI photo matching.",
                private_ownership_evidence=payload.claim_notes or "Matched photo verified by student.",
                status=ClaimStatus.PENDING
            )
            db.add(claim)
            report.status = ReportStatus.CLAIM_PENDING
            db.commit()
            db.refresh(claim)
            claim_id = claim.id

        teacher_name = report.handed_over_teacher_name or "Faculty Staff"
        student_id_str = current_user.student_id_usn or current_user.institutional_id or current_user.email

        # 1. Alert the teacher(s) in this college
        target_teacher_ids = []
        if report.handed_over_teacher_name:
            teachers = db.query(User).filter(
                User.role.in_([UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.ADMIN]),
                User.full_name.ilike(f"%{report.handed_over_teacher_name.strip()}%")
            ).all()
            for t in teachers:
                target_teacher_ids.append(t.id)

        if report.created_by_user_id and report.created_by_user_id not in target_teacher_ids:
            target_teacher_ids.append(report.created_by_user_id)

        if not target_teacher_ids and report.college_id:
            college_teachers = db.query(User).filter(
                User.college_id == report.college_id,
                User.role.in_([UserRole.TEACHER, UserRole.ADMIN])
            ).limit(5).all()
            target_teacher_ids = [t.id for t in college_teachers]

        for tid in set(target_teacher_ids):
            create_notification(
                db=db,
                user_id=tid,
                title=f"Student Match Alert: #{report.report_number}",
                message=f"Student {current_user.full_name} ({student_id_str}) matched their photo with '{report.item.item_name if report.item else 'item'}'. Custody recorded under '{teacher_name}'. Please verify.",
                notification_type="CLAIM",
                link_url=f"/reports/{report.id}"
            )

        # 2. Send notification to student with retrieval guidance
        create_notification(
            db=db,
            user_id=current_user.id,
            title=f"Custodian Alerted: {teacher_name}",
            message=f"We have alerted {teacher_name} that you identified your {report.item.item_name if report.item else 'belonging'}. Please visit with your institutional ID to verify ownership and collect your item.",
            notification_type="STATUS_CHANGE",
            link_url=f"/reports/{report.id}"
        )

        pickup_msg = (
            f"Please visit {teacher_name} (or the Campus Lost & Found Desk) with your student ID ({student_id_str}) "
            f"to verify ownership and retrieve your {report.item.item_name if report.item else 'item'}."
        )

        return AlertTeacherResponse(
            success=True,
            claim_id=claim_id or 0,
            report_id=report.id,
            report_number=report.report_number,
            teacher_name=teacher_name,
            message=f"Alert successfully sent to {teacher_name}!",
            pickup_instructions=pickup_msg
        )

ninja_detection_service = NinjaDetectionService()
