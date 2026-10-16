import uuid
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.services.vision_extractor import vision_extractor

client = TestClient(app)

RUN_ID = uuid.uuid4().hex[:6]
STUDENT_A_EMAIL = f"ananya_{RUN_ID}@apex.edu"
STUDENT_A_USN = f"1AP21CS_{RUN_ID}"
STUDENT_B_EMAIL = f"vikram_{RUN_ID}@metro.edu"
STUDENT_B_USN = f"MET_{RUN_ID}"

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"

def test_get_colleges_list():
    response = client.get("/api/colleges")
    assert response.status_code == 200
    colleges = response.json()
    assert len(colleges) >= 10
    codes = [c["college_code"] for c in colleges]
    assert "1RV" in codes
    assert "1MS" in codes

def test_verify_college_code():
    res_valid = client.get("/api/colleges/verify/1RV")
    assert res_valid.status_code == 200
    assert res_valid.json()["is_valid"] is True

    res_invalid = client.get("/api/colleges/verify/NON-EXISTENT-XYZ")
    assert res_invalid.status_code == 404

def test_student_registration_and_login():
    # 1. Registration fails with invalid college code
    bad_reg = client.post("/api/auth/register", json={
        "email": f"invalid_{RUN_ID}@invalid.edu",
        "password": "Password@123",
        "full_name": "Test Student",
        "college_code": "INVALID-CODE",
        "student_id_usn": f"BAD-{RUN_ID}"
    })
    assert bad_reg.status_code == 400
    assert "Invalid College ID" in bad_reg.json()["detail"]

    # 2. Registration succeeds with valid VTU college code (1RV - RVCE)
    good_reg = client.post("/api/auth/register", json={
        "email": STUDENT_A_EMAIL,
        "password": "SecureStudent@2026",
        "full_name": "Ananya Sharma",
        "college_code": "1RV",
        "student_id_usn": STUDENT_A_USN,
        "department": "Computer Science & Engineering",
        "phone_number": "+91 99887 76655",
        "year_of_study": 3,
        "semester": 6
    })
    assert good_reg.status_code in (200, 201)
    user_data = good_reg.json()
    assert user_data["email"] == STUDENT_A_EMAIL
    assert user_data["student_id_usn"] == STUDENT_A_USN
    assert user_data["college_code"] == "1RV"

    # 3. Login with newly created student credentials
    login_resp = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "SecureStudent@2026"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["role"] == "STUDENT"
    assert token_data["college_code"] == "1RV"

    # 4. Check /api/auth/me returns full profile with college
    token = token_data["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["full_name"] == "Ananya Sharma"
    assert me_data["college"]["college_code"] == "1RV"

def test_student_profile_update():
    # Login as student Ananya
    login_resp = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "SecureStudent@2026"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update profile fields
    update_resp = client.patch("/api/users/me/profile", json={
        "bio": "CS Major, 3rd Year. Building web apps and AI systems.",
        "phone_number": "+91 98765 43210",
        "privacy_hide_contact": True
    }, headers=headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["bio"] == "CS Major, 3rd Year. Building web apps and AI systems."
    assert updated_data["privacy_hide_contact"] is True

def test_forgot_and_reset_password_flow():
    # 1. Request password reset
    forgot_resp = client.post("/api/auth/forgot-password", json={
        "email": STUDENT_A_EMAIL
    })
    assert forgot_resp.status_code == 200
    reset_token = forgot_resp.json()["reset_token"]
    assert reset_token is not None

    # 2. Reset password with token
    reset_resp = client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewSecretPassword@2026"
    })
    assert reset_resp.status_code == 200
    assert reset_resp.json()["success"] is True

    # 3. Old password fails
    old_login = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "SecureStudent@2026"
    })
    assert old_login.status_code == 401

    # 4. New password succeeds
    new_login = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "NewSecretPassword@2026"
    })
    assert new_login.status_code == 200

