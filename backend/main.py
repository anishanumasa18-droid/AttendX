import os
import sys


# Force UTF-8 encoding for standard output to prevent 'charmap' codec errors during DeepFace downloads
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from config import settings
import qrcode
import base64
import io
import time
import json
import secrets
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from scipy.spatial.distance import cosine
import bcrypt
# Optional DeepFace import
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    import cv2
    import numpy as np
    DEEPFACE_AVAILABLE = True
    print("DeepFace successfully loaded.")
except Exception as e:
    print(f"Warning: DeepFace initialization error: {e}. Using safe fallback.")

try:
    import jwt
    JWT_AVAILABLE = True
except Exception as e:
    JWT_AVAILABLE = False
    print(f"Warning: PyJWT initialization error: {e}. QR codes won't be securely signed.")

# Create FastAPI app
app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)
conn = psycopg2.connect(
    host="localhost",
    database="attendx",
    user="postgres",
    password="Anish@18",
    port="5432"
)

cursor = conn.cursor(cursor_factory=RealDictCursor)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_details = traceback.format_exc()
    print(f"Global error: {error_details}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": error_details if not os.getenv("PROD") else None},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Global stores for Dataset Mode (Issue 4 & 5)
active_sessions = {}  # session_id -> metadata

  # session_id -> list of student_emails


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():

    cursor.execute("SELECT NOW()")

    current_time = cursor.fetchone()

    return {
        "message": "AttendX API running",
        "database": "connected",
        "time": str(current_time["now"])
    }

# ======== MODELS ========
class SessionCreateRequest(BaseModel):

    course_id: str
    class_number: int
    duration_minutes: int

    course_code: str
    course_name: str

    topic: str
    session_date: str
    session_time: str

    batch: str
    session_type: str
    semester: str
    branch: str
    section: str

class VerifyFacePrecheckRequest(BaseModel):
    student_id: str
    face_image_b64: str

class RegisterFaceRequest(BaseModel):
    email: str
    face_image_b64: str

class QrScanRequest(BaseModel):
    qr_token: str
    student_id: str
    face_match_score: float

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str
    roll_number: str = None
    branch: str = None
    section: str = None
    semester: int = None
    face_image_b64: str = None

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

# ======== ENDPOINTS ========

