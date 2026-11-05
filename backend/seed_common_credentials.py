import sys
from pathlib import Path

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.college import College
from app.services.auth_service import hash_password

def seed_common_accounts():
    """
    Seeds common demo accounts from README and institutional defaults
    without wiping or modifying existing registered user accounts.
    """
    db = SessionLocal()
    try:
        kssem = db.query(College).filter(College.college_code == "1KG").first()
        rvce = db.query(College).filter(College.college_code == "1RV").first()
        default_college_id = kssem.id if kssem else (rvce.id if rvce else 1)

        common_users = [
            # README Demo Student
            {
                "institutional_id": "STU-5001",
                "student_id_usn": "STU-5001",
                "full_name": "Alex Miller",
                "email": "alex.miller@campus.edu",
                "password": "Student@123",
                "role": UserRole.STUDENT,
                "department": "School of Computing",
                "college_id": default_college_id
            },
            # README Demo Faculty Custodian
            {
                "institutional_id": "TCH-101",
                "full_name": "Prof. Sarah Jenkins",
                "email": "sarah.jenkins@campus.edu",
                "password": "Teacher@123",
                "role": UserRole.TEACHER,
                "department": "Computer Science & Engineering",
                "college_id": default_college_id
            },
            # README Demo Faculty Custodian 2
            {
                "institutional_id": "TCH-102",
                "full_name": "Dr. Robert Chen",
                "email": "robert.chen@campus.edu",
                "password": "Teacher@123",
                "role": UserRole.TEACHER,
                "department": "Department of Chemistry",
                "college_id": default_college_id
            },
            # README Demo Campus Admin
            {
                "institutional_id": "ADM-001",
                "full_name": "Dr. Eleanor Vance",
                "email": "admin@campus.edu",
                "password": "Admin@123",
                "role": UserRole.ADMIN,
                "department": "Campus Operations & Safety",
                "college_id": default_college_id
            },
            # KSSEM Institutional Student Demo
            {
                "institutional_id": "1KG24CS001",
                "student_id_usn": "1KG24CS001",
                "full_name": "KSSEM Demo Student",
                "email": "student@kssem.edu.in",
                "password": "Student@123",
                "role": UserRole.STUDENT,
                "department": "Computer Science & Engineering",
                "college_id": kssem.id if kssem else default_college_id
            },
            # KSSEM Institutional Faculty Custodian
            {
                "institutional_id": "STAFF-KSSEM-01",
                "full_name": "Prof. B. K. Manjunath",
                "email": "staff.custodian@kssem.edu.in",
                "password": "Teacher@123",
                "role": UserRole.TEACHER,
                "department": "Department of Student Affairs & Security",
                "college_id": kssem.id if kssem else default_college_id
            },
            # KSSEM Institutional Admin
            {
                "institutional_id": "ADMIN-KSSEM-01",
                "full_name": "Dr. K. Rama Narasimha",
                "email": "admin@kssem.edu.in",
                "password": "Admin@123",
                "role": UserRole.COLLEGE_ADMIN,
                "department": "Principal & Head of Institution",
                "college_id": kssem.id if kssem else default_college_id
            },
            # RVCE Institutional Admin
            {
                "institutional_id": "ADM-RVCE-001",
                "full_name": "RVCE Campus Administrator",
                "email": "admin@rvce.edu.in",
                "password": "RVCEAdmin@2026",
                "role": UserRole.COLLEGE_ADMIN,
                "department": "Administrative Office",
                "college_id": rvce.id if rvce else default_college_id
            }
        ]

        added_count = 0
        for udata in common_users:
            existing = db.query(User).filter(
                (User.email == udata["email"]) | (User.institutional_id == udata["institutional_id"])
            ).first()

            if not existing:
                user = User(
                    institutional_id=udata["institutional_id"],
                    student_id_usn=udata.get("student_id_usn"),
                    full_name=udata["full_name"],
                    email=udata["email"],
                    password_hash=hash_password(udata["password"]),
                    role=udata["role"],
                    department=udata.get("department"),
                    college_id=udata.get("college_id"),
                    is_active=True
                )
                db.add(user)
                added_count += 1

        db.commit()
        total_users = db.query(User).count()
        print(f"Added {added_count} common demo accounts. Total users in DB: {total_users}")

    except Exception as e:
        db.rollback()
        print(f"Error provisioning common accounts: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_common_accounts()