def test_multi_tenant_isolation_and_idor_prevention():
    """
    Critical multi-tenant test:
    - Student A in RVCE (1RV) registers and reports a lost item.
    - Student B in MSRIT (1MS) registers and queries listings.
    - Student B must NOT see Student A's report.
    - Student B attempting direct IDOR access or claim gets 403 Forbidden.
    """
    # 1. Register Student B in MSRIT (1MS)
    reg_b = client.post("/api/auth/register", json={
        "email": STUDENT_B_EMAIL,
        "password": "MetroStudent@2026",
        "full_name": "Vikram Singh",
        "college_code": "1MS",
        "student_id_usn": STUDENT_B_USN
    })
    assert reg_b.status_code in (200, 201)

    # 2. Login Student A (RVCE)
    login_a = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "NewSecretPassword@2026"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Login Student B (MSRIT)
    login_b = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_B_EMAIL,
        "password": "MetroStudent@2026"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Student A reports a lost item at RVCE
    cat_id = client.get("/api/categories").json()[0]["id"]
    loc_id = client.get("/api/campus-locations", headers=headers_a).json()[0]["id"]

    rep_a_resp = client.post("/api/reports", json={
        "report_type": "LOST",
        "item_name": "Silver MacBook Pro 14",
        "category_id": cat_id,
        "location_id": loc_id,
        "report_date": str(date.today()),
        "approximate_event_time": "14:30",
        "detailed_description": "M2 Pro Space Gray with stickers, lost in Central Library.",
        "color": "Space Gray",
        "brand": "Apple"
    }, headers=headers_a)
    assert rep_a_resp.status_code == 200
    report_a_id = rep_a_resp.json()["id"]

    # 4. Student B queries reports -> Should see 0 reports (tenant isolated!)
    reports_b = client.get("/api/reports", headers=headers_b).json()
    assert reports_b["total"] == 0
    assert len(reports_b["items"]) == 0

    # 5. Student B attempts IDOR to fetch report_a directly -> 403 Forbidden!
    idor_detail = client.get(f"/api/reports/{report_a_id}", headers=headers_b)
    assert idor_detail.status_code == 403
    assert "belongs to another institution" in idor_detail.json()["detail"]

    # 6. Student B attempts IDOR to update report_a -> 403 Forbidden!
    idor_update = client.patch(f"/api/reports/{report_a_id}", json={
        "detailed_description": "Tampered description"
    }, headers=headers_b)
    assert idor_update.status_code == 403

def test_admin_tenant_analytics():
    # RVCE College Admin Login
    admin_login = client.post("/api/auth/login", json={
        "username_or_email": "admin@rvce.edu.in",
        "password": "RVCEAdmin@2026"
    })
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Analytics for RVCE
    analytics_resp = client.get("/api/admin/analytics", headers=headers)
    assert analytics_resp.status_code == 200
    data = analytics_resp.json()
    assert data["total_lost_reports"] >= 1  # Student A's lost report is counted for RVCE
    assert data["total_students"] >= 1      # Student A is counted for RVCE

def test_vision_cosine_similarity():
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    vec_c = [0.0, 1.0, 0.0]
    
    assert vision_extractor.cosine_similarity(vec_a, vec_b) == 1.0
    assert vision_extractor.cosine_similarity(vec_a, vec_c) == 0.0
    assert vision_extractor.cosine_similarity([], []) == 0.0