@app.post("/api/auth/signup")
def signup(req: SignupRequest):

    hashed_password = bcrypt.hashpw(
        req.password.encode(),
        bcrypt.gensalt()
    ).decode()

    if req.role == "student":

        cursor.execute(
            "SELECT * FROM students WHERE email=%s",
            (req.email.lower(),)
        )

        existing_student = cursor.fetchone()

        if existing_student:

            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        cursor.execute("""
        INSERT INTO students
        (
            name,
            email,
            password,
            roll_number,
            branch,
            section,
            semester
        )

        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            req.name,
            req.email.lower(),
            hashed_password,
            req.roll_number,
            req.branch,
            req.section,
            req.semester
        ))

        conn.commit()

    elif req.role == "faculty":

        cursor.execute(
            "SELECT * FROM faculty WHERE email=%s",
            (req.email.lower(),)
        )

        existing_faculty = cursor.fetchone()

        if existing_faculty:

            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        cursor.execute("""
        INSERT INTO faculty
        (
            name,
            email,
            password
        )

        VALUES (%s,%s,%s)
        """, (
            req.name,
            req.email.lower(),
            hashed_password
        ))

        conn.commit()

    return {
        "message": "Signup successful",
        "role": req.role,
        "email": req.email,
        "user_id": "local_user"
    }
@app.post("/api/auth/login")
def login(req: LoginRequest):

    if req.role == "student":

        cursor.execute(
            "SELECT * FROM students WHERE email=%s",
            (req.email.lower(),)
        )

        student = cursor.fetchone()

        if student:

            password_match = bcrypt.checkpw(
                req.password.encode(),
                student["password"].encode()
            )

            if not password_match:

                raise HTTPException(
                    status_code=401,
                    detail="Invalid password"
                )

            return {
                "message": "Login successful",
                "role": "student",
                "email": student["email"],
                "user_id": student["id"]
            }

    elif req.role == "faculty":

        cursor.execute(
            "SELECT * FROM faculty WHERE email=%s",
            (req.email.lower(),)
        )

        faculty = cursor.fetchone()

        if faculty:

            password_match = bcrypt.checkpw(
                req.password.encode(),
                faculty["password"].encode()
            )

            if not password_match:

                raise HTTPException(
                    status_code=401,
                    detail="Invalid password"
                )

            return {
                "message": "Login successful",
                "role": "faculty",
                "email": faculty["email"],
                "user_id": faculty["id"]
            }

    raise HTTPException(
        status_code=401,
        detail="Email not found"
    )



@app.get("/api/student/me")
def get_student_me(email: str):

    cursor.execute(
        "SELECT * FROM students WHERE email=%s",
        (email.lower(),)
    )

    student = cursor.fetchone()

    if not student:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student

@app.get("/api/faculty/me")
def get_faculty_me(email: str):

    cursor.execute(
        "SELECT * FROM faculty WHERE email=%s",
        (email.lower(),)
    )

    faculty = cursor.fetchone()

    if not faculty:

        raise HTTPException(
            status_code=404,
            detail="Faculty not found"
        )

    return faculty

@app.post("/api/register_face")
def register_face(req: RegisterFaceRequest):
    try:
        b64 = req.face_image_b64
        if "," in b64: b64 = b64.split(",")[1]
        
        # Add padding
        b64 += "=" * ((4 - len(b64) % 4) % 4)
        
        try:
            img_data = base64.b64decode(b64)
        except Exception as e:
            raise Exception(f"Base64 decode error: {str(e)}")
            
        safe_email = "".join(c for c in req.email.lower() if c.isalnum() or c in "@._-")
        if not safe_email:
            raise Exception("Invalid email address")
            
        face_registry_path = os.path.join(BASE_DIR, "face_registry")
        os.makedirs(face_registry_path, exist_ok=True)
        file_path = os.path.join(face_registry_path, f"{safe_email}.jpg")
        cursor.execute("""
        SELECT email, face_embedding
        FROM students
        WHERE face_embedding IS NOT NULL
        """)

        existing_students = cursor.fetchall()
        with open(file_path, "wb") as f:
            f.write(img_data)
        embedding = DeepFace.represent(
            img_path=file_path,
            model_name="Facenet512",
            enforce_detection=True
        )[0]["embedding"]

        from scipy.spatial.distance import cosine

        for s in existing_students:

            existing_embedding = json.loads(s["face_embedding"])

            similarity = 1 - cosine(
                embedding,
                existing_embedding
            )

            if similarity > 0.75:

                raise HTTPException(
                    status_code=409,
                    detail=f"Face already registered with {s['email']}"
                )
        cursor.execute("""
                     UPDATE students
                     SET face_embedding=%s
                     WHERE email=%s
                     """, (
                         json.dumps(embedding),
                         req.email.lower()
                        ))
        conn.commit()
        return {"message": "Face registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    

@app.post("/api/verify/face_precheck")
def verify_face_precheck(req: VerifyFacePrecheckRequest):

    try:

        email = req.student_id.lower()

        cursor.execute(
            "SELECT face_embedding FROM students WHERE email=%s",
            (email,)
        )

        student = cursor.fetchone()

        if not student or not student["face_embedding"]:

            raise HTTPException(
                status_code=404,
                detail="Face embedding not found"
            )

        live_b64 = req.face_image_b64

        if "," in live_b64:
            live_b64 = live_b64.split(",")[1]

        live_b64 += "=" * ((4 - len(live_b64) % 4) % 4)

        if not DEEPFACE_AVAILABLE:

            raise HTTPException(
                status_code=500,
                detail="Face recognition engine unavailable"
            )

        nparr_live = np.frombuffer(
            base64.b64decode(live_b64),
            np.uint8
        )

        img_live = cv2.imdecode(
            nparr_live,
            cv2.IMREAD_COLOR
        )

        live_embedding = DeepFace.represent(
            img_path=img_live,
            model_name="Facenet512",
            enforce_detection=True
        )[0]["embedding"]

        stored_embedding = json.loads(
            student["face_embedding"]
        )

        similarity = 1 - cosine(
            live_embedding,
            stored_embedding
        )

        if similarity < 0.75:

            raise HTTPException(
                status_code=403,
                detail="Face not recognized"
            )

        score = similarity

        cursor.execute("""
        INSERT INTO face_verification_logs
        (
            student_email,
            verification_status,
            match_score
        )

        VALUES (%s,%s,%s)
        """, (

            req.student_id.lower(),
            "SUCCESS",
            score

        ))

        conn.commit()

        return {
            "status": "success",
            "message": "Face verified successfully",
            "score": score
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/api/sessions/create")
def create_session(req: SessionCreateRequest):
    now = datetime.now(timezone.utc)
    exp_time = now + timedelta(minutes=req.duration_minutes)
    session_id = f"sess_{int(now.timestamp())}"
    nonce = secrets.token_hex(8)
    
    if JWT_AVAILABLE:
        qr_token = jwt.encode({
            "nonce": nonce,
            "session_id": session_id,
            "course_id": req.course_id,
            "class_number": req.class_number,
            "exp": int(exp_time.timestamp()),
            "iat": int(now.timestamp()),
            "iss": "AttendX_Faculty"
        }, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    else:
        qr_token = f"session_{session_id}_{req.course_id}_{req.class_number}_{int(exp_time.timestamp())}"
    
    # Store session metadata for validation (Issue 5)
    active_sessions[session_id] = {

    "current_nonce": nonce,
    "previous_nonce": None,

    "session_id": session_id,

    "course_id": req.course_id,

    "course_code": req.course_code,
    "course_name": req.course_name,

    "class_number": req.class_number,

    "topic": req.topic,
    "session_date": req.session_date,
    "session_time": req.session_time,

    "batch": req.batch,
    "session_type": req.session_type,
    "semester": req.semester,
    "branch": req.branch,
    "section": req.section,

    "qr_token": qr_token,

    "start_time": now,
    "expires_at": exp_time,

    "is_active": True
}
    cursor.execute("""
    INSERT INTO sessions
    (
        session_id,
        course_code,
        course_name,
        topic,
        batch,
        session_type,
        class_number,
        session_date,
        session_time,
        duration_minutes,
        qr_token,
        current_nonce,
        previous_nonce,
        is_active
    )

    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (

        session_id,
        req.course_code,
        req.course_name,
        req.topic,
        req.batch,
        req.session_type,
        req.class_number,
        req.session_date,
        req.session_time,
        req.duration_minutes,
        qr_token,
        nonce,
        None,
        True

    ))

    conn.commit()    
    
    # Re-generate QR Code with the actual token
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    
    return {
        "message": "Session created successfully", 
        "qr_code_base64": img_b64, 
        "session_id": session_id,
        "qr_token": qr_token
    }
