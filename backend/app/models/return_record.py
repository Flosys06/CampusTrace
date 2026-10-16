import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class VerificationMethod(str, enum.Enum):
    STUDENT_ID_CARD = "STUDENT_ID_CARD"
    DEVICE_UNLOCK_OR_PIN = "DEVICE_UNLOCK_OR_PIN"
    SERIAL_NUMBER_MATCH = "SERIAL_NUMBER_MATCH"
    PRIVATE_IDENTIFIER = "PRIVATE_IDENTIFIER"
    STAFF_RECOGNITION = "STAFF_RECOGNITION"

class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False, unique=True, index=True)
    
    released_by_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    collected_by_student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    verification_method = Column(Enum(VerificationMethod), nullable=False)
    returned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    report = relationship("Report", back_populates="return_records")
    item = relationship("Item")
    claim = relationship("Claim", back_populates="return_record")
    releasing_teacher = relationship("User", foreign_keys=[released_by_teacher_id])
    collecting_student = relationship("User", foreign_keys=[collected_by_student_id])
