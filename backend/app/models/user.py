import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN = "ADMIN"                    # Legacy/College Admin alias
    COLLEGE_ADMIN = "COLLEGE_ADMIN"    # College-level administrator
    PLATFORM_ADMIN = "PLATFORM_ADMIN"  # Platform super-administrator

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id"), nullable=True, index=True)
    
    institutional_id = Column(String(64), index=True, nullable=False)  # Student ID / USN / Staff ID
    full_name = Column(String(128), nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False, index=True)
    
    # Profile & Academic details
    department = Column(String(64), nullable=True)     # e.g., "Computer Science", "Electrical Engineering"
    class_name = Column(String(64), nullable=True)     # e.g., "B.Tech CSE"
    section = Column(String(32), nullable=True)        # e.g., "Section A"
    student_id_usn = Column(String(64), nullable=True) # University Serial Number / Roll Number
    year_of_study = Column(String(32), nullable=True)  # e.g. "3rd Year" or "Sophomore"
    semester = Column(String(32), nullable=True)       # e.g. "6th Semester"
    phone_number = Column(String(32), nullable=True)   # Emergency contact
    bio = Column(String(255), nullable=True)
    profile_photo_url = Column(String(255), nullable=True)
    privacy_hide_contact = Column(Boolean, default=True, nullable=False) # Privacy shield
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    college = relationship("College", back_populates="users")
    created_reports = relationship("Report", foreign_keys="Report.created_by_user_id", back_populates="creator")
    submitted_reports = relationship("Report", foreign_keys="Report.submitted_by_student_id", back_populates="submitting_student")
    reported_lost_reports = relationship("Report", foreign_keys="Report.reported_lost_by_student_id", back_populates="lost_student")
    reported_found_reports = relationship("Report", foreign_keys="Report.reported_found_by_student_id", back_populates="finder_student")
    received_reports = relationship("Report", foreign_keys="Report.received_by_teacher_id", back_populates="receiving_teacher")
    claims = relationship("Claim", foreign_keys="Claim.claimant_student_id", back_populates="claimant")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
