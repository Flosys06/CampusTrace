import os
import sys
from pathlib import Path
from datetime import datetime, date, timedelta
import numpy as np
from PIL import Image, ImageDraw

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import engine, Base, SessionLocal
from app.models.user import User, UserRole
from app.models.category_location import Category, CampusLocation, StorageLocation
from app.models.report import Report, ReportType, ReportStatus, ReportPriority
from app.models.item import Item, ItemImage
from app.models.custody import CustodyRecord, HandoverStatus
from app.models.match import Match, MatchStatus
from app.models.claim import Claim, ClaimStatus
from app.models.return_record import ReturnRecord, VerificationMethod
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.services.auth_service import hash_password
from app.services.vision_extractor import vision_extractor
from app.services.matching_engine import matching_engine

def generate_sample_image(filename: str, color_bgr: tuple, shape_type: str, label_text: str) -> Path:
    """Generates a clean synthetic item photo for reproducible computer vision feature extraction."""
    upload_dir = BASE_DIR / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    img_path = upload_dir / filename

    img = Image.new("RGB", (400, 400), color=(240, 243, 246)) # Soft campus gray background
    draw = ImageDraw.Draw(img)

    # Draw simulated item in center
    # color_bgr is (B, G, R), PIL expects (R, G, B)
    rgb_color = (color_bgr[2], color_bgr[1], color_bgr[0])

    if shape_type == "laptop":
        draw.rounded_rectangle([70, 110, 330, 270], radius=12, fill=rgb_color, outline=(90, 90, 90), width=3)
        draw.rectangle([110, 140, 290, 240], fill=(20, 25, 30))
        draw.polygon([(40, 280), (360, 280), (330, 270), (70, 270)], fill=rgb_color)
    elif shape_type == "bottle":
        draw.rounded_rectangle([140, 90, 260, 330], radius=25, fill=rgb_color, outline=(60, 60, 60), width=3)
        draw.rectangle([170, 60, 230, 90], fill=(180, 180, 180), outline=(80, 80, 80), width=2)
    elif shape_type == "backpack":
        draw.rounded_rectangle([90, 100, 310, 340], radius=40, fill=rgb_color, outline=(40, 40, 40), width=3)
        draw.rectangle([130, 200, 270, 300], fill=rgb_color, outline=(30, 30, 30), width=2)
        draw.arc([140, 60, 260, 130], start=180, end=0, fill=(60, 60, 60), width=8)
    elif shape_type == "wallet":
        draw.rounded_rectangle([100, 130, 300, 270], radius=15, fill=rgb_color, outline=(50, 40, 30), width=3)
        draw.line([(100, 200), (300, 200)], fill=(70, 50, 40), width=2)
    elif shape_type == "headphones":
        draw.arc([100, 80, 300, 260], start=180, end=0, fill=(50, 50, 50), width=14)
        draw.rounded_rectangle([80, 190, 130, 280], radius=20, fill=rgb_color)
        draw.rounded_rectangle([270, 190, 320, 280], radius=20, fill=rgb_color)
    else:
        draw.rounded_rectangle([100, 100, 300, 300], radius=20, fill=rgb_color, outline=(50, 50, 50), width=3)

    img.save(img_path, format="JPEG", quality=92)
    return img_path