def test_claims_workflow_and_cross_college_isolation():
    # 1. Login Student A (RVCE)
    login_a = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "NewSecretPassword@2026"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Login Student B (MSRIT)
    login_b = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_B_EMAIL,
        "password": "MetroStudent@2026"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Staff in RVCE creates a FOUND report
    cat_id = client.get("/api/categories").json()[0]["id"]
    loc_id = client.get("/api/campus-locations", headers=headers_a).json()[0]["id"]

    found_resp = client.post("/api/reports", json={
        "report_type": "FOUND",
        "item_name": "Hydro Flask Water Bottle",
        "category_id": cat_id,
        "location_id": loc_id,
        "report_date": str(date.today()),
        "approximate_event_time": "11:00",
        "detailed_description": "Olive green 32oz insulated bottle found in cafeteria.",
        "color": "Olive Green",
        "brand": "Hydro Flask"
    }, headers=headers_a)
    assert found_resp.status_code == 200
    found_id = found_resp.json()["id"]

    # 4. Student B (Metro Univ) tries to claim the item in Apex Tech -> 403 Forbidden!
    b_claim = client.post(f"/api/found-reports/{found_id}/claims", json={
        "claim_description": "This is my bottle",
        "private_ownership_evidence": "It has a dent on the bottom"
    }, headers=headers_b)
    assert b_claim.status_code == 403
    assert "another institution" in b_claim.json()["detail"].lower()

    # 5. Student A (Apex Tech) submits a claim -> 200 OK
    a_claim = client.post(f"/api/found-reports/{found_id}/claims", json={
        "claim_description": "I forgot this bottle during lunch",
        "private_ownership_evidence": "There is a national parks sticker on the reverse side."
    }, headers=headers_a)
    assert a_claim.status_code == 200
    claim_id = a_claim.json()["id"]

    # 6. Verify notifications endpoint returns the notification
    notes_resp = client.get("/api/notifications", headers=headers_a)
    assert notes_resp.status_code == 200
    notes = notes_resp.json()
    assert len(notes) >= 1

    # 7. Search reports by query
    search_resp = client.get("/api/reports?search=Hydro", headers=headers_a)
    assert search_resp.status_code == 200
    assert search_resp.json()["total"] >= 1
    assert any("Hydro" in (it["item"]["item_name"] if it.get("item") else "") for it in search_resp.json()["items"])

    # 8. Empty search results
    empty_search = client.get("/api/reports?search=NonExistentQuantumItem9999", headers=headers_a)
    assert empty_search.status_code == 200
    assert empty_search.json()["total"] == 0
    assert len(empty_search.json()["items"]) == 0

def test_claims_filtering_and_return_verification_flow():
    # 1. Login Student A (RVCE)
    login_a = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "NewSecretPassword@2026"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Get categories and locations
    cats = client.get("/api/categories").json()
    cat_id = cats[0]["id"]
    locs = client.get("/api/campus-locations", headers=headers_a).json()
    loc_id = locs[0]["id"]

    # 3. Create a found report
    found_resp = client.post("/api/reports", json={
        "report_type": "FOUND",
        "item_name": "Titan Chronograph Watch",
        "category_id": cat_id,
        "location_id": loc_id,
        "report_date": str(date.today()),
        "approximate_event_time": "14:30",
        "detailed_description": "Found on 2nd floor desk in Admin Block",
        "color": "Silver",
        "brand": "Titan"
    }, headers=headers_a)
    assert found_resp.status_code == 200
    found_id = found_resp.json()["id"]

    # 4. Student A files claim
    claim_resp = client.post(f"/api/found-reports/{found_id}/claims", json={
        "claim_description": "My Titan watch left during meeting",
        "private_ownership_evidence": "Engraved initial A on the clasp"
    }, headers=headers_a)
    assert claim_resp.status_code == 200
    claim_id = claim_resp.json()["id"]

    # 5. Filter claims by report_id
    filtered_claims = client.get(f"/api/claims?report_id={found_id}", headers=headers_a)
    assert filtered_claims.status_code == 200
    claims_data = filtered_claims.json()
    assert len(claims_data) >= 1
    assert all(c["found_report_id"] == found_id for c in claims_data)

    # 6. Verify notification link targets
    notifs = client.get("/api/notifications", headers=headers_a).json()
    for n in notifs:
        if n.get("action_link"):
            # Notifications must not use legacy dead prefixes
            assert not n["action_link"].startswith("/teacher/claims/")
            assert not n["action_link"].startswith("/teacher/reports/")


