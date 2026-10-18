from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ninja_detection import (
    NinjaDetectionResponse,
    ScanMatchResponse,
    AlertTeacherRequest,
    AlertTeacherResponse,
)
from app.services.ninja_detection_service import ninja_detection_service

router = APIRouter(prefix="/detection", tags=["AI Detection (API Ninjas)"])

@router.get(
    "/status",
    summary="Get API Ninjas detection status",
    description="Check whether the API Ninjas object detection service is configured on this server."
)
def get_detection_status():
    """
    Returns non-sensitive configuration status of API Ninjas integration.
    Never exposes or returns the actual API key.
    """
    key = settings.API_NINJAS_API_KEY
    is_configured = bool(key and key.strip() and key.strip() != "PASTE_YOUR_API_KEY_HERE")
    return {
        "configured": is_configured,
        "provider": "API Ninjas Object Detection",
        "endpoint": settings.API_NINJAS_OBJECT_DETECTION_URL,
        "supported_formats": list(settings.ALLOWED_IMAGE_MIMES),
        "max_size_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
    }

@router.post(
    "/ninja-detect",
    response_model=NinjaDetectionResponse,
    summary="Detect objects via API Ninjas",
    description="Uploads an item photograph to API Ninjas Object Detection API and returns identified items and bounding boxes."
)
async def detect_objects(
    request: Request,
    file: UploadFile = File(..., description="Item photograph file (JPEG, PNG, or WEBP)")
):
    """
    Server-side proxy that securely attaches the API Ninjas API key and
    forwards the image to API Ninjas Object Detection.
    Features cryptographic SHA-256 caching and in-flight request deduplication.
    """
    client_ip = request.client.host if request.client else "unknown"
    return await ninja_detection_service.detect_from_upload(file, client_id=client_ip)

@router.post(
    "/scan-found-matches",
    response_model=ScanMatchResponse,
    summary="Privately scan found items by photo",
    description="Upload a photo of a lost item to privately scan active campus FOUND reports and identify matching recovered items."
)
async def scan_found_matches(
    request: Request,
    file: UploadFile = File(..., description="Photo of the lost item (JPEG, PNG, or WEBP)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Private photo scan: does NOT create a global report. Scans campus FOUND records
    using API Ninjas object detection, category mapping, and visual attributes to find
    matching belongings held in custody.
    """
    if file.content_type not in settings.ALLOWED_IMAGE_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{file.content_type}'. Supported formats: JPEG, PNG, WEBP."
        )
    image_bytes = await file.read()
    client_ip = request.client.host if request.client else str(current_user.id)
    return await ninja_detection_service.scan_and_match_found_reports(
        db=db,
        image_bytes=image_bytes,
        current_user=current_user,
        filename=file.filename or "lost_item.jpg",
        content_type=file.content_type or "image/jpeg",
        client_id=client_ip
    )

@router.post(
    "/alert-teacher",
    response_model=AlertTeacherResponse,
    summary="Alert custodian teacher and file claim",
    description="Alerts the custodian teacher holding the matched item and files an ownership claim."
)
def alert_teacher(
    payload: AlertTeacherRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    When a student confirms a matched found item, this records an ownership claim,
    changes report status to CLAIM_PENDING, and notifies the custodian faculty member.
    """
    return ninja_detection_service.alert_teacher_and_claim(
        db=db,
        payload=payload,
        current_user=current_user
    )
