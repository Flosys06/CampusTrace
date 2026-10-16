import logging
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.config import settings
from app.models.report import Report, ReportType, ReportStatus
from app.models.item import Item, ItemImage
from app.models.match import Match, MatchStatus
from app.models.category_location import Category, CampusLocation
from app.services.vision_extractor import vision_extractor
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event

logger = logging.getLogger("campustrace.matching")

class MatchingEngine:
    def __init__(self):
        self.threshold = settings.SIMILARITY_MATCH_THRESHOLD
        self.high_confidence_threshold = settings.HIGH_CONFIDENCE_THRESHOLD
        self.version = "CampusTrace-Vision-v2.0"

    @staticmethod
    def _extract_tokens(text: Optional[str]) -> set:
        """Tokenize and remove common stop words."""
        if not text:
            return set()
        import re
        stop_words = {
            "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of",
            "with", "is", "my", "this", "that", "item", "lost", "found", "by", "from"
        }
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        return {t for t in tokens if len(t) > 1 and t not in stop_words}

    def _compute_text_and_brand_score(
        self,
        lost_item: Optional[Item],
        found_item: Optional[Item],
        lost_report: Report,
        found_report: Report
    ) -> Tuple[float, List[str]]:
        """
        Computes text, title, brand, and keyword similarity between reports.
        Returns:
            text_score (0.0 to 1.0)
            text_notes (list of human-readable explanation strings)
        """
        notes = []
        if not lost_item or not found_item:
            return 0.20, ["Basic metadata comparison"]

        lost_title = (lost_item.item_name or "").strip().lower()
        found_title = (found_item.item_name or "").strip().lower()

        # 1. Title token overlap
        lost_tokens = self._extract_tokens(lost_title)
        found_tokens = self._extract_tokens(found_title)

        common_tokens = lost_tokens.intersection(found_tokens)
        all_tokens = lost_tokens.union(found_tokens)

        title_sim = 0.0
        if lost_title == found_title and lost_title:
            title_sim = 1.0
            notes.append(f"Identical item title: '{lost_item.item_name}'")
        elif lost_title in found_title or found_title in lost_title:
            title_sim = 0.85
            notes.append(f"Matching title keywords: '{lost_item.item_name}' / '{found_item.item_name}'")
        elif all_tokens:
            jaccard = len(common_tokens) / len(all_tokens)
            if common_tokens:
                title_sim = min(1.0, jaccard * 1.5)
                notes.append(f"Shared title tokens: {', '.join(sorted(common_tokens))}")
            else:
                title_sim = 0.0
                notes.append(f"Different item titles ('{lost_item.item_name}' vs '{found_item.item_name}')")

        # 2. Brand matching
        brand_score = 0.5
        lost_brand = (lost_item.brand or "").strip().lower()
        found_brand = (found_item.brand or "").strip().lower()

        if lost_brand and found_brand:
            if lost_brand == found_brand:
                brand_score = 1.0
                notes.append(f"Identical brand: {lost_item.brand}")
            else:
                brand_score = 0.0
                notes.append(f"Different brands ('{lost_item.brand}' vs '{found_item.brand}')")
        elif lost_brand and (lost_brand in found_title or lost_brand in (found_report.detailed_description or "").lower()):
            brand_score = 0.90
            notes.append(f"Brand '{lost_item.brand}' referenced in found item description")
        elif found_brand and (found_brand in lost_title or found_brand in (lost_report.detailed_description or "").lower()):
            brand_score = 0.90
            notes.append(f"Brand '{found_item.brand}' referenced in lost item description")

        # 3. Description keyword overlap
        desc_lost_tokens = self._extract_tokens(lost_report.detailed_description)
        desc_found_tokens = self._extract_tokens(found_report.detailed_description)
        desc_common = desc_lost_tokens.intersection(desc_found_tokens)
        desc_bonus = min(0.15, len(desc_common) * 0.04)
        if desc_common:
            notes.append(f"Shared descriptive terms: {', '.join(list(desc_common)[:3])}")

        # If brands explicitly conflict, heavily penalize text score
        if lost_brand and found_brand and lost_brand != found_brand:
            combined_text_score = min(0.10, title_sim * 0.2)
        else:
            combined_text_score = min(1.0, (title_sim * 0.65) + (brand_score * 0.35) + desc_bonus)

        return round(combined_text_score, 4), notes

    def compute_match_score(
        self,
        lost_report: Report,
        found_report: Report
    ) -> Tuple[float, float, float, Dict[str, Any]]:
        """
        Computes composite similarity score between a LOST and a FOUND report.
        Returns:
            composite_score (float, 0.0 - 1.0)
            visual_score (float, 0.0 - 1.0)
            metadata_score (float, 0.0 - 1.0)
            explanation (dict)
        """
        lost_item: Optional[Item] = lost_report.item
        found_item: Optional[Item] = found_report.item
        summary_points = []

        # 1. Visual Score with Calibrated Cosine Similarity
        visual_score = 0.0
        raw_visual_score = 0.0
        has_both_images = False

        lost_img = next((img for img in lost_report.images if img.visual_features), None)
        found_img = next((img for img in found_report.images if img.visual_features), None)

        if lost_img and found_img:
            lost_vec = lost_img.visual_features.get("embedding", [])
            found_vec = found_img.visual_features.get("embedding", [])
            if lost_vec and found_vec and len(lost_vec) == len(found_vec):
                raw_visual_score = vision_extractor.cosine_similarity(lost_vec, found_vec)
                visual_score = vision_extractor.calibrate_visual_similarity(raw_visual_score)
                has_both_images = True

        # 2. Text / Brand Match (weight: 0.35)
        text_score, text_notes = self._compute_text_and_brand_score(
            lost_item, found_item, lost_report, found_report
        )
        summary_points.extend(text_notes)

        # 3. Category Match (weight: 0.30)
        cat_match = False
        cat_score = 0.0
        if lost_item and found_item:
            if lost_item.category_id == found_item.category_id:
                cat_match = True
                cat_score = 0.30
                cat_name = lost_item.category.name if lost_item.category else "Category"
                summary_points.append(f"Matching category '{cat_name}'")
            else:
                cat_score = 0.0
                summary_points.append("Different categories")

        # 4. Color Match (weight: 0.15)
        color_match = False
        color_score = 0.0
        lost_colors = set()
        found_colors = set()

        if lost_item and lost_item.color:
            lost_colors.add(lost_item.color.strip().lower())
        if found_item and found_item.color:
            found_colors.add(found_item.color.strip().lower())

        if lost_img and lost_img.visual_features:
            for c in lost_img.visual_features.get("dominant_colors", []):
                lost_colors.add(c["name"].lower())
        if found_img and found_img.visual_features:
            for c in found_img.visual_features.get("dominant_colors", []):
                found_colors.add(c["name"].lower())

        common_colors = lost_colors.intersection(found_colors)
        if common_colors:
            color_match = True
            color_score = 0.15
            summary_points.append(f"Shared color features: {', '.join(sorted(common_colors)).title()}")
        elif lost_colors and found_colors:
            color_score = 0.0
            summary_points.append("Contrasting color profiles")
        else:
            color_score = 0.05  # Neutral if unstated

        # 5. Temporal Proximity (weight: 0.12)
        date_score = 0.0
        days_diff = None
        if lost_report.report_date and found_report.report_date:
            days_diff = (found_report.report_date - lost_report.report_date).days
            if 0 <= days_diff <= 2:
                date_score = 0.12
            elif 3 <= days_diff <= 7:
                date_score = 0.08
            elif 8 <= days_diff <= 21:
                date_score = 0.04
            elif -2 <= days_diff < 0:
                date_score = 0.06
            else:
                date_score = 0.0

            if days_diff == 0:
                summary_points.append("Reported on the same calendar day")
            elif days_diff > 0:
                summary_points.append(f"Found {days_diff} day{'s' if days_diff > 1 else ''} after lost date")
            else:
                summary_points.append(f"Found {abs(days_diff)} day{'s' if abs(days_diff) > 1 else ''} before report filing")

        # 6. Location Proximity (weight: 0.08)
        loc_score = 0.0
        loc_summary = "Different locations"
        if lost_report.location_id == found_report.location_id:
            loc_score = 0.08
            loc_summary = f"Identical campus location ({lost_report.location.name if lost_report.location else 'Same area'})"
            summary_points.append(loc_summary)
        elif lost_report.location and found_report.location:
            if lost_report.location.building == found_report.location.building:
                loc_score = 0.04
                loc_summary = f"Same building ({lost_report.location.building})"
                summary_points.append(loc_summary)

        metadata_score = min(1.0, (text_score * 0.35) + cat_score + color_score + date_score + loc_score)

        # 7. Composite Score & Visual Gating
        if has_both_images:
            pct = round(visual_score * 100, 1)
            summary_points.insert(0, f"Calibrated visual confidence: {pct}%")

            # VISUAL GATING: If both items have photographs and visual similarity is low (< 0.25),
            # never allow category/location/date metadata to manufacture a false match!
            if visual_score < 0.25:
                composite_score = min(visual_score, 0.35)
                summary_points.insert(1, "Visual gating: Images appear dissimilar")
            else:
                composite_score = (0.65 * visual_score) + (0.35 * metadata_score)
        else:
            # If no photos exist for comparison:
            # If item titles are completely unrelated (text_score <= 0.10), cap score so it never falsely matches
            if text_score <= 0.10:
                composite_score = min(metadata_score, 0.40)
            else:
                composite_score = metadata_score

        explanation = {
            "visual_similarity_percent": round(visual_score * 100, 1) if has_both_images else None,
            "raw_visual_cosine": round(raw_visual_score, 4) if has_both_images else None,
            "text_score": text_score,
            "category_match": cat_match,
            "category_name": lost_item.category.name if (lost_item and lost_item.category) else None,
            "color_match": color_match,
            "shared_colors": list(common_colors),
            "temporal_proximity_days": days_diff,
            "location_proximity": loc_summary,
            "summary": " | ".join(summary_points) if summary_points else "General attribute alignment"
        }

        return round(composite_score, 4), round(visual_score, 4), round(metadata_score, 4), explanation

    def find_and_save_matches_for_report(self, db: Session, report: Report) -> List[Match]:
        """
        Discovers cross-matches for a newly created or updated report.
        If report is LOST -> compares against active FOUND reports.
        If report is FOUND -> compares against active LOST reports.
        Excludes closed and returned reports.
        Persists suggested matches and sends notifications.
        """
        # Exclude closed and returned reports from triggering or receiving matches
        if report.status in (ReportStatus.CLOSED, ReportStatus.RETURNED):
            return []

        created_matches = []

        # Determine target opposite type and valid statuses
        if report.report_type == ReportType.LOST:
            opposite_type = ReportType.FOUND
            opposite_statuses = [ReportStatus.OPEN, ReportStatus.PENDING_HANDOVER, ReportStatus.IN_CUSTODY]
        else:
            opposite_type = ReportType.LOST
            opposite_statuses = [ReportStatus.OPEN]

        candidate_query = db.query(Report).filter(
            Report.report_type == opposite_type,
            Report.status.in_(opposite_statuses),
            Report.status.notin_([ReportStatus.CLOSED, ReportStatus.RETURNED]),
            Report.id != report.id
        )
        if report.college_id:
            candidate_query = candidate_query.filter(Report.college_id == report.college_id)

        candidates = candidate_query.all()

        match_candidates = []
        for candidate in candidates:
            lost_rep = report if report.report_type == ReportType.LOST else candidate
            found_rep = candidate if report.report_type == ReportType.LOST else report

            comp_score, vis_score, meta_score, explanation = self.compute_match_score(lost_rep, found_rep)
            if comp_score >= self.threshold:
                match_candidates.append((comp_score, vis_score, meta_score, explanation, lost_rep, found_rep))

        # Sort descending by composite similarity score
        match_candidates.sort(key=lambda x: x[0], reverse=True)

        for comp_score, vis_score, meta_score, explanation, lost_rep, found_rep in match_candidates:
            # Check for existing match pair
            existing_match = db.query(Match).filter(
                Match.lost_report_id == lost_rep.id,
                Match.found_report_id == found_rep.id
            ).first()

            if existing_match:
                # Update scores if matching engine produced improved inference
                existing_match.similarity_score = comp_score
                existing_match.visual_score = vis_score
                existing_match.metadata_score = meta_score
                existing_match.matching_features = explanation
                created_matches.append(existing_match)
            else:
                new_match = Match(
                    lost_report_id=lost_rep.id,
                    found_report_id=found_rep.id,
                    similarity_score=comp_score,
                    visual_score=vis_score,
                    metadata_score=meta_score,
                    matching_model_version=self.version,
                    matching_features=explanation,
                    match_status=MatchStatus.SUGGESTED
                )
                db.add(new_match)
                db.flush()  # obtain new_match.id

                # Notify student who reported lost item
                student_id = lost_rep.submitted_by_student_id or lost_rep.created_by_user_id
                if student_id:
                    create_notification(
                        db,
                        user_id=student_id,
                        title="Potential Match Found!",
                        message=f"A found item matches your report #{lost_rep.report_number} with {round(comp_score*100)}% similarity confidence.",
                        notification_type="MATCH_FOUND",
                        link_url=f"/reports/{lost_rep.id}?tab=matches"
                    )

                # Notify receiving teacher or creator of found report
                if found_rep.received_by_teacher_id:
                    create_notification(
                        db,
                        user_id=found_rep.received_by_teacher_id,
                        title="New Potential Match for Custody Item",
                        message=f"Found report #{found_rep.report_number} has a potential match ({round(comp_score*100)}%) with lost report #{lost_rep.report_number}.",
                        notification_type="MATCH_FOUND",
                        link_url=f"/reports/{found_rep.id}"
                    )

                log_audit_event(
                    db=db,
                    action="MATCH_SUGGESTED",
                    entity_type="MATCH",
                    entity_id=str(new_match.id),
                    actor_user_id=None,
                    metadata={
                        "lost_report_number": lost_rep.report_number,
                        "found_report_number": found_rep.report_number,
                        "similarity_score": comp_score,
                        "visual_score": vis_score
                    }
                )
                created_matches.append(new_match)

        db.commit()
        return created_matches

matching_engine = MatchingEngine()
