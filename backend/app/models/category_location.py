from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    icon = Column(String(64), nullable=True)  # Lucide icon name, e.g. "laptop", "book", "backpack"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    items = relationship("Item", back_populates="category")


class CampusLocation(Base):
    __tablename__ = "campus_locations"

    id = Column(Integer, primary_key=True, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    building = Column(String(64), nullable=False)
    floor = Column(String(32), nullable=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    college = relationship("College", back_populates="campus_locations")
    reports = relationship("Report", back_populates="location")


class StorageLocation(Base):
    """
    Physical storage location where items are secured while in custody.
    Separate from campus discovery locations.
    """
    __tablename__ = "storage_locations"

    id = Column(Integer, primary_key=True, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    building = Column(String(64), nullable=False)
    room_number = Column(String(32), nullable=False)
    locker_box_identifier = Column(String(64), nullable=True)  # e.g., "Cabinet A - Shelf 2"
    custodian_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    college = relationship("College", back_populates="storage_locations")
    custodian = relationship("User", foreign_keys=[custodian_teacher_id])
    custody_records = relationship("CustodyRecord", back_populates="storage_location")