@app.get("/api/sessions/{session_id}/refresh_qr")
def refresh_qr(session_id: str):

    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]

    if not session["is_active"]:
        raise HTTPException(status_code=403, detail="Session closed")

    nonce = secrets.token_hex(8)

    session["previous_nonce"] = session.get("current_nonce")
    session["current_nonce"] = nonce

    exp_time = datetime.now(timezone.utc) + timedelta(seconds=15)

    qr_token = jwt.encode({
        "session_id": session_id,
        "course_id": session["course_id"],
        "class_number": session["class_number"],
        "nonce": nonce,
        "exp": int(exp_time.timestamp())
    }, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    session["qr_token"] = qr_token

    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_token)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")

    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    cursor.execute("""
    UPDATE sessions
    SET
        current_nonce=%s,
        previous_nonce=%s,
        qr_token=%s

    WHERE session_id=%s
    """, (

        nonce,
        session.get("previous_nonce"),
        qr_token,
        session_id

    ))

    conn.commit()
    return {
        "qr_code_base64": img_b64,
        "qr_token": qr_token,
        "nonce": nonce
    }

@app.get("/api/sessions/{session_id}/scans")
def get_session_scans(session_id: str):

    cursor.execute("""
    SELECT
        student_name,
        roll_number,
        scanned_at

    FROM live_session_scans

    WHERE session_id=%s

    ORDER BY scanned_at DESC
    """, (session_id,))

    scans = cursor.fetchall()

    formatted = []

    for s in scans:

        formatted.append({
            "name": s["student_name"],
            "roll": s["roll_number"],
            "time": s["scanned_at"].strftime("%I:%M %p")
        })

    return formatted
@app.post("/api/sessions/{session_id}/close")
def close_session(session_id: str):

    if session_id in active_sessions:

        active_sessions[session_id]["is_active"] = False

        cursor.execute("""
        UPDATE sessions
        SET is_active=FALSE
        WHERE session_id=%s
        """, (session_id,))

        conn.commit()

        return {"message": "Session closed"}

    raise HTTPException(
        status_code=404,
        detail="Session not found"
    )