def test_ai_detection_and_matching_accuracy():
    from app.services.matching_engine import matching_engine
    from app.models.report import Report, ReportType, ReportStatus
    from app.models.item import Item

    # Create mockup lost and found reports
    lost_rep = Report(
        id=9001,
        report_number="TEST-L-01",
        report_type=ReportType.LOST,
        status=ReportStatus.OPEN,
        detailed_description="Silver MacBook Pro 14 inch laptop left in library",
        location_id=1,
        report_date=date.today(),
        college_id=1
    )
    lost_item = Item(
        id=9001,
        item_name="Silver MacBook Pro 14",
        category_id=1,
        brand="Apple",
        color="Silver"
    )
    lost_rep.item = lost_item
    lost_rep.images = []

    # 1. Totally different item in same category & location (e.g. Titan Watch)
    unrelated_found_rep = Report(
        id=9002,
        report_number="TEST-F-01",
        report_type=ReportType.FOUND,
        status=ReportStatus.OPEN,
        detailed_description="Titan Chronograph Watch found on desk",
        location_id=1,
        report_date=date.today(),
        college_id=1
    )
    unrelated_item = Item(
        id=9002,
        item_name="Titan Chronograph Watch",
        category_id=1,
        brand="Titan",
        color="Silver"
    )
    unrelated_found_rep.item = unrelated_item
    unrelated_found_rep.images = []

    score, vis, meta, expl = matching_engine.compute_match_score(lost_rep, unrelated_found_rep)
    # Different items with conflicting brands must NOT match! Score must be well below threshold (e.g. < 0.50)
    assert score < 0.50, f"Unrelated items should not match, got {score}"
    assert expl["text_score"] <= 0.10

    # 2. Genuinely matching item (MacBook Pro Laptop)
    similar_found_rep = Report(
        id=9003,
        report_number="TEST-F-02",
        report_type=ReportType.FOUND,
        status=ReportStatus.OPEN,
        detailed_description="Apple MacBook Pro laptop 14 inch found in reading room",
        location_id=1,
        report_date=date.today(),
        college_id=1
    )
    similar_item = Item(
        id=9003,
        item_name="MacBook Pro Laptop 14-inch",
        category_id=1,
        brand="Apple",
        color="Silver"
    )
    similar_found_rep.item = similar_item
    similar_found_rep.images = []

    score_match, vis_match, meta_match, expl_match = matching_engine.compute_match_score(lost_rep, similar_found_rep)
    assert score_match >= 0.70, f"Matching items should score high, got {score_match}"
    assert expl_match["category_match"] is True
    assert "Apple" in expl_match["summary"] or "MacBook" in expl_match["summary"]


