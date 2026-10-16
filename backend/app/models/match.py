import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class MatchStatus(str, enum.Enum):
    SUGGESTED = "SUGGESTED"    # Auto-detected by image matching pipeline
    REVIEWED = "REVIEWED"      # Seen by staff
    CONFIRMED = "CONFIRMED"    # Teacher confirmed that this lost report matches this found item
    REJECTED = "REJECTED"      # Staff evaluated and verified they are different items

class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("lost_report_id", "found_report_id", name="uq_lost_found_match_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lost_report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    found_report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    
    similarity_score = Column(Float, nullable=False) # Combined composite score (0.0 to 1.0)
    visual_score = Column(Float, nullable=False)     # Pure image visual similarity score
    metadata_score = Column(Float, nullable=False)   # Category, color, date, location score
    
    matching_model_version = Column(String(64), default="CampusTrace-Vision-v1.0", nullable=False)
    matching_features = Column(JSON, nullable=True)  # Structured explanation of matching signals
    
    match_status = Column(Enum(MatchStatus), default=MatchStatus.SUGGESTED, nullable=False, index=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    lost_report = relationship("Report", foreign_keys=[lost_report_id], back_populates="lost_matches")
    found_report = relationship("Report", foreign_keys=[found_report_id], back_populates="found_matches")
    reviewer = relationship("User", foreign_keys=[reviewed_by_user_id])