def seed_database():
    print("Initializing database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding Categories...")
        categories = [
            Category(name="Electronics", description="Laptops, phones, tablets, smartwatches, power banks", icon="laptop"),
            Category(name="Bags & Backpacks", description="School bags, totes, laptop sleeves, sports duffels", icon="backpack"),
            Category(name="IDs, Cards & Wallets", description="Student ID cards, driver licenses, purses, money clips", icon="credit-card"),
            Category(name="Audio & Headphones", description="Earbuds, over-ear headphones, audio adapters, speakers", icon="headphones"),
            Category(name="Keys & Lanyards", description="Dorm room keys, vehicle key fobs, campus card lanyards", icon="key"),
            Category(name="Water Bottles & Flasks", description="Insulated tumblers, Hydroflasks, shaker bottles", icon="cup-soda"),
            Category(name="Apparel & Outerwear", description="Jackets, hoodies, college crewnecks, caps, umbrellas", icon="shirt"),
            Category(name="Books & Study Materials", description="Textbooks, lab binders, scientific calculators, notebooks", icon="book-open"),
            Category(name="Eyewear & Accessories", description="Prescription glasses, sunglasses, jewelry, wristwatches", icon="glasses"),
            Category(name="Other Belongings", description="Miscellaneous personal possessions", icon="help-circle"),
        ]
        db.add_all(categories)
        db.commit()

        print("Seeding Campus Discovery Locations...")
        locations = [
            CampusLocation(name="Main Library - 2nd Floor Quiet Zone", building="Central Library", floor="2nd Floor", description="Room 210"),
            CampusLocation(name="Science Complex - Chemistry Lab 304", building="Science Hall", floor="3rd Floor", description="Lab 304"),
            CampusLocation(name="North Campus Cafeteria - Booth Area", building="Student Center", floor="1st Floor", description="Dining Commons"),
            CampusLocation(name="Athletic Complex - Basketball Court B", building="Sports Pavilion", floor="Ground", description="Court B"),
            CampusLocation(name="Engineering Hall - Lecture Auditorium 102", building="Engineering Center", floor="1st Floor", description="Auditorium 102"),
            CampusLocation(name="Central Quad Lawn & Fountain", building="Outdoor", floor="Ground", description="Courtyard"),
            CampusLocation(name="East Campus Commuter Parking Lot", building="Parking Facilities", floor="Ground", description="Bay C-4"),
            CampusLocation(name="Student Innovation Hub - Makerspace", building="Technology Building", floor="2nd Floor", description="Hub 205")
        ]
        db.add_all(locations)
        db.commit()

        print("Seeding Storage Locations (Chain of Custody)...")
        storages = [
            StorageLocation(name="Main Campus Security Vault - Locker 14B", building="Security Headquarters", room_number="Room 101", locker_box_identifier="Locker 14B", notes="Restricted staff access with biometric keycard"),
            StorageLocation(name="Dean of Students Staff Office Safe", building="Administration Building", room_number="Admin 204", locker_box_identifier="Safe Box 2", notes="High-value electronics, wallets, and government IDs"),
            StorageLocation(name="Library Circulation Custody Cabinet", building="Central Library", room_number="Circulation Desk", locker_box_identifier="Cabinet A", notes="Short-term custody for library lost and found items"),
            StorageLocation(name="Student Affairs Lost & Found Depot - Shelf 3", building="Student Union", room_number="Room 112", locker_box_identifier="Shelf 3", notes="General student items and outerwear storage")
        ]
        db.add_all(storages)
        db.commit()

        print("Seeding Institutional Users...")
        # Password for all demo accounts:
        # Admin: Admin@123
        # Teachers: Teacher@123
        # Students: Student@123
        users = [
            User(
                institutional_id="ADM-001",
                full_name="Dr. Eleanor Vance",
                email="admin@campus.edu",
                password_hash=hash_password("Admin@123"),
                role=UserRole.ADMIN,
                department="Campus Operations & Safety",
                is_active=True
            ),
            User(
                institutional_id="TCH-101",
                full_name="Prof. Sarah Jenkins",
                email="sarah.jenkins@campus.edu",
                password_hash=hash_password("Teacher@123"),
                role=UserRole.TEACHER,
                department="Computer Science & Engineering",
                is_active=True
            ),
            User(
                institutional_id="TCH-102",
                full_name="Dr. Robert Chen",
                email="robert.chen@campus.edu",
                password_hash=hash_password("Teacher@123"),
                role=UserRole.TEACHER,
                department="Department of Chemistry",
                is_active=True
            ),
            User(
                institutional_id="STU-5001",
                full_name="Alex Miller",
                email="alex.miller@campus.edu",
                password_hash=hash_password("Student@123"),
                role=UserRole.STUDENT,
                class_name="Computer Science Year 3",
                section="A",
                department="School of Computing",
                is_active=True
            ),
            User(
                institutional_id="STU-5002",
                full_name="Priya Patel",
                email="priya.patel@campus.edu",
                password_hash=hash_password("Student@123"),
                role=UserRole.STUDENT,
                class_name="Biochemistry Year 2",
                section="B",
                department="School of Sciences",
                is_active=True
            ),
            User(
                institutional_id="STU-5003",
                full_name="Jordan Taylor",
                email="jordan.taylor@campus.edu",
                password_hash=hash_password("Student@123"),
                role=UserRole.STUDENT,
                class_name="Mechanical Engineering Year 4",
                section="A",
                department="School of Engineering",
                is_active=True
            ),
            User(
                institutional_id="STU-5004",
                full_name="Marcus Wright",
                email="marcus.wright@campus.edu",
                password_hash=hash_password("Student@123"),
                role=UserRole.STUDENT,
                class_name="Economics Year 1",
                section="C",
                department="School of Business",
                is_active=True
            )
        ]
        db.add_all(users)
        db.commit()

        # Query back entities for relationships
        admin_user = db.query(User).filter(User.institutional_id == "ADM-001").first()
        tch_jenkins = db.query(User).filter(User.institutional_id == "TCH-101").first()
        tch_chen = db.query(User).filter(User.institutional_id == "TCH-102").first()
        stu_alex = db.query(User).filter(User.institutional_id == "STU-5001").first()
        stu_priya = db.query(User).filter(User.institutional_id == "STU-5002").first()
        stu_jordan = db.query(User).filter(User.institutional_id == "STU-5003").first()
        stu_marcus = db.query(User).filter(User.institutional_id == "STU-5004").first()

        cat_electronics = db.query(Category).filter(Category.name == "Electronics").first()
        cat_bottles = db.query(Category).filter(Category.name == "Water Bottles & Flasks").first()
        cat_backpacks = db.query(Category).filter(Category.name == "Bags & Backpacks").first()
        cat_wallets = db.query(Category).filter(Category.name == "IDs, Cards & Wallets").first()
        cat_audio = db.query(Category).filter(Category.name == "Audio & Headphones").first()

        loc_library = db.query(CampusLocation).filter(CampusLocation.name.like("%Library%")).first()
        loc_cafe = db.query(CampusLocation).filter(CampusLocation.name.like("%Cafeteria%")).first()
        loc_science = db.query(CampusLocation).filter(CampusLocation.name.like("%Chemistry%")).first()
        loc_gym = db.query(CampusLocation).filter(CampusLocation.name.like("%Basketball%")).first()

        storage_vault = db.query(StorageLocation).filter(StorageLocation.name.like("%Security Vault%")).first()
        storage_lib = db.query(StorageLocation).filter(StorageLocation.name.like("%Circulation%")).first()

        print("Generating realistic synthetic images with OpenCV feature extraction...")
        # Image 1: Silver MacBook Air (Lost Report by Alex)
        img_mac_lost = generate_sample_image("demo_macbook_lost.jpg", (195, 195, 195), "laptop", "Silver Laptop")
        feat_mac_lost = vision_extractor.extract_features(img_mac_lost)

        # Image 2: Silver MacBook Air (Found Report received by Teacher Jenkins)
        img_mac_found = generate_sample_image("demo_macbook_found.jpg", (190, 192, 195), "laptop", "Found Laptop")
        feat_mac_found = vision_extractor.extract_features(img_mac_found)

        # Image 3: Black Hydroflask (Found Report by Priya, received by Teacher Chen)
        img_bottle_found = generate_sample_image("demo_bottle_found.jpg", (25, 25, 25), "bottle", "Black Flask")
        feat_bottle_found = vision_extractor.extract_features(img_bottle_found)

        # Image 4: Dark Navy Blue Backpack (Lost Report by Jordan)
        img_bag_lost = generate_sample_image("demo_backpack_lost.jpg", (120, 45, 25), "backpack", "Navy Backpack")
        feat_bag_lost = vision_extractor.extract_features(img_bag_lost)

        # Image 5: Black Wireless Headphones (Found Report pending handover)
        img_audio_found = generate_sample_image("demo_headphones_found.jpg", (30, 30, 30), "headphones", "Headphones")
        feat_audio_found = vision_extractor.extract_features(img_audio_found)

        today = date.today()

        # ==========================================
        # Scenario 1: MATCHING PAIR (MacBook Air)
        # ==========================================
        print("Creating Scenario 1: High-Confidence AI Matched Pair (MacBook Air)...")
        # 1A. Lost report by Alex Miller
        rep_mac_lost = Report(
            report_number="TRC-L-2026-0001",
            report_type=ReportType.LOST,
            submitted_by_student_id=stu_alex.id,
            reported_lost_by_student_id=stu_alex.id,
            created_by_user_id=stu_alex.id,
            report_date=today - timedelta(days=2),
            approximate_event_time="14:30",
            location_id=loc_library.id,
            detailed_description="Left my 13-inch Silver M2 MacBook Air on a study desk on the second floor silent area while taking a quick study break.",
            status=ReportStatus.OPEN,
            priority=ReportPriority.HIGH,
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(rep_mac_lost)
        db.flush()

        item_mac_lost = Item(
            report_id=rep_mac_lost.id,
            item_name="MacBook Air M2 13-inch",
            category_id=cat_electronics.id,
            visual_description="Silver aluminum unibody with small NASA sticker on bottom-left lid",
            color="Silver/Gray",
            brand="Apple",
            distinguishing_features="Small NASA circular sticker on the lid corner, slight scratch near headphone jack."
        )
        db.add(item_mac_lost)
        db.flush()

        img_mac_lost_rec = ItemImage(
            report_id=rep_mac_lost.id,
            item_id=item_mac_lost.id,
            storage_key="demo_macbook_lost.jpg",
            original_filename="macbook_desk.jpg",
            mime_type="image/jpeg",
            file_size=os.path.getsize(img_mac_lost),
            image_width=400,
            image_height=400,
            visual_features=feat_mac_lost,
            uploaded_by_user_id=stu_alex.id,
            is_primary=True
        )
        db.add(img_mac_lost_rec)

        # 1B. Found report registered by Prof. Sarah Jenkins (handed over by Priya Patel)
        rep_mac_found = Report(
            report_number="TRC-F-2026-0001",
            report_type=ReportType.FOUND,
            submitted_by_student_id=None,
            reported_found_by_student_id=stu_priya.id,
            created_by_user_id=tch_jenkins.id,
            received_by_teacher_id=tch_jenkins.id,
            report_date=today - timedelta(days=2),
            approximate_event_time="15:15",
            location_id=loc_library.id,
            detailed_description="Priya Patel handed over an Apple laptop found unattended near Desk 42 in the 2nd-floor library reading room.",
            status=ReportStatus.IN_CUSTODY,
            priority=ReportPriority.HIGH,
            created_at=datetime.utcnow() - timedelta(days=2, hours=-1)
        )
        db.add(rep_mac_found)
        db.flush()

        item_mac_found = Item(
            report_id=rep_mac_found.id,
            item_name="Silver Apple Laptop",
            category_id=cat_electronics.id,
            visual_description="Silver MacBook Air, sticker on top exterior.",
            color="Silver/Gray",
            brand="Apple",
            distinguishing_features="NASA emblem sticker on corner."
        )
        db.add(item_mac_found)
        db.flush()

        img_mac_found_rec = ItemImage(
            report_id=rep_mac_found.id,
            item_id=item_mac_found.id,
            storage_key="demo_macbook_found.jpg",
            original_filename="found_laptop_intake.jpg",
            mime_type="image/jpeg",
            file_size=os.path.getsize(img_mac_found),
            image_width=400,
            image_height=400,
            visual_features=feat_mac_found,
            uploaded_by_user_id=tch_jenkins.id,
            is_primary=True
        )
        db.add(img_mac_found_rec)

        # Custody record for Found MacBook
        custody_mac = CustodyRecord(
            report_id=rep_mac_found.id,
            item_id=item_mac_found.id,
            previous_custodian_id=stu_priya.id,
            new_custodian_id=tch_jenkins.id,
            transferred_by_user_id=tch_jenkins.id,
            received_by_user_id=tch_jenkins.id,
            storage_location_id=storage_vault.id,
            handover_status=HandoverStatus.CONFIRMED,
            handover_notes="Physical intake verified by Prof. Jenkins. Received from student Priya Patel (STU-5002) and secured in Main Security Vault Locker 14B.",
            transferred_at=datetime.utcnow() - timedelta(days=2),
            acknowledged_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(custody_mac)

        # AI Match between MacBook lost and MacBook found
        comp_score, vis_score, meta_score, explanation = matching_engine.compute_match_score(rep_mac_lost, rep_mac_found)
        mac_match = Match(
            lost_report_id=rep_mac_lost.id,
            found_report_id=rep_mac_found.id,
            similarity_score=comp_score,
            visual_score=vis_score,
            metadata_score=meta_score,
            matching_model_version=matching_engine.version,
            matching_features=explanation,
            match_status=MatchStatus.SUGGESTED,
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(mac_match)

        # Claim by Alex Miller on the MacBook Air
        claim_mac = Claim(
            found_report_id=rep_mac_found.id,
            claimant_student_id=stu_alex.id,
            linked_lost_report_id=rep_mac_lost.id,
            claim_description="This is my MacBook Air. I have the iCloud login credentials and serial number invoice.",
            private_ownership_evidence="Serial Number: C02G40XYZ987. Lock screen displays message 'Property of Alex Miller - alex.miller@campus.edu'.",
            status=ClaimStatus.PENDING,
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(claim_mac)
        rep_mac_found.status = ReportStatus.CLAIM_PENDING

        # ==========================================
        # Scenario 2: FOUND HYDROFLASK IN CUSTODY
        # ==========================================
        print("Creating Scenario 2: Found Water Bottle in Teacher Custody...")
        rep_bottle = Report(
            report_number="TRC-F-2026-0002",
            report_type=ReportType.FOUND,
            submitted_by_student_id=None,
            reported_found_by_student_id=stu_marcus.id,
            created_by_user_id=tch_chen.id,
            received_by_teacher_id=tch_chen.id,
            report_date=today - timedelta(days=1),
            approximate_event_time="11:00",
            location_id=loc_science.id,
            detailed_description="Black Hydroflask insulated flask recovered from Chemistry Lab 304 bench.",
            status=ReportStatus.IN_CUSTODY,
            priority=ReportPriority.NORMAL,
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(rep_bottle)
        db.flush()

        item_bottle = Item(
            report_id=rep_bottle.id,
            item_name="Hydroflask 32oz Insulated Tumbler",
            category_id=cat_bottles.id,
            visual_description="Matte black stainless steel bottle with black flex cap.",
            color="Black",
            brand="Hydroflask",
            distinguishing_features="Small dent near bottom rim, custom blue silicone boot."
        )
        db.add(item_bottle)
        db.flush()

        img_bottle_rec = ItemImage(
            report_id=rep_bottle.id,
            item_id=item_bottle.id,
            storage_key="demo_bottle_found.jpg",
            original_filename="black_hydroflask.jpg",
            mime_type="image/jpeg",
            file_size=os.path.getsize(img_bottle_found),
            image_width=400,
            image_height=400,
            visual_features=feat_bottle_found,
            uploaded_by_user_id=tch_chen.id,
            is_primary=True
        )
        db.add(img_bottle_rec)

        custody_bottle = CustodyRecord(
            report_id=rep_bottle.id,
            item_id=item_bottle.id,
            previous_custodian_id=stu_marcus.id,
            new_custodian_id=tch_chen.id,
            transferred_by_user_id=tch_chen.id,
            received_by_user_id=tch_chen.id,
            storage_location_id=storage_lib.id,
            handover_status=HandoverStatus.CONFIRMED,
            handover_notes="Received from Marcus Wright after Chemistry lecture. Placed in Circulation Desk Custody Cabinet.",
            transferred_at=datetime.utcnow() - timedelta(days=1),
            acknowledged_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(custody_bottle)

        # ==========================================
        # Scenario 3: STUDENT FOUND ITEM AWAITING HANDOVER
        # ==========================================
        print("Creating Scenario 3: Found item pending teacher physical intake...")
        rep_audio = Report(
            report_number="TRC-F-2026-0003",
            report_type=ReportType.FOUND,
            submitted_by_student_id=stu_jordan.id,
            reported_found_by_student_id=stu_jordan.id,
            created_by_user_id=stu_jordan.id,
            received_by_teacher_id=None,
            report_date=today,
            approximate_event_time="09:15",
            location_id=loc_gym.id,
            detailed_description="Found black wireless noise-canceling headphones on the bleachers in the basketball court.",
            status=ReportStatus.PENDING_HANDOVER,
            priority=ReportPriority.NORMAL,
            created_at=datetime.utcnow() - timedelta(hours=3)
        )
        db.add(rep_audio)
        db.flush()

        item_audio = Item(
            report_id=rep_audio.id,
            item_name="Sony WH-1000XM4 Wireless Headphones",
            category_id=cat_audio.id,
            visual_description="Matte black over-ear headphones with copper accents.",
            color="Black",
            brand="Sony",
            distinguishing_features="Left ear cushion has slight crease, custom braided charging cable inside case."
        )
        db.add(item_audio)
        db.flush()

        img_audio_rec = ItemImage(
            report_id=rep_audio.id,
            item_id=item_audio.id,
            storage_key="demo_headphones_found.jpg",
            original_filename="headphones_bleachers.jpg",
            mime_type="image/jpeg",
            file_size=os.path.getsize(img_audio_found),
            image_width=400,
            image_height=400,
            visual_features=feat_audio_found,
            uploaded_by_user_id=stu_jordan.id,
            is_primary=True
        )
        db.add(img_audio_rec)

        # ==========================================
        # Scenario 4: SUCCESSFULLY RETURNED ITEM (Audit proof)
        # ==========================================
        print("Creating Scenario 4: Verified Returned Item with Chain of Custody...")
        rep_wallet_ret = Report(
            report_number="TRC-F-2026-0004",
            report_type=ReportType.FOUND,
            submitted_by_student_id=None,
            reported_found_by_student_id=stu_alex.id,
            created_by_user_id=tch_jenkins.id,
            received_by_teacher_id=tch_jenkins.id,
            report_date=today - timedelta(days=5),
            approximate_event_time="12:30",
            location_id=loc_cafe.id,
            detailed_description="Brown leather wallet with campus meal card and student ID found in cafeteria.",
            status=ReportStatus.RETURNED,
            priority=ReportPriority.HIGH,
            created_at=datetime.utcnow() - timedelta(days=5),
            resolved_at=datetime.utcnow() - timedelta(days=4)
        )
        db.add(rep_wallet_ret)
        db.flush()

        item_wallet = Item(
            report_id=rep_wallet_ret.id,
            item_name="Brown Leather Bi-fold Wallet",
            category_id=cat_wallets.id,
            visual_description="Vintage tan brown leather wallet with embossed initials.",
            color="Brown",
            brand="Fossil",
            distinguishing_features="Embossed 'MW' initials on corner, student ID inside."
        )
        db.add(item_wallet)
        db.flush()

        claim_wallet = Claim(
            found_report_id=rep_wallet_ret.id,
            claimant_student_id=stu_marcus.id,
            claim_description="This is my Fossil wallet dropped during lunch on Tuesday.",
            private_ownership_evidence="Contains Marcus Wright student card #STU-5004 and bus pass.",
            status=ClaimStatus.APPROVED,
            reviewed_by_teacher_id=tch_jenkins.id,
            review_notes="Verified student ID matches claimant Marcus Wright.",
            created_at=datetime.utcnow() - timedelta(days=5, hours=-2),
            reviewed_at=datetime.utcnow() - timedelta(days=4),
            approved_at=datetime.utcnow() - timedelta(days=4)
        )
        db.add(claim_wallet)
        db.flush()

        return_rec = ReturnRecord(
            report_id=rep_wallet_ret.id,
            item_id=item_wallet.id,
            claim_id=claim_wallet.id,
            released_by_teacher_id=tch_jenkins.id,
            collected_by_student_id=stu_marcus.id,
            verification_method=VerificationMethod.STUDENT_ID_CARD,
            returned_at=datetime.utcnow() - timedelta(days=4),
            notes="Marcus Wright presented institutional badge and verified contents in person at Staff Office."
        )
        db.add(return_rec)

        # Audit logs for seed activity
        audit_events = [
            AuditLog(
                actor_user_id=tch_jenkins.id,
                action="HANDOVER_CONFIRMED",
                entity_type="REPORT",
                entity_id=str(rep_mac_found.id),
                change_metadata={"report_number": rep_mac_found.report_number, "custodian": "Prof. Sarah Jenkins"},
                timestamp=datetime.utcnow() - timedelta(days=2)
            ),
            AuditLog(
                actor_user_id=stu_alex.id,
                action="CLAIM_SUBMITTED",
                entity_type="CLAIM",
                entity_id=str(claim_mac.id),
                change_metadata={"found_report_number": rep_mac_found.report_number, "claimant_id": "STU-5001"},
                timestamp=datetime.utcnow() - timedelta(days=1)
            ),
            AuditLog(
                actor_user_id=tch_jenkins.id,
                action="ITEM_RETURNED",
                entity_type="RETURN_RECORD",
                entity_id=str(return_rec.id),
                change_metadata={"report_number": rep_wallet_ret.report_number, "collector": "Marcus Wright"},
                timestamp=datetime.utcnow() - timedelta(days=4)
            )
        ]
        db.add_all(audit_events)

        # Notifications
        notifs = [
            Notification(
                user_id=stu_alex.id,
                title="Potential Match Found!",
                message=f"A found Apple laptop matches your lost report #{rep_mac_lost.report_number} with {round(comp_score*100)}% similarity score.",
                notification_type="MATCH_FOUND",
                link_url=f"/reports/{rep_mac_lost.id}?tab=matches",
                is_read=False,
                created_at=datetime.utcnow() - timedelta(days=2)
            ),
            Notification(
                user_id=tch_jenkins.id,
                title="New Ownership Claim Received",
                message=f"Alex Miller has submitted a claim on found item #{rep_mac_found.report_number}.",
                notification_type="CLAIM_SUBMITTED",
                link_url=f"/teacher/claims/{claim_mac.id}",
                is_read=False,
                created_at=datetime.utcnow() - timedelta(days=1)
            ),
            Notification(
                user_id=stu_marcus.id,
                title="Item Return Confirmed",
                message=f"Handover of item #{rep_wallet_ret.report_number} (Fossil Wallet) has been completed with Prof. Sarah Jenkins.",
                notification_type="ITEM_RETURNED",
                link_url=f"/reports/{rep_wallet_ret.id}",
                is_read=True,
                created_at=datetime.utcnow() - timedelta(days=4)
            )
        ]
        db.add_all(notifs)

        db.commit()
        print("Database successfully seeded with realistic campus data!")
        print(f"-> AI Match Score between Lost and Found MacBooks: {round(comp_score*100, 1)}% ({explanation['summary']})")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
