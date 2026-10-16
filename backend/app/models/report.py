import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, Time, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class ReportType(str, enum.Enum):
    LOST = "LOST"
    FOUND = "FOUND"

class ReportStatus(str, enum.Enum):
    OPEN = "OPEN"                         # Newly submitted lost report or unassigned report
    PENDING_HANDOVER = "PENDING_HANDOVER" # Finder reported item but hasn't handed to teacher yet
    IN_CUSTODY = "IN_CUSTODY"             # Teacher verified physical receipt and secured item
    CLAIM_PENDING = "CLAIM_PENDING"       # An ownership claim is being reviewed
    RETURNED = "RETURNED"                 # Successfully verified & handed back to rightful owner
    CLOSED = "CLOSED"                     # Closed without recovery / expired / cancelled

class ReportPriority(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id"), nullable=True, index=True)
    report_number = Column(String(32), unique=True, index=True, nullable=False)
    report_type = Column(Enum(ReportType), nullable=False, index=True)
    
    # User roles in the report lifecycle
    submitted_by_student_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Student submitting report
    reported_lost_by_student_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Student who lost the item
    reported_found_by_student_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Finder who handed it over
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Logged-in user who created the record
    received_by_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Staff member confirming receipt
    
    report_date = Column(Date, default=date.today, nullable=False, index=True)
    approximate_event_time = Column(String(32), nullable=True) # e.g. "10:30 AM" or "During 3rd period recess"
    location_id = Column(Integer, ForeignKey("campus_locations.id"), nullable=False)
    detailed_description = Column(Text, nullable=False)
    
    status = Column(Enum(ReportStatus), default=ReportStatus.OPEN, nullable=False, index=True)
    priority = Column(Enum(ReportPriority), default=ReportPriority.NORMAL, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_type = Column(String(64), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    manual_campus_location = Column(String(255), nullable=True)
    show_finder_name = Column(Boolean, default=True)
    handed_over_teacher_name = Column(String(255), nullable=True)

    # Relationships
    college = relationship("College", back_populates="reports")
    location = relationship("CampusLocation", back_populates="reports")
    creator = relationship("User", foreign_keys=[created_by_user_id], back_populates="created_reports")
    submitting_student = relationship("User", foreign_keys=[submitted_by_student_id], back_populates="submitted_reports")
    lost_student = relationship("User", foreign_keys=[reported_lost_by_student_id], back_populates="reported_lost_reports")
    finder_student = relationship("User", foreign_keys=[reported_found_by_student_id], back_populates="reported_found_reports")
    receiving_teacher = relationship("User", foreign_keys=[received_by_teacher_id], back_populates="received_reports")
    
    item = relationship("Item", back_populates="report", uselist=False, cascade="all, delete-orphan")
    images = relationship("ItemImage", back_populates="report", cascade="all, delete-orphan")
    custody_records = relationship("CustodyRecord", back_populates="report", cascade="all, delete-orphan")
    claims = relationship("Claim", foreign_keys="Claim.found_report_id", back_populates="found_report", cascade="all, delete-orphan")
    return_records = relationship("ReturnRecord", back_populates="report", cascade="all, delete-orphan")
    
    # Matches where this report is LOST or FOUND
    lost_matches = relationship("Match", foreign_keys="Match.lost_report_id", back_populates="lost_report", cascade="all, delete-orphan")
    found_matches = relationship("Match", foreign_keys="Match.found_report_id", back_populates="found_report", cascade="all, delete-orphan")
