from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base

class College(Base):
    __tablename__ = "colleges"

    id = Column(Integer, primary_key=True, index=True)
    college_code = Column(String(32), unique=True, index=True, nullable=False) # e.g. "TECH-CAMPUS", "MIT", "STANFORD"
    name = Column(String(128), unique=True, nullable=False, index=True)
    domain = Column(String(64), nullable=True) # e.g. "campus.edu"
    address = Column(String(255), nullable=True)
    city = Column(String(64), nullable=True)
    state = Column(String(64), nullable=True)
    contact_email = Column(String(128), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="college")
    campus_locations = relationship("CampusLocation", back_populates="college", cascade="all, delete-orphan")
    storage_locations = relationship("StorageLocation", back_populates="college", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="college")
