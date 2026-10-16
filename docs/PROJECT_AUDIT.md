# CampusTrace Project Audit & Baseline Report

**Date**: October 16, 2026  
**Auditor**: Senior Full-Stack Engineer & Mobile UX Architect  
**Project**: CampusTrace — AI-Powered Campus Lost & Found Management Platform  

---

## 1. Executive Summary & Baseline State

CampusTrace is an existing, substantially implemented multi-tenant campus lost-and-found system with Computer Vision feature extraction (512-dimensional HSV color histograms, spatial pyramids, and Sobel gradient descriptors + MobileNetV2 ONNX classification) and an auditable Chain of Custody pipeline.

The repository consists of:
- **Backend**: FastAPI (Python 3.14), SQLAlchemy 2.0 ORM, SQLite database (`campustrace.db`), Argon2 password hashing, PyJWT tokens, and OpenCV + ONNX vision matching.
- **Frontend**: Vite 8, React 19, TypeScript, Tailwind CSS v4, Lucide React icons, and React Router v7.

### Baseline Health Check Results
- **Automated Backend Tests**: `pytest` passes 10/10 test cases in 2.99s.
- **Frontend Production Build**: `tsc -b && vite build` succeeds cleanly in < 1 second.
- **Linter Output**: `oxlint` reports 0 errors and 139 warnings (primarily unused imports, React Compiler variable initialization order in `ProfilePage.tsx`, and state updates during effect initialization).
- **Existing User Data**: Preserved in `backend/campustrace.db` (14 registered users, 68 VTU-affiliated colleges, 7 active campus reports, 6 computed AI matches, and 3 ownership claims).

---

## 2. Current Architecture

```
Mini-Project/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints (auth, reports, matches, claims, custody, returns, etc.)
│   │   ├── models/          # SQLAlchemy ORM models (User, Report, Item, Match, Claim, CustodyRecord, etc.)
│   │   ├── models_storage/  # ONNX models (MobileNetV2, YOLOv5) & ImageNet mappings
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Vision extractor, matching engine, auth, audit, storage, classifier
│   │   ├── config.py        # Settings via pydantic-settings
│   │   ├── database.py      # SQLAlchemy session & SQLite engine
│   │   └── main.py          # FastAPI application factory & router mounting
│   ├── tests/               # Pytest suite (test_api.py)
│   ├── uploads/             # Static storage for item photographs
│   ├── campustrace.db       # Active SQLite database
│   └── seed.py              # Sample institutional data seeder
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── camera/      # CameraReportFlow.tsx (live camera preview, shutter, AI preview)
    │   │   ├── common/      # StatusBadge.tsx
    │   │   └── layout/      # BottomNav.tsx, DesktopNavbar.tsx, MobileHeader.tsx, NotificationDropdown.tsx
    │   ├── context/         # AuthContext.tsx, ThemeContext.tsx, ReportFlowContext.tsx
    │   ├── pages/           # HomeScreen, ListingsPage, MyReportsPage, ReportDetailPage,
    │   │                    # MatchesPage, ClaimsPage, CustodyPage, AdminPage, LoginPage, CreateReportPage
    │   ├── services/        # api.ts (fetch client with JWT interceptor)
    │   └── types/           # TypeScript interfaces
```

---

## 3. Existing Feature & Workflow Inventory