def test_report_closure_and_reopen_workflow():
    # 1. Login as Student A (RVCE)
    login_a = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_A_EMAIL,
        "password": "NewSecretPassword@2026"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Login as Student B (different user, MET)
    login_b = client.post("/api/auth/login", json={
        "username_or_email": STUDENT_B_EMAIL,
        "password": "MetroStudent@2026"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    cats = client.get("/api/categories").json()
    locs = client.get("/api/campus-locations", headers=headers_a).json()

    # 3. Student A creates a lost report
    lost_resp = client.post("/api/reports", json={
        "report_type": "LOST",
        "item_name": f"Blue Water Bottle {RUN_ID}",
        "category_id": cats[0]["id"],
        "location_id": locs[0]["id"],
        "report_date": str(date.today()),
        "detailed_description": "Left in room 204 after class",
        "color": "Blue"
    }, headers=headers_a)
    assert lost_resp.status_code == 200
    report_id = lost_resp.json()["id"]

    # 4. Unauthorized student B tries to close Student A's report -> 403 Forbidden
    unauth_close = client.post(f"/api/reports/{report_id}/close", json={
        "reason": "Duplicate report",
        "notes": "Hacking attempt"
    }, headers=headers_b)
    assert unauth_close.status_code == 403

    # 5. Student A closes own report
    close_resp = client.post(f"/api/reports/{report_id}/close", json={
        "reason": "Item found elsewhere",
        "notes": "Found in my hostel room backpack"
    }, headers=headers_a)
    assert close_resp.status_code == 200
    closed_data = close_resp.json()
    assert closed_data["status"] == "CLOSED"
    assert closed_data["resolved_at"] is not None
    assert closed_data["resolution_type"] == "Item found elsewhere"
    assert closed_data["resolution_notes"] == "Found in my hostel room backpack"

    # 6. Cannot close an already closed report
    double_close = client.post(f"/api/reports/{report_id}/close", json={
        "reason": "No longer needed"
    }, headers=headers_a)
    assert double_close.status_code == 400

    # 7. Closed report has no active matches returned
    matches_resp = client.get(f"/api/reports/{report_id}/matches", headers=headers_a)
    assert matches_resp.status_code == 200
    assert matches_resp.json() == []

    # 8. Student A reopens report
    reopen_resp = client.post(f"/api/reports/{report_id}/reopen", headers=headers_a)
    assert reopen_resp.status_code == 200
    reopened_data = reopen_resp.json()
    assert reopened_data["status"] == "OPEN"
    assert reopened_data["resolved_at"] is None
    assert reopened_data["resolution_type"] is None


def test_visual_feature_extraction_and_gating():
    import numpy as np
    import cv2
    from pathlib import Path
    from app.services.matching_engine import matching_engine
    from app.models.report import Report, ReportType, ReportStatus
    from app.models.item import Item, ItemImage

    # Create two synthesized images for rigorous mathematical verification
    img_a = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.circle(img_a, (150, 150), 80, (0, 0, 255), -1) # Red circle on black
    cv2.imwrite("uploads/test_synth_a.jpg", img_a)

    img_b = np.full((300, 300, 3), 200, dtype=np.uint8) # Bright neutral gray/white
    cv2.imwrite("uploads/test_synth_b.jpg", img_b)

    # Rotated/scaled copy of A
    M = cv2.getRotationMatrix2D((150, 150), 10, 0.95)
    img_a_rot = cv2.warpAffine(img_a, M, (300, 300))
    cv2.imwrite("uploads/test_synth_a_rot.jpg", img_a_rot)

    try:
        feat_a = vision_extractor.extract_features(Path("uploads/test_synth_a.jpg"))
        feat_b = vision_extractor.extract_features(Path("uploads/test_synth_b.jpg"))
        feat_a_rot = vision_extractor.extract_features(Path("uploads/test_synth_a_rot.jpg"))

        assert len(feat_a["embedding"]) == 512
        assert len(feat_b["embedding"]) == 512

        # Red circle should be identified in dominant colors
        detected_color_names = [c["name"] for c in feat_a["dominant_colors"]]
        assert "Red" in detected_color_names

        # Identical image similarity
        sim_self = vision_extractor.cosine_similarity(feat_a["embedding"], feat_a["embedding"])
        assert sim_self > 0.999

        # Rotated similar item similarity should remain strong
        sim_rot = vision_extractor.cosine_similarity(feat_a["embedding"], feat_a_rot["embedding"])
        calib_rot = vision_extractor.calibrate_visual_similarity(sim_rot)
        assert calib_rot > 0.65, f"Rotated same item should score high, got calib={calib_rot}"

        # Dissimilar images test
        sim_diff = vision_extractor.cosine_similarity(feat_a["embedding"], feat_b["embedding"])
        calib_diff = vision_extractor.calibrate_visual_similarity(sim_diff)
        assert calib_diff < 0.25, f"Dissimilar images should calibrate low, got {calib_diff}"

        # Visual gating verification:
        rep_a = Report(
            id=9101, report_number="G-L-01", report_type=ReportType.LOST,
            status=ReportStatus.OPEN, detailed_description="Red lock", location_id=1, report_date=date.today()
        )
        rep_a.item = Item(id=9101, item_name="Red Lock", category_id=1, color="Red")
        img_rec_a = ItemImage(id=9101, visual_features=feat_a)
        rep_a.images = [img_rec_a]

        rep_b = Report(
            id=9102, report_number="G-F-01", report_type=ReportType.FOUND,
            status=ReportStatus.OPEN, detailed_description="Red lock", location_id=1, report_date=date.today()
        )
        rep_b.item = Item(id=9102, item_name="Red Lock", category_id=1, color="Red")
        img_rec_b = ItemImage(id=9102, visual_features=feat_b) # Dissimilar image
        rep_b.images = [img_rec_b]

        score, vis, meta, expl = matching_engine.compute_match_score(rep_a, rep_b)
        # Even though metadata matched (category, title, color, location, date),
        # visual gating must force composite score down because images were completely dissimilar!
        assert score <= 0.35, f"Visual gating should clamp score to <= 0.35, got {score}"
        assert "Visual gating: Images appear dissimilar" in expl["summary"]
    finally:
        for p in ["uploads/test_synth_a.jpg", "uploads/test_synth_b.jpg", "uploads/test_synth_a_rot.jpg"]:
            if Path(p).exists():
                Path(p).unlink()



