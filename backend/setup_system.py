import os
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import engine, Base, SessionLocal
from app.models.college import College
from app.models.user import User, UserRole
from app.models.category_location import Category, CampusLocation, StorageLocation
from app.services.auth_service import hash_password
from app.models.audit import AuditLog

VTU_AFFILIATED_COLLEGES = [
    # =========================================================================
    # VTU Region 1: Bengaluru Region (Code Prefix: 1)
    # =========================================================================
    {
        "college_code": "1RV",
        "name": "R.V. College of Engineering (RVCE)",
        "domain": "rvce.edu.in",
        "address": "Mysuru Road, RV Vidyaniketan Post",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@rvce.edu.in"
    },
    {
        "college_code": "1BM",
        "name": "B.M.S. College of Engineering (BMSCE)",
        "domain": "bmsce.ac.in",
        "address": "Bull Temple Road, Basavanagudi",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@bmsce.ac.in"
    },
    {
        "college_code": "1MS",
        "name": "Ramaiah Institute of Technology (MSRIT)",
        "domain": "msrit.edu",
        "address": "MSR Nagar, Mathikere",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@msrit.edu"
    },
    {
        "college_code": "1BI",
        "name": "Bangalore Institute of Technology (BIT)",
        "domain": "bit-bangalore.edu.in",
        "address": "K.R. Road, V.V. Puram",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@bit-bangalore.edu.in"
    },
    {
        "college_code": "1DS",
        "name": "Dayananda Sagar College of Engineering (DSCE)",
        "domain": "dsce.edu.in",
        "address": "Shavige Malleshwara Hills, Kumaraswamy Layout",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@dsce.edu.in"
    },
    {
        "college_code": "1MV",
        "name": "Sir M. Visvesvaraya Institute of Technology (Sir MVIT)",
        "domain": "sirmvit.edu",
        "address": "Krishnadevarayanagar, Hunasamaranahalli, Yelahanka",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@sirmvit.edu"
    },
    {
        "college_code": "1RN",
        "name": "R.N.S. Institute of Technology (RNSIT)",
        "domain": "rnsit.ac.in",
        "address": "Channasandra, Dr. Vishnuvardhan Road, RR Nagar Post",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@rnsit.ac.in"
    },
    {
        "college_code": "1NH",
        "name": "New Horizon College of Engineering (NHCE)",
        "domain": "newhorizonindia.edu",
        "address": "Bellandur Main Road, Outer Ring Road, Near Marathahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@newhorizonindia.edu"
    },
    {
        "college_code": "1BY",
        "name": "B.M.S. Institute of Technology & Management (BMSIT&M)",
        "domain": "bmsit.ac.in",
        "address": "Doddaballapur Main Road, Avalahalli, Yelahanka",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@bmsit.ac.in"
    },
    {
        "college_code": "1NT",
        "name": "Nitte Meenakshi Institute of Technology (NMIT)",
        "domain": "nmit.ac.in",
        "address": "Govindapura, Gollahalli, Yelahanka",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@nmit.ac.in"
    },
    {
        "college_code": "1JS",
        "name": "JSS Academy of Technical Education (JSSATE)",
        "domain": "jssateb.ac.in",
        "address": "JSS Campus, Uttarahalli-Kengeri Main Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@jssateb.ac.in"
    },
    {
        "college_code": "1AY",
        "name": "Acharya Institute of Technology (AIT)",
        "domain": "acharya.ac.in",
        "address": "Acharya Dr. Sarvepalli Radhakrishnan Road, Soladevanahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@acharya.ac.in"
    },
    {
        "college_code": "1CR",
        "name": "CMR Institute of Technology (CMRIT)",
        "domain": "cmrit.ac.in",
        "address": "132 AECS Layout, ITPL Main Road, Kundalahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@cmrit.ac.in"
    },
    {
        "college_code": "1OX",
        "name": "The Oxford College of Engineering (TOCE)",
        "domain": "theoxford.edu",
        "address": "Hosur Road, Bommanahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@theoxford.edu"
    },
    {
        "college_code": "1BG",
        "name": "B.N.M. Institute of Technology (BNMIT)",
        "domain": "bnmit.org",
        "address": "27th Cross, 12th Main, Banashankari 2nd Stage",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@bnmit.org"
    },
    {
        "college_code": "1DA",
        "name": "Dr. Ambedkar Institute of Technology (Dr. AIT)",
        "domain": "drait.edu.in",
        "address": "BDA Outer Ring Road, Mallathahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@drait.edu.in"
    },
    {
        "college_code": "1EW",
        "name": "East West Institute of Technology (EWIT)",
        "domain": "ewit.edu.in",
        "address": "Magadi Main Road, Vishwaneedam Post",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@ewit.edu.in"
    },
    {
        "college_code": "1GA",
        "name": "Global Academy of Technology (GAT)",
        "domain": "gat.ac.in",
        "address": "Ideal Homes Township, Rajarajeshwarinagar",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@gat.ac.in"
    },
    {
        "college_code": "1KS",
        "name": "K.S. Institute of Technology (KSIT)",
        "domain": "ksit.ac.in",
        "address": "Kanakapura Main Road, Raghuvanahalli",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@ksit.ac.in"
    },
    {
        "college_code": "1KG",
        "name": "K.S. School of Engineering and Management (KSSEM)",
        "domain": "kssem.edu.in",
        "address": "#15, Mallasandra, Off Kanakapura Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@kssem.edu.in"
    },
    {
        "college_code": "1MJ",
        "name": "MVJ College of Engineering (MVJCE)",
        "domain": "mvjce.edu.in",
        "address": "Near ITPB, Channasandra, Kadugodi",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@mvjce.edu.in"
    },
    {
        "college_code": "1DT",
        "name": "Dayananda Sagar Academy of Technology & Management (DSATM)",
        "domain": "dsatm.edu.in",
        "address": "Opp. Art of Living, Kanakapura Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@dsatm.edu.in"
    },
    {
        "college_code": "1ST",
        "name": "Sambhram Institute of Technology (SaIT)",
        "domain": "sambhramit.com",
        "address": "M.S. Palya, Via Jalahalli East",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@sambhramit.com"
    },
    {
        "college_code": "1DB",
        "name": "Don Bosco Institute of Technology (DBIT)",
        "domain": "dbit.co.in",
        "address": "Mysore Road, Kumbalagodu",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@dbit.co.in"
    },
    {
        "college_code": "1HK",
        "name": "H.K.B.K. College of Engineering (HKBKCE)",
        "domain": "hkbk.edu.in",
        "address": "Nagawara, Manyata Tech Park Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@hkbk.edu.in"
    },
    {
        "college_code": "1RR",
        "name": "Rajarajeswari College of Engineering (RRCE)",
        "domain": "rrce.org",
        "address": "Mysore Road, Kumbalagodu",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@rrce.org"
    },
    {
        "college_code": "1JB",
        "name": "SJB Institute of Technology (SJBIT)",
        "domain": "sjbit.edu.in",
        "address": "BGS Health & Education City, Kengeri",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@sjbit.edu.in"
    },
    {
        "college_code": "1AT",
        "name": "Atria Institute of Technology",
        "domain": "atria.edu",
        "address": "ASKB Campus, AG's Colony, Anandnagar",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@atria.edu"
    },
    {
        "college_code": "1VI",
        "name": "Vemana Institute of Technology",
        "domain": "vemanait.edu.in",
        "address": "1 Mahayogi Vemana Road, 3rd Block, Koramangala",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@vemanait.edu.in"
    },
    {
        "college_code": "1CD",
        "name": "Cambridge Institute of Technology (CIT)",
        "domain": "cambridge.edu.in",
        "address": "Jai Bhuvaneshwari Nagar, KR Puram",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@cambridge.edu.in"
    },
    {
        "college_code": "1SI",
        "name": "Siddaganga Institute of Technology (SIT)",
        "domain": "sit.ac.in",
        "address": "B.H. Road, Tumakuru",
        "city": "Tumakuru",
        "state": "Karnataka",
        "contact_email": "principal@sit.ac.in"
    },
    {
        "college_code": "1SK",
        "name": "Sri Sairam College of Engineering",
        "domain": "sairamce.edu.in",
        "address": "Saileo Nagar, Guddanahalli, Anekal",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@sairamce.edu.in"
    },
    {
        "college_code": "1EC",
        "name": "East Point College of Engineering and Technology",
        "domain": "eastpoint.ac.in",
        "address": "Jnana Prabha, Bidarahalli, Virgonagar Post",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@eastpoint.ac.in"
    },
    {
        "college_code": "1SJ",
        "name": "BGS Institute of Technology (BGSIT)",
        "domain": "bgsit.ac.in",
        "address": "BG Nagar, Nagamangala Taluk",
        "city": "Mandya",
        "state": "Karnataka",
        "contact_email": "principal@bgsit.ac.in"
    },
    {
        "college_code": "1AM",
        "name": "AMC Engineering College",
        "domain": "amceducation.in",
        "address": "Bannerghatta Main Road, Kalkere",
        "city": "Bengaluru",
        "state": "Karnataka",
        "contact_email": "principal@amceducation.in"
    },

    # =========================================================================
    # VTU Region 2: Belagavi Region (Code Prefix: 2)
    # =========================================================================
    {
        "college_code": "2GI",
        "name": "K.L.S. Gogte Institute of Technology (GIT)",
        "domain": "git.edu",
        "address": "Jnana Ganga, Khanapur Road, Udyambag",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "principal@git.edu"
    },
    {
        "college_code": "2KL",
        "name": "K.L.E. Dr. M.S. Sheshgiri College of Engineering & Technology",
        "domain": "klescet.ac.in",
        "address": "Udyambag",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "principal@klescet.ac.in"
    },
    {
        "college_code": "2SD",
        "name": "SDM College of Engineering & Technology (SDMCET)",
        "domain": "sdmcet.ac.in",
        "address": "Dhavalagiri",
        "city": "Dharwad",
        "state": "Karnataka",
        "contact_email": "principal@sdmcet.ac.in"
    },
    {
        "college_code": "2BV",
        "name": "B.V. Bhoomaraddi College of Engineering & Technology (KLE Tech)",
        "domain": "kletech.ac.in",
        "address": "Vidyanagar",
        "city": "Hubballi",
        "state": "Karnataka",
        "contact_email": "principal@kletech.ac.in"
    },
    {
        "college_code": "2BA",
        "name": "Basaveshwar Engineering College (BEC)",
        "domain": "becbgk.edu",
        "address": "Vidyagiri",
        "city": "Bagalkot",
        "state": "Karnataka",
        "contact_email": "principal@becbgk.edu"
    },
    {
        "college_code": "2BL",
        "name": "BLDEA's V.P. Dr. P.G. Halakatti College of Engineering",
        "domain": "bldeacet.ac.in",
        "address": "Ashram Road",
        "city": "Vijayapura",
        "state": "Karnataka",
        "contact_email": "principal@bldeacet.ac.in"
    },
    {
        "college_code": "2MM",
        "name": "Maratha Mandal Engineering College",
        "domain": "mmec.edu.in",
        "address": "RS No. 477/2, Bauxite Road",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "principal@mmec.edu.in"
    },
    {
        "college_code": "2AG",
        "name": "Angadi Institute of Technology and Management (AITM)",
        "domain": "aitmbgm.ac.in",
        "address": "Savagaon Road",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "principal@aitmbgm.ac.in"
    },
    {
        "college_code": "2SA",
        "name": "S.G. Balekundri Institute of Technology (SGBIT)",
        "domain": "sgbit.edu.in",
        "address": "Shivabasav Nagar",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "principal@sgbit.edu.in"
    },
    {
        "college_code": "2TG",
        "name": "Tontadarya College of Engineering",
        "domain": "tcegadag.edu.in",
        "address": "Mundargi Road",
        "city": "Gadag",
        "state": "Karnataka",
        "contact_email": "principal@tcegadag.edu.in"
    },

    # =========================================================================
    # VTU Region 3: Kalaburagi Region (Code Prefix: 3)
    # =========================================================================
    {
        "college_code": "3PD",
        "name": "Poojya Doddappa Appa College of Engineering (PDA CE)",
        "domain": "pdaengg.com",
        "address": "Aiwan-E-Shahi Area",
        "city": "Kalaburagi",
        "state": "Karnataka",
        "contact_email": "principal@pdaengg.com"
    },
    {
        "college_code": "3BR",
        "name": "Ballari Institute of Technology and Management (BITM)",
        "domain": "bitm.edu.in",
        "address": "Jnana Gangotri Campus, Hosapete Road",
        "city": "Ballari",
        "state": "Karnataka",
        "contact_email": "principal@bitm.edu.in"
    },
    {
        "college_code": "3RB",
        "name": "Rao Bahadur Y. Mahabaleshwarappa Engineering College (RYMEC)",
        "domain": "rymec.in",
        "address": "Cantonment, Bellary",
        "city": "Ballari",
        "state": "Karnataka",
        "contact_email": "principal@rymec.in"
    },
    {
        "college_code": "3BK",
        "name": "Bheemanna Khandre Institute of Technology (BKIT)",
        "domain": "bkit.ac.in",
        "address": "Bhalwanki Road, Bhalki",
        "city": "Bidar",
        "state": "Karnataka",
        "contact_email": "principal@bkit.ac.in"
    },
    {
        "college_code": "3GN",
        "name": "Guru Nanak Dev Engineering College (GNDEC)",
        "domain": "gndec.ac.in",
        "address": "Mailoor Road",
        "city": "Bidar",
        "state": "Karnataka",
        "contact_email": "principal@gndec.ac.in"
    },
    {
        "college_code": "3KB",
        "name": "Khaja Banda Nawaz College of Engineering",
        "domain": "kbn.university",
        "address": "Rouzah-E-Buzurg",
        "city": "Kalaburagi",
        "state": "Karnataka",
        "contact_email": "principal@kbn.university"
    },

    # =========================================================================
    # VTU Region 4: Mysuru Region (Code Prefix: 4)
    # =========================================================================
    {
        "college_code": "4NI",
        "name": "The National Institute of Engineering (NIE)",
        "domain": "nie.ac.in",
        "address": "Manandavadi Road",
        "city": "Mysuru",
        "state": "Karnataka",
        "contact_email": "principal@nie.ac.in"
    },
    {
        "college_code": "4JC",
        "name": "Sri Jayachamarajendra College of Engineering (SJCE)",
        "domain": "jssstuniv.in",
        "address": "JSS TI Campus, Manasagangothri",
        "city": "Mysuru",
        "state": "Karnataka",
        "contact_email": "principal@sjce.ac.in"
    },
    {
        "college_code": "4VV",
        "name": "Vidyavardhaka College of Engineering (VVCE)",
        "domain": "vvce.ac.in",
        "address": "P.B. No. 206, Gokulam 3rd Stage",
        "city": "Mysuru",
        "state": "Karnataka",
        "contact_email": "principal@vvce.ac.in"
    },
    {
        "college_code": "4MC",
        "name": "Malnad College of Engineering (MCE)",
        "domain": "mcehassan.ac.in",
        "address": "Salagame Road",
        "city": "Hassan",
        "state": "Karnataka",
        "contact_email": "principal@mcehassan.ac.in"
    },
    {
        "college_code": "4SF",
        "name": "Sahyadri College of Engineering & Management",
        "domain": "sahyadri.edu.in",
        "address": "Sahyadri Campus, Adyar",
        "city": "Mangaluru",
        "state": "Karnataka",
        "contact_email": "principal@sahyadri.edu.in"
    },
    {
        "college_code": "4SO",
        "name": "St. Joseph Engineering College (SJEC)",
        "domain": "sjec.ac.in",
        "address": "Vamanjoor",
        "city": "Mangaluru",
        "state": "Karnataka",
        "contact_email": "principal@sjec.ac.in"
    },
    {
        "college_code": "4NM",
        "name": "NMAM Institute of Technology (NMAMIT)",
        "domain": "nmamit.nitte.edu.in",
        "address": "Nitte, Karkala Taluk",
        "city": "Udupi",
        "state": "Karnataka",
        "contact_email": "principal@nmamit.nitte.edu.in"
    },
    {
        "college_code": "4CB",
        "name": "Canara Engineering College (CEC)",
        "domain": "canaraengineering.in",
        "address": "Benjanapadavu, Bantwal Taluk",
        "city": "Mangaluru",
        "state": "Karnataka",
        "contact_email": "principal@canaraengineering.in"
    },
    {
        "college_code": "4PS",
        "name": "P.E.S. College of Engineering (PESCE)",
        "domain": "pesce.ac.in",
        "address": "PES Engineering College Road",
        "city": "Mandya",
        "state": "Karnataka",
        "contact_email": "principal@pesce.ac.in"
    },
    {
        "college_code": "4BD",
        "name": "Bapuji Institute of Engineering and Technology (BIET)",
        "domain": "bietdvg.edu",
        "address": "Post Box No. 325, Shamanur Road",
        "city": "Davangere",
        "state": "Karnataka",
        "contact_email": "principal@bietdvg.edu"
    },
    {
        "college_code": "4UB",
        "name": "University B.D.T. College of Engineering (UBDTCE)",
        "domain": "ubdtce.org",
        "address": "Hadadi Road",
        "city": "Davangere",
        "state": "Karnataka",
        "contact_email": "principal@ubdtce.org"
    },
    {
        "college_code": "4AL",
        "name": "Alva's Institute of Engineering & Technology (AIET)",
        "domain": "aiet.org.in",
        "address": "Shobhavana Campus, Mijar, Moodbidri",
        "city": "Mangaluru",
        "state": "Karnataka",
        "contact_email": "principal@aiet.org.in"
    },
    {
        "college_code": "4KV",
        "name": "K.V.G. College of Engineering (KVGCE)",
        "domain": "kvgce.edu.in",
        "address": "Kurunjibhag, Sullia",
        "city": "Dakshina Kannada",
        "state": "Karnataka",
        "contact_email": "principal@kvgce.edu.in"
    },
    {
        "college_code": "4PA",
        "name": "P.A. College of Engineering (PACE)",
        "domain": "pace.edu.in",
        "address": "Nadupadav, Montepadav Post, Kairangala",
        "city": "Mangaluru",
        "state": "Karnataka",
        "contact_email": "principal@pace.edu.in"
    },
    {
        "college_code": "4GW",
        "name": "G.S.S.S. Institute of Engineering & Technology for Women",
        "domain": "geethashishu.in",
        "address": "KRS Road, Metagalli",
        "city": "Mysuru",
        "state": "Karnataka",
        "contact_email": "principal@geethashishu.in"
    },
    {
        "college_code": "4MH",
        "name": "Maharaja Institute of Technology Mysore (MITM)",
        "domain": "mitmysore.in",
        "address": "Belawadi, Srirangapatna Taluk",
        "city": "Mandya",
        "state": "Karnataka",
        "contact_email": "principal@mitmysore.in"
    },

    # =========================================================================
    # VTU Headquarters & University Campus
    # =========================================================================
    {
        "college_code": "VTU-HQ",
        "name": "Visvesvaraya Technological University (VTU Headquarters)",
        "domain": "vtu.ac.in",
        "address": "Jnana Sangama, Machhe",
        "city": "Belagavi",
        "state": "Karnataka",
        "contact_email": "registrar@vtu.ac.in"
    }
]

def setup_clean_system():
    """
    Initializes clean database schema and provisions all VTU affiliated colleges,
    categories, and institutional administration without any fake lost-and-found records.
    """
    print("=" * 60)
    print("CampusTrace — VTU Multi-Tenant Clean Database Setup")
    print("=" * 60)

    print("Re-creating clean database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print(f"\n1. Provisioning {len(VTU_AFFILIATED_COLLEGES)} VTU Affiliated Colleges...")
        college_objects = []
        for cdata in VTU_AFFILIATED_COLLEGES:
            college_objects.append(
                College(
                    college_code=cdata["college_code"],
                    name=cdata["name"],
                    domain=cdata["domain"],
                    address=cdata["address"],
                    city=cdata["city"],
                    state=cdata["state"],
                    contact_email=cdata["contact_email"],
                    is_active=True
                )
            )
        db.add_all(college_objects)
        db.commit()

        # Build college lookup by code
        colleges_by_code = {}
        for c in college_objects:
            db.refresh(c)
            colleges_by_code[c.college_code] = c

        print(f"   [+] Successfully registered {len(college_objects)} VTU institutions.")

        rvce = colleges_by_code.get("1RV")
        msrit = colleges_by_code.get("1MS")
        bmsce = colleges_by_code.get("1BM")
        nie = colleges_by_code.get("4NI")

        kssem = colleges_by_code.get("1KG")

        print("\n2. Provisioning Universal Item Categories...")
        categories = [
            Category(name="Electronics", description="Laptops, smartphones, tablets, smartwatches, chargers, calculators", icon="laptop"),
            Category(name="Bags & Backpacks", description="Backpacks, tote bags, laptop sleeves, gym bags", icon="backpack"),
            Category(name="IDs, Cards & Wallets", description="VTU Student ID cards, bus passes, purses, wallets", icon="credit-card"),
            Category(name="Audio & Headphones", description="Earbuds, wireless headphones, earphones, audio cases", icon="headphones"),
            Category(name="Keys & Access Badges", description="Hostel keys, vehicle key fobs, campus lab lanyards", icon="key"),
            Category(name="Water Bottles & Flasks", description="Insulated tumblers, steel flasks, reusable bottles", icon="cup-soda"),
            Category(name="Apparel & Outerwear", description="Jackets, hoodies, lab coats, umbrellas, caps", icon="shirt"),
            Category(name="Books & Stationery", description="Engineering textbooks, VTU question banks, lab journals, drafters", icon="book-open"),
            Category(name="Eyewear & Accessories", description="Prescription glasses, sunglasses, wristwatches, smartbands", icon="glasses"),
            Category(name="Other Belongings", description="Miscellaneous personal possessions", icon="help-circle")
        ]
        db.add_all(categories)
        db.commit()
        print(f"   [+] Created {len(categories)} categories.")

        print("\n3. Provisioning Institutional Campus Locations...")
        locations = []
        if rvce:
            locations.extend([
                CampusLocation(college_id=rvce.id, name="Central Library - Reference & Digital Reading Room", building="Central Library Block", floor="2nd Floor", description="Room 204 carrel desks"),
                CampusLocation(college_id=rvce.id, name="Mechanical Engineering - CAD/CAM Simulation Lab", building="Mechanical Block", floor="Ground", description="Workstation bay 2"),
                CampusLocation(college_id=rvce.id, name="ECE & EEE Department Auditorium", building="ECE Block", floor="1st Floor", description="Main Seminar Hall"),
                CampusLocation(college_id=rvce.id, name="Student Activity Center & Food Court", building="Campus Center", floor="1st Floor", description="Cafeteria seating tables"),
                CampusLocation(college_id=rvce.id, name="Indoor Sports Pavilion", building="Sports Complex", floor="Ground", description="Badminton courts lobby")
            ])
        if msrit:
            locations.extend([
                CampusLocation(college_id=msrit.id, name="Apex Block - Central Library 3rd Floor", building="Apex Block", floor="3rd Floor", description="Quiet study wing"),
                CampusLocation(college_id=msrit.id, name="DES Hi-Tech Block - Computing Center 5", building="DES Block", floor="4th Floor", description="CS Lab 5"),
                CampusLocation(college_id=msrit.id, name="Fresher's Block - Lecture Hall 102", building="LHC Block", floor="1st Floor", description="Lecture theatre 102"),
                CampusLocation(college_id=msrit.id, name="MSRIT Canteen Quadrangle", building="Student Center", floor="Ground", description="Outdoor quad tables")
            ])
        if kssem:
            locations.extend([
                CampusLocation(college_id=kssem.id, name="KSSEM Central Library - 2nd Floor Study Area", building="Main Academic Block", floor="2nd Floor", description="Reading & reference desk"),
                CampusLocation(college_id=kssem.id, name="Computer Science & Engineering Lab 3", building="New Tech Block", floor="3rd Floor", description="Lab 304"),
                CampusLocation(college_id=kssem.id, name="Civil & Mechanical Workshop Foyer", building="Mechanical Block", floor="Ground", description="Workshop hallway"),
                CampusLocation(college_id=kssem.id, name="KSSEM Food Court & Open Amphitheatre", building="Student Amenity Center", floor="Ground", description="Courtyard seating")
            ])
        if bmsce:
            locations.extend([
                CampusLocation(college_id=bmsce.id, name="Library Block - Digital Reading Lounge", building="Library Block", floor="1st Floor", description="Reference section"),
                CampusLocation(college_id=bmsce.id, name="Mechanical Workshop Corridor", building="Mech Block", floor="Ground", description="Workshop foyer")
            ])
        if nie:
            locations.extend([
                CampusLocation(college_id=nie.id, name="NIE Administrative Foyer", building="Admin Block", floor="Ground", description="Entrance corridor"),
                CampusLocation(college_id=nie.id, name="Diamond Jubilee Sports Arena", building="Sports Complex", floor="Ground", description="Auditorium bleachers")
            ])

        db.add_all(locations)
        db.commit()
        print(f"   [+] Created {len(locations)} campus locations across VTU institutions.")

        print("\n4. Provisioning Secure Custodial Storage Vaults...")
        storages = []
        if rvce:
            storages.extend([
                StorageLocation(college_id=rvce.id, name="RVCE Security Office - Vault Safe 1", building="Security Complex", room_number="101", locker_box_identifier="Safe A-1", notes="Main campus security intake vault"),
                StorageLocation(college_id=rvce.id, name="Student Welfare Office - Intake Cabinet 2", building="Admin Block", room_number="205", locker_box_identifier="Cabinet 2", notes="Handover cabinet for electronics and IDs")
            ])
        if msrit:
            storages.extend([
                StorageLocation(college_id=msrit.id, name="MSRIT Proctor Office - Custodial Cabinet 1", building="Proctor Office", room_number="12", locker_box_identifier="Vault 1", notes="Central lost-and-found repository"),
                StorageLocation(college_id=msrit.id, name="Main Gate Security Post - Parcel Locker", building="Main Gate", room_number="Gate 1", locker_box_identifier="Locker 4", notes="Immediate intake box")
            ])
        if kssem:
            storages.append(
                StorageLocation(college_id=kssem.id, name="KSSEM Chief Proctor Custody Locker", building="Admin Block", room_number="102", locker_box_identifier="Vault K-1", notes="Intake and claim return safe")
            )
        if bmsce:
            storages.append(
                StorageLocation(college_id=bmsce.id, name="BMSCE Student Welfare - Intake Cabinet", building="Admin Block", room_number="104", locker_box_identifier="Vault B", notes="Standard storage")
            )

        db.add_all(storages)
        db.commit()
        print(f"   [+] Created {len(storages)} storage facilities.")

        print("\n5. Provisioning System Administrators...")
        # 1. Platform Administrator (Oversees all VTU colleges)
        platform_admin = User(
            email="platform.admin@campustrace.edu",
            password_hash=hash_password("PlatformSuper@2026"),
            full_name="CampusTrace VTU Platform Overseer",
            institutional_id="VTU-PLATFORM-01",
            role=UserRole.PLATFORM_ADMIN,
            is_active=True,
            college_id=None
        )
        db.add(platform_admin)

        # 2. RVCE Institutional Administrator & Staff Custodian
        if rvce:
            rvce_admin = User(
                email="admin@rvce.edu.in",
                password_hash=hash_password("RVCEAdmin@2026"),
                full_name="Dr. K. N. Subramanya",
                institutional_id="ADMIN-RVCE-01",
                role=UserRole.COLLEGE_ADMIN,
                is_active=True,
                college_id=rvce.id,
                department="Principal & Dean of Students",
                phone_number="+91 80 6818 8100"
            )
            rvce_teacher = User(
                email="staff.custodian@rvce.edu.in",
                password_hash=hash_password("RVCEStaff@2026"),
                full_name="Prof. Suresh Kumar",
                institutional_id="STAFF-RVCE-01",
                role=UserRole.TEACHER,
                is_active=True,
                college_id=rvce.id,
                department="Department of Student Welfare & Custody",
                phone_number="+91 80 6818 8101"
            )
            db.add(rvce_admin)
            db.add(rvce_teacher)

        # 3. MSRIT Institutional Administrator & Staff Custodian
        if msrit:
            msrit_admin = User(
                email="admin@msrit.edu",
                password_hash=hash_password("MSRITAdmin@2026"),
                full_name="Dr. N. V. R. Naidu",
                institutional_id="ADMIN-MSRIT-01",
                role=UserRole.COLLEGE_ADMIN,
                is_active=True,
                college_id=msrit.id,
                department="Dean of Student Affairs",
                phone_number="+91 80 2360 0822"
            )
            msrit_teacher = User(
                email="staff.custodian@msrit.edu",
                password_hash=hash_password("MSRITStaff@2026"),
                full_name="Prof. Anitha Rao",
                institutional_id="STAFF-MSRIT-01",
                role=UserRole.TEACHER,
                is_active=True,
                college_id=msrit.id,
                department="Proctorial Office & Campus Custody",
                phone_number="+91 80 2360 0825"
            )
            db.add(msrit_admin)
            db.add(msrit_teacher)

        # 4. KSSEM Institutional Administrator & Staff Custodian
        if kssem:
            kssem_admin = User(
                email="admin@kssem.edu.in",
                password_hash=hash_password("KSSEMAdmin@2026"),
                full_name="Dr. K. Rama Narasimha",
                institutional_id="ADMIN-KSSEM-01",
                role=UserRole.COLLEGE_ADMIN,
                is_active=True,
                college_id=kssem.id,
                department="Principal & Head of Institution",
                phone_number="+91 80 2842 5012"
            )
            kssem_teacher = User(
                email="staff.custodian@kssem.edu.in",
                password_hash=hash_password("KSSEMStaff@2026"),
                full_name="Prof. B. K. Manjunath",
                institutional_id="STAFF-KSSEM-01",
                role=UserRole.TEACHER,
                is_active=True,
                college_id=kssem.id,
                department="Department of Student Affairs & Security",
                phone_number="+91 80 2842 5013"
            )
            db.add(kssem_admin)
            db.add(kssem_teacher)

        db.commit()
        print(f"   [+] Provisioned Platform Administrator (platform.admin@campustrace.edu)")
        if rvce:
            print(f"   [+] Provisioned College Administrator for {rvce.name} (admin@rvce.edu.in)")
            print(f"   [+] Provisioned Custodial Staff for {rvce.name} (staff.custodian@rvce.edu.in)")
        if msrit:
            print(f"   [+] Provisioned College Administrator for {msrit.name} (admin@msrit.edu)")
        if kssem:
            print(f"   [+] Provisioned College Administrator for {kssem.name} (admin@kssem.edu.in)")
            print(f"   [+] Provisioned Custodial Staff for {kssem.name} (staff.custodian@kssem.edu.in)")

        print("\n6. System Cleanliness Verification:")
        print("   - Fake lost reports: 0")
        print("   - Fake found reports: 0")
        print("   - Fake student listings: 0")
        print("   - Fake claim records: 0")
        print(f"   - VTU Affiliated Colleges active: {len(college_objects)}")
        print("\nSystem ready for dynamic student registration with VTU institutions!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"Error during setup: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    setup_clean_system()