@app.get("/api/check_attendance_status")
def check_attendance_status(
    session_id: str,
    student_email: str
):

    cursor.execute("""
    SELECT * FROM attendance
    WHERE session_id=%s
    AND student_email=%s
    """, (
        session_id,
        student_email.lower()
    ))

    existing = cursor.fetchone()

    return {
        "already_marked": existing is not None
    }
@app.get("/test_refresh")
def test_refresh():
    return {"message": "refresh route working"}


@app.post("/api/verify/qr_scan")
def verify_qr_scan(req: QrScanRequest):

    # 1. Verify QR Token Signature & Expiry
    payload = {}

    if JWT_AVAILABLE:

        try:
            payload = jwt.decode(
                req.qr_token,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=403,
                detail="QR Code has expired"
            )

        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=403,
                detail="Invalid or tampered QR Code"
            )

    else:

        # Fallback parsing for non-JWT mode
        parts = req.qr_token.split("_")

        if len(parts) < 5 or parts[0] != "session":
            raise HTTPException(
                status_code=403,
                detail="Invalid QR Code format"
            )

        payload = {
            "session_id": parts[1],
            "course_id": parts[2],
            "class_number": int(parts[3]),
            "exp": int(parts[4])
        }

        if datetime.now(timezone.utc).timestamp() > payload["exp"]:
            raise HTTPException(
                status_code=403,
                detail="QR Code has expired"
            )

    # 2. Match with active sessions
    session_id = payload.get("session_id")

    if not session_id or session_id not in active_sessions:
        raise HTTPException(
            status_code=403,
            detail="External or unknown QR Code rejected"
        )

    matched_session = active_sessions[session_id]

    # 3. Nonce validation (ANTI-SCREENSHOT)
    

    valid_nonces = [
    matched_session.get("current_nonce"),
    matched_session.get("previous_nonce")
]

    if payload.get("nonce") not in valid_nonces:

     raise HTTPException(
        status_code=403,
        detail="QR expired. Please scan latest QR."
    )

    # 5. Validate session active
    if not matched_session["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="This session has been closed"
        )

    # 6. Validate session expiry
    now = datetime.now(timezone.utc)

    if now > matched_session["expires_at"]:

        matched_session["is_active"] = False

        raise HTTPException(
            status_code=403,
            detail="Session time window has expired"
        )

    # 7. Prevent duplicate attendance
    student_email = req.student_id.lower()

    cursor.execute("""
    SELECT * FROM attendance
    WHERE session_id=%s
    AND student_email=%s
    """, (
        session_id,
        student_email
    ))

    existing = cursor.fetchone()

    if existing:

        raise HTTPException(
            status_code=409,
            detail="Attendance already marked"
        )

    # 8. Find student
        # 8. Find student

    cursor.execute(
        "SELECT * FROM students WHERE email=%s",
        (student_email,)
    )

    student_found = cursor.fetchone()

    if not student_found:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # 9. Store attendance

    cursor.execute("""
    INSERT INTO attendance
    (
        session_id,
        student_email,
        face_match_score
    )

    VALUES (%s,%s,%s)
    """, (

        session_id,
        student_email,
        req.face_match_score

    ))

    conn.commit()
    # 11. Live scan updates
    cursor.execute("""
    INSERT INTO live_session_scans
    (
        session_id,
        student_name,
        roll_number
    )

    VALUES (%s,%s,%s)
    """, (

        session_id,
        student_found["name"],
        student_found["roll_number"]

    ))

    conn.commit()

    
    print("LATEST QR API RUNNING")
    cursor.execute("""
    INSERT INTO qr_scan_logs
    (
        session_id,
        student_email,
        scan_status
    )

    VALUES (%s,%s,%s)
    """, (

        session_id,
        student_email,
        "SUCCESS"

    ))

    conn.commit()
    return {

    "status": "success",
    "message": "Attendance marked successfully",

    "course": matched_session['course_id'],

    "course_code": matched_session["course_code"],
    "course_name": matched_session["course_name"],

    "topic": matched_session["topic"],

    "session_date": matched_session["session_date"],
    "session_time": matched_session["session_time"],

    "batch": matched_session["batch"],
    "semester": matched_session["semester"],
    "branch": matched_session["branch"],
    "section": matched_session["section"],
    "session_type": matched_session["session_type"],

    "score": req.face_match_score
}