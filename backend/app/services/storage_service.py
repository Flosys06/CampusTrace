import os
import uuid
import io
from pathlib import Path
from typing import Tuple, Optional
from PIL import Image, ImageOps
from fastapi import UploadFile, HTTPException, status
from app.config import settings

class StorageService:
    def __init__(self, upload_dir: Optional[Path] = None):
        self.upload_dir = upload_dir or settings.UPLOAD_DIR
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_image(self, file: UploadFile) -> Tuple[str, str, int, int, int]:
        """
        Validates, normalizes, and safely persists an uploaded item image.
        Returns:
            storage_key (str): Unique filename on disk
            mime_type (str): Verified MIME type
            file_size (int): Size in bytes
            width (int): Image width
            height (int): Image height
        """
        # Read content
        content = await file.read()
        file_size = len(content)
        
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )
        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image size exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB"
            )

        # Validate MIME and decode image via Pillow
        try:
            image = Image.open(io.BytesIO(content))
            image.verify()
            
            # Re-open after verify() to process
            image = Image.open(io.BytesIO(content))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image file or unsupported image format."
            )

        img_format = (image.format or "JPEG").upper()
        if img_format not in ["JPEG", "PNG", "WEBP"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image format {img_format} not supported. Must be JPEG, PNG, or WebP."
            )

        mime_map = {
            "JPEG": "image/jpeg",
            "PNG": "image/png",
            "WEBP": "image/webp"
        }
        verified_mime = mime_map.get(img_format, "image/jpeg")

        # Auto-orient based on EXIF tags
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        # Ensure RGB mode (strip CMYK, RGBA if saving as JPEG)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")

        width, height = image.size

        # Generate safe, randomized filename
        ext = ".jpg" if img_format == "JPEG" else f".{img_format.lower()}"
        unique_name = f"{uuid.uuid4().hex}_{int(os.times().system * 1000)}{ext}"
        target_path = self.upload_dir / unique_name

        # Save normalized image
        if img_format == "PNG":
            image.save(target_path, format="PNG", optimize=True)
        elif img_format == "WEBP":
            image.save(target_path, format="WEBP", quality=90)
        else:
            if image.mode == "RGBA":
                image = image.convert("RGB")
            image.save(target_path, format="JPEG", quality=90, optimize=True)

        final_size = os.path.getsize(target_path)
        return unique_name, verified_mime, final_size, width, height

    def get_file_path(self, storage_key: str) -> Path:
        """Returns the safe absolute path for a storage key, preventing path traversal."""
        safe_name = os.path.basename(storage_key)
        return self.upload_dir / safe_name

    def delete_file(self, storage_key: str) -> bool:
        """Deletes a file from storage if it exists."""
        try:
            target = self.get_file_path(storage_key)
            if target.exists() and target.is_file():
                target.unlink()
                return True
        except Exception:
            pass
        return False

storage_service = StorageService()