| Workflow | Target Persona | Backend Endpoint | Status | Findings / Assessment |
|---|---|---|---|---|
| **Sign In / Sign Out** | All | `POST /api/auth/login`, `POST /api/auth/logout` | **Verified** | Working with JWT tokens, session persistence, role switching for demos. |
| **Student Registration** | Student | `POST /api/auth/register`, `GET /api/colleges` | **Verified** | Verified with VTU institutional codes (e.g., 1RV, 1MS) and USN validation. |
| **Mobile Camera-to-Report** | Student / All | `POST /api/reports/analyze-image`, `POST /api/reports`, `POST /api/reports/{id}/images` | **Working, Needs Refinement** | Live camera preview works via `CameraReportFlow`; extracts colors and pre-fills categories. Disconnected from direct `/report/lost` routes. |
| **Direct Form Report Submission** | All | `POST /api/reports` | **Working, Redundant** | `CreateReportPage.tsx` duplicates `CameraReportFlow` fields without live camera or AI auto-detection. |
| **Campus Item Directory** | All | `GET /api/reports` | **Verified** | Supports keyword search, category, location, and type filters with pagination. |
| **AI Multimodal Matching** | Student / Teacher | `GET /api/reports/{id}/matches`, `GET /api/matches` | **Verified** | Computes composite score: 60% cosine visual similarity + 40% metadata (category, color, date, location). |
| **Ownership Claim Filing** | Student | `POST /api/found-reports/{id}/claims` | **Verified** | Encrypts/safeguards private evidence; transitions status to `CLAIM_PENDING`. |
| **Claim Review (Approve/Reject)** | Teacher | `POST /api/claims/{id}/review` | **Verified** | Teacher reviews evidence and adds remarks; triggers student notification. |
| **Physical Handover Intake** | Teacher | `POST /api/reports/{id}/handover` | **Verified** | Confirms physical receipt from student finder; assigns campus storage vault. |
| **Custody Transfer** | Teacher | `POST /api/reports/{id}/custody-transfers` | **Verified** | Transfers vault custody between staff with timestamped audit trail. |
| **In-Person Return Release** | Teacher | `POST /api/reports/{id}/return` | **Working, UX Flaw** | Verifies student collector identity; requires manual typing of Claim ID in modal instead of dropdown selection. |
| **In-App Notifications** | All | `GET /api/notifications`, `PATCH /api/notifications/{id}/read` | **Partially Broken** | Backend generates dead links (`/teacher/claims/...`, `/teacher/reports/...`) that 404 in frontend. |
| **Admin Portal** | Admin | `GET /api/admin/analytics`, `GET /api/admin/audit-logs`, `GET /api/admin/model-health` | **Working, Guard Missing** | Working metrics and audit logs; lacks frontend route guard preventing student access. |
| **Profile & Settings** | All | `GET /api/auth/me`, `PATCH /api/users/me/profile` | **Working, Lint Warnings** | Allows profile edits, bio, privacy toggle; has variable initialization order warnings. |

---

## 4. Identified Defects, Bugs & Technical Debt

### Functional Defects
1. **Broken Notification Links (Dead Routes)**:
   - `backend/app/api/claims.py:79`: Notification sends `link_url=f"/teacher/claims/{claim.id}"`.
   - `backend/app/api/custody.py:173`: Notification sends `link_url=f"/teacher/reports/{report.id}"`.
   - `backend/app/services/matching_engine.py:243`: Notification sends `link_url=f"/teacher/reports/{found_rep.id}"`.
   - *Impact*: In frontend `App.tsx`, these routes do not exist. Clicking in the notification dropdown results in 404/redirect to Home.
2. **Missing Role-Based Route Protection in Frontend**:
   - `App.tsx` only checks `if (!user) return <Navigate to="/login" />` in `ProtectedLayout`.
   - Routes `/admin` and `/custody` are reachable by students directly via URL, resulting in 403 network failures and broken UI.
3. **Manual Claim ID Input in Return Modal (`ReportDetailPage.tsx`)**:
   - In `ReportDetailPage.tsx:575-582`, modal requires the teacher to type a raw integer `returnClaimId`.
   - *Impact*: Teachers do not know raw database IDs; the modal must provide a selectable dropdown of approved claims for that report, or pre-populate from navigation query params.
4. **Silent Exception Swallowing in Report Image Upload**:
   - In `backend/app/api/reports.py:453-456`:
     ```python
     try:
         matching_engine.find_and_save_matches_for_report(db, report)
     except Exception:
         pass
     ```
     *Impact*: Any failure in feature extraction or matching is silently suppressed without logging.
5. **Pydantic V2 & Datetime Deprecations**:
   - Schemas use deprecated class-based `class Config: from_attributes = True` instead of `model_config = ConfigDict(from_attributes=True)`.
   - Deprecated `datetime.utcnow()` used across services, causing 75 warnings during test runs.

---

## 5. Duplicate, Redundant, & Conflicting UI Actions

1. **Competing Report Creation Paths**:
   - **Path A**: `CameraReportFlow` modal (opened via elevated mobile camera button in `BottomNav` and desktop navbar "Report Lost" / "Report Found" buttons). Offers live viewfinder, image cropping, MobileNetV2 AI auto-tagging, and 512-dim embedding.
   - **Path B**: `CreateReportPage` (`/report/lost`, `/report/found`) linked from `ListingsPage.tsx` and `DashboardPage.tsx`. Lacks live camera, AI pre-fill, or feature visualization.
   - *Resolution*: Unify reporting onto the camera-first flow. In `ListingsPage.tsx`, replace direct links to `/report/lost` with triggers for `openReportFlow('LOST')` and `openReportFlow('FOUND')`. Direct `/report/lost` and `/report/found` routes should render the camera flow or redirect smoothly into it.
2. **Orphaned / Dead Components**:
   - `frontend/src/pages/DashboardPage.tsx`: Contains role-specific dashboards (urgent intake queue for teachers, recovery analytics for admins), but was replaced entirely by `HomeScreen.tsx` and never imported in `App.tsx`.
   - `frontend/src/components/layout/Navbar.tsx`: Outdated header, duplicated by `DesktopNavbar.tsx`.
   - `frontend/src/components/layout/Sidebar.tsx`: Legacy desktop sidebar, never rendered.
   - *Resolution*: Safely clean up dead layout components (`Navbar.tsx`, `Sidebar.tsx`) and integrate teacher/admin role-specific dashboard capabilities into `HomeScreen.tsx` so staff immediately see urgent intake queues without losing student mobile camera features.
