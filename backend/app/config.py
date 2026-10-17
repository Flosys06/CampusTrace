import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Load environment variables from backend/.env or root .env if present
load_dotenv(BASE_DIR / ".env", override=True)
load_dotenv(BASE_DIR.parent / ".env", override=True)

class Settings:
    PROJECT_NAME: str = "CampusTrace"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    BASE_DIR: Path = BASE_DIR

    _api_key_override: Optional[str] = None
    _explicitly_cleared: bool = False

    # API Ninjas Integration
    @property
    def API_NINJAS_API_KEY(self) -> Optional[str]:
        if self._explicitly_cleared:
            return None
        if self._api_key_override is not None:
            return self._api_key_override
        val = os.getenv("API_NINJAS_API_KEY")
        if not val or val == "PASTE_YOUR_API_KEY_HERE":
            load_dotenv(BASE_DIR / ".env", override=True)
            val = os.getenv("API_NINJAS_API_KEY")
        return val

    @API_NINJAS_API_KEY.setter
    def API_NINJAS_API_KEY(self, value: Optional[str]):
        if value is None:
            self._explicitly_cleared = True
            self._api_key_override = None
            if "API_NINJAS_API_KEY" in os.environ:
                del os.environ["API_NINJAS_API_KEY"]
        else:
            self._explicitly_cleared = False
            self._api_key_override = value
            os.environ["API_NINJAS_API_KEY"] = value

    API_NINJAS_OBJECT_DETECTION_URL: str = os.getenv(
        "API_NINJAS_OBJECT_DETECTION_URL",
        "https://api.api-ninjas.com/v1/objectdetection"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "campustrace-secret-key-super-secure-change-in-prod-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/campustrace.db")
    
    # Storage
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_MIMES: set = {"image/jpeg", "image/png", "image/webp"}
    
    # Matching Engine
    SIMILARITY_MATCH_THRESHOLD: float = 0.45
    HIGH_CONFIDENCE_THRESHOLD: float = 0.70
    TOP_K_MATCHES: int = 5
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
