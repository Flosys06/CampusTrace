import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class ClaimStatus(str, enum.Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    found_report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    claimant_student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    linked_lost_report_id = Column(Integer, ForeignKey("reports.id"), nullable=True)
    
    claim_description = Column(Text, nullable=False)
    # Private evidence (e.g. lock screen password, unique interior scratch, serial number, student card inside)
    # Protected: Never returned to other students
    private_ownership_evidence = Column(Text, nullable=False)
    
    status = Column(Enum(ClaimStatus), default=ClaimStatus.PENDING, nullable=False, index=True)
    reviewed_by_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    found_report = relationship("Report", foreign_keys=[found_report_id], back_populates="claims")
    claimant = relationship("User", foreign_keys=[claimant_student_id], back_populates="claims")
    linked_lost_report = relationship("Report", foreign_keys=[linked_lost_report_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_teacher_id])
    return_record = relationship("ReturnRecord", back_populates="claim", uselist=False)
