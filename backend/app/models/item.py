from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, unique=True, index=True)
    item_name = Column(String(128), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    primary_image_id = Column(Integer, nullable=True) # ID of the primary ItemImage
    visual_description = Column(Text, nullable=True)
    color = Column(String(64), nullable=True)
    brand = Column(String(64), nullable=True)
    distinguishing_features = Column(Text, nullable=True) # e.g. "Sticker of Pikachu on the back corner"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    report = relationship("Report", back_populates="item")
    category = relationship("Category", back_populates="items")
    images = relationship("ItemImage", back_populates="item", cascade="all, delete-orphan")


class ItemImage(Base):
    __tablename__ = "item_images"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True, index=True)
    storage_key = Column(String(255), unique=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(64), nullable=False)
    file_size = Column(Integer, nullable=False)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    
    # Store visual embeddings & computer vision features as structured JSON
    # Contains: vector (float array), dominant_colors, edge_histogram, aspect_ratio
    visual_features = Column(JSON, nullable=True)
    
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    report = relationship("Report", back_populates="images")
    item = relationship("Item", back_populates="images")
    uploader = relationship("User", foreign_keys=[uploaded_by_user_id])
