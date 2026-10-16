import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class HandoverStatus(str, enum.Enum):
    PENDING = "PENDING"          # Initial handover recorded, awaiting teacher acknowledgement
    CONFIRMED = "CONFIRMED"      # Physical receipt verified and confirmed by teacher
    TRANSFERRED = "TRANSFERRED"  # Custody transferred between staff members or storage locations
    RELEASED = "RELEASED"        # Released back to verified owner student

class CustodyRecord(Base):
    __tablename__ = "custody_records"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    
    previous_custodian_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    new_custodian_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    transferred_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    received_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=True)
    
    handover_status = Column(Enum(HandoverStatus), default=HandoverStatus.CONFIRMED, nullable=False)
    handover_notes = Column(Text, nullable=True)
    
    transferred_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)

    # Relationships
    report = relationship("Report", back_populates="custody_records")
    previous_custodian = relationship("User", foreign_keys=[previous_custodian_id])
    new_custodian = relationship("User", foreign_keys=[new_custodian_id])
    transferred_by = relationship("User", foreign_keys=[transferred_by_user_id])
    received_by = relationship("User", foreign_keys=[received_by_user_id])
    storage_location = relationship("StorageLocation", back_populates="custody_records")