3. **Repeated Action Buttons in Report Detail**:
   - On `ReportDetailPage.tsx`, redundant claim and custody action triggers existed in both the sticky header bar and inline tabs.
   - *Resolution*: Provide one definitive contextual primary action per user role in the header card.

---

## 6. Mobile Usability Issues

1. **Bottom Nav and Keyboard Overlap**:
   - Fixed `BottomNav` (z-40) covers form controls and submit buttons on mobile viewports when forms scroll to the bottom.
   - *Fix*: Ensure main scroll container includes consistent `pb-24` padding and modals utilize `fixed inset-0 z-50` with internal scrolling (`overflow-y-auto max-h-[90vh]`) and `safe-area-inset` protection.
2. **Horizontal Overflow on Mobile Filters**:
   - In `ListingsPage.tsx`, segmented filter buttons wrap awkwardly on narrow mobile screens (320px–375px).
   - In `MatchesPage.tsx`, sliders and dropdowns cause horizontal wrapping.
   - *Fix*: Use horizontal scrollable pills (`overflow-x-auto scrollbar-none`) with touch targets >= 44px.
3. **Camera Viewfinder Fallback on Desktop / Unsupported Browsers**:
   - When webcam permissions are denied or unavailable, `CameraReportFlow` displays a gallery fallback, but the desktop experience needs a smooth drag-and-drop file target.
4. **Touch Target Sizing**:
   - Some secondary action links (e.g., "Inspect ->", "View Details", pagination chevrons) had tap targets under 36px, making one-handed mobile tapping difficult.

---

## 7. Security and Data-Integrity Review

1. **Multi-Tenant College Isolation**:
   - Verified that `test_multi_tenant_isolation_and_idor_prevention` ensures reports, claims, and storage locations from RVCE (`1RV`) are inaccessible to users from MSRIT (`1MS`).
2. **Confidential Ownership Evidence**:
   - `private_ownership_evidence` on `Claim` records is restricted: only authorized faculty/admin members or the claiming student can read it. Students browsing found items never see other students' submitted evidence.
3. **Role Elevation Prevention**:
   - Only `TEACHER` and `ADMIN` can confirm physical intake, execute returns, or approve claims. Students cannot approve their own claims.
4. **Idempotency & Duplicate Submission**:
   - Submit buttons in `CameraReportFlow`, `ReportDetailPage`, and `ClaimsPage` need explicit disabled/loading states to prevent double-click duplicate records.

---

## 8. Recommended Changes & Priority Order

1. **Phase 2 — Critical Functionality & Routing**:
   - Fix broken notification URLs in backend (`/teacher/claims/...` -> `/claims`, `/teacher/reports/...` -> `/reports/{id}`).
   - Add role-aware route guards in frontend `App.tsx` for `/admin` and `/custody`.
   - Fix manual claim ID typing in `ReportDetailPage.tsx` by providing a dropdown of approved claims for the item.
   - Fix Pydantic V2 schema deprecations and datetime UTC warnings.
   - Add proper error logging to image matching exception blocks.
2. **Phase 3 — Duplicate Action & Code Cleanup**:
   - Unify all report entry points across `ListingsPage`, `HomeScreen`, `DesktopNavbar`, and `BottomNav` onto `ReportFlowContext`.
   - Remove dead layout files (`Navbar.tsx`, `Sidebar.tsx`).
   - Fix 139 linter warnings in `ProfilePage.tsx` and other components (unused imports, effect lifecycle).
3. **Phase 4 — Mobile-First UX Refinement**:
   - Optimize responsive layouts, scroll padding, safe area margins, and touch targets across 320px, 375px, 390px, and 430px viewports.
   - Ensure modals fit mobile screens with virtual keyboards.
4. **Phase 5 — Camera-to-Report Experience**:
   - Polish `CameraReportFlow.tsx` live viewfinder, rear-camera preference (`facingMode: 'environment'`), gallery upload fallback, and instant AI visual analysis.
   - Integrate drag-and-drop for desktop users.
5. **Phase 6 — Role-Aware Dashboard & Lifecycle**:
   - Make `HomeScreen.tsx` adapt intelligently to user role: students see loss report status and matches; teachers see urgent physical intake queue and pending claims; admins see recovery rate and model health.
6. **Phase 7 — Verification & Quality Assurance**:
   - Execute full test suite, linting, build checks, and verify report-to-return workflow.
