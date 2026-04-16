import base64
import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials


SECTION_CONFIG = {
    "english": 50,
    "math": 45,
    "reading": 36,
    "science": 40,
}
ANSWER_VALUE_MAP = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "F": 1,
    "G": 2,
    "H": 3,
    "J": 4,
}
NULL_MARKERS = {"", "-", "NULL", "NONE", "BLANK", "N/A", "NA"}
DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DATA_DIR / "tests.sqlite3"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "omr123")
ANTHROPIC_MODEL = os.getenv(
    "ANSWER_KEY_EXTRACTION_MODEL", "claude-sonnet-4-20250514"
)

app = FastAPI(title="OMR Pipeline")
security = HTTPBasic()


def build_allowed_origins():
    configured = os.getenv("CORS_ALLOW_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_data_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                answer_keys_json TEXT NOT NULL,
                source_filename TEXT,
                extraction_summary TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


ensure_data_store()


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def read_image_from_upload(upload: UploadFile) -> np.ndarray:
    data = upload.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    return img


def preprocess_for_ai(img: np.ndarray) -> np.ndarray:
    if img.shape[1] > img.shape[0]:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)

    clahe = cv2.createCLAHE(2.0, (8, 8))
    gray = clahe.apply(gray)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    sharpen = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    gray = cv2.filter2D(gray, -1, sharpen)

    return gray


def encode_crop_base64(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise HTTPException(status_code=500, detail="Encode failed")
    return base64.b64encode(buf).decode()


def detect_horizontal_rules(gray: np.ndarray):
    _, w = gray.shape
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel_strong = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 12, 2))
    kernel_weak = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 16, 1))

    strong = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel_strong)
    weak = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel_weak)
    combined = cv2.bitwise_or(strong, weak)

    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    lines = []
    for contour in contours:
        x, y, contour_width, contour_height = cv2.boundingRect(contour)
        if contour_width > w * 0.22 and contour_height < 28:
            lines.append(
                {
                    "x1": int(x),
                    "x2": int(x + contour_width),
                    "y": int(y + contour_height // 2),
                    "width": int(contour_width),
                    "height": int(contour_height),
                    "is_major": contour_width > w * 0.60,
                }
            )

    return sorted(lines, key=lambda line: line["y"])


def choose_best_divider_chain(y_lines, length=4):
    best = None
    best_var = None

    for index in range(len(y_lines) - length + 1):
        chain = y_lines[index : index + length]
        diffs = [chain[i + 1] - chain[i] for i in range(len(chain) - 1)]

        if min(diffs) <= 0:
            continue

        mean = sum(diffs) / len(diffs)
        variance = sum((diff - mean) ** 2 for diff in diffs) / len(diffs)

        if best_var is None or variance < best_var:
            best_var = variance
            best = chain

    if best is None:
        raise HTTPException(status_code=500, detail="No divider chain")

    return best


def get_divider_lines(lines, y_tol=18):
    major = sorted(
        [line for line in lines if line.get("is_major", False)],
        key=lambda line: line["y"],
    )

    if not major:
        raise HTTPException(status_code=500, detail="No major lines found")

    groups = [[major[0]]]
    for line in major[1:]:
        if abs(line["y"] - groups[-1][-1]["y"]) <= y_tol:
            groups[-1].append(line)
        else:
            groups.append([line])

    collapsed = []
    for group in groups:
        collapsed.append(
            {
                "y": int(round(sum(line["y"] for line in group) / len(group))),
                "x1": int(min(line["x1"] for line in group)),
                "x2": int(max(line["x2"] for line in group)),
                "width": int(max(line["width"] for line in group)),
                "height": int(max(line["height"] for line in group)),
                "is_major": True,
            }
        )

    if len(collapsed) < 4:
        raise HTTPException(
            status_code=500,
            detail=f"Not enough major lines after collapsing: {[line['y'] for line in collapsed]}",
        )

    chosen_y_values = choose_best_divider_chain([line["y"] for line in collapsed], length=4)
    return [next(line for line in collapsed if line["y"] == y_value) for y_value in chosen_y_values]


def infer_bottom_boundary(dividers):
    y_values = [divider["y"] for divider in dividers]
    diffs = [y_values[index + 1] - y_values[index] for index in range(len(y_values) - 1)]
    spacing = int(round(np.median(diffs)))
    last = dividers[-1]

    return {
        "y": int(last["y"] + spacing),
        "x1": int(last["x1"]),
        "x2": int(last["x2"]),
        "width": int(last["width"]),
        "height": int(last["height"]),
        "is_major": True,
        "is_inferred": True,
    }


def build_section_bands(lines, pad_y=15):
    dividers = get_divider_lines(lines)
    bottom = infer_bottom_boundary(dividers)
    boundaries = dividers + [bottom]
    bands = {}

    for index, name in enumerate(SECTION_CONFIG):
        top = boundaries[index]
        bottom_bound = boundaries[index + 1]
        bands[name] = {
            "y1": int(top["y"] + pad_y),
            "y2": int(bottom_bound["y"] - pad_y),
            "x1": int(min(top["x1"], bottom_bound["x1"])),
            "x2": int(max(top["x2"], bottom_bound["x2"])),
        }

    return bands, dividers, bottom


def split_omr(gray):
    lines = detect_horizontal_rules(gray)
    bands, dividers, bottom = build_section_bands(lines, pad_y=15)

    results = []
    debug_blocks = []

    for name, band in bands.items():
        y1 = band["y1"]
        y2 = band["y2"]
        x1 = band["x1"]
        x2 = band["x2"]

        if y2 <= y1 or x2 <= x1:
            continue

        section = gray[y1:y2, x1:x2]
        _, section_width = section.shape
        column_width = section_width / 5.0

        for column_index in range(5):
            crop_x1 = int(round(column_index * column_width))
            crop_x2 = int(round((column_index + 1) * column_width))
            crop = section[:, crop_x1:crop_x2]

            results.append(
                {
                    "section": name,
                    "column": column_index,
                    "image": encode_crop_base64(crop),
                }
            )
            debug_blocks.append(
                {
                    "section": name,
                    "column": column_index,
                    "coords": (x1 + crop_x1, y1, x1 + crop_x2, y2),
                }
            )

    return results, {
        "lines": lines,
        "dividers": dividers,
        "bottom": bottom,
        "bands": bands,
        "debug_blocks": debug_blocks,
    }


def draw_debug(gray, debug_info):
    vis = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    for line in debug_info["lines"]:
        color = (0, 0, 255) if line["is_major"] else (0, 255, 0)
        cv2.line(vis, (line["x1"], line["y"]), (line["x2"], line["y"]), color, 2)

    for divider in debug_info["dividers"]:
        cv2.line(
            vis,
            (divider["x1"], divider["y"]),
            (divider["x2"], divider["y"]),
            (255, 0, 255),
            2,
        )

    bottom = debug_info["bottom"]
    cv2.line(vis, (bottom["x1"], bottom["y"]), (bottom["x2"], bottom["y"]), (255, 255, 0), 2)

    for name, band in debug_info["bands"].items():
        x1, x2 = band["x1"], band["x2"]
        y1, y2 = band["y1"], band["y2"]
        cv2.rectangle(vis, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.putText(vis, name, (x1 + 6, y1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)

    for block in debug_info["debug_blocks"]:
        x1, y1, x2, y2 = block["coords"]
        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 165, 255), 2)

    return vis


def normalize_answer(raw_value):
    if raw_value is None:
        return None

    if isinstance(raw_value, bool):
        raise ValueError("Boolean values are not valid answer choices")

    if isinstance(raw_value, int):
        if raw_value in {1, 2, 3, 4}:
            return raw_value
        raise ValueError(f"Unsupported numeric answer: {raw_value}")

    if isinstance(raw_value, float) and raw_value.is_integer():
        return normalize_answer(int(raw_value))

    if isinstance(raw_value, str):
        cleaned = raw_value.strip().upper()
        if cleaned in NULL_MARKERS:
            return None
        if cleaned in ANSWER_VALUE_MAP:
            return ANSWER_VALUE_MAP[cleaned]

    raise ValueError(f"Unsupported answer value: {raw_value}")


def normalize_answer_keys(payload):
    if not isinstance(payload, dict):
        raise ValueError("Answer keys must be an object keyed by section")

    normalized = {}
    for section_name, expected_count in SECTION_CONFIG.items():
        raw_answers = payload.get(section_name)
        if not isinstance(raw_answers, list):
            raise ValueError(f"Section '{section_name}' must be a list")
        if len(raw_answers) != expected_count:
            raise ValueError(
                f"Section '{section_name}' must contain {expected_count} answers, received {len(raw_answers)}"
            )

        normalized[section_name] = [normalize_answer(value) for value in raw_answers]

    return normalized


def build_answer_key_schema():
    def section_schema(question_count):
        return {
            "type": "array",
            "minItems": question_count,
            "maxItems": question_count,
            "items": {
                "type": "string",
                "enum": ["1", "2", "3", "4", "null"],
            },
        }

    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "english": section_schema(SECTION_CONFIG["english"]),
            "math": section_schema(SECTION_CONFIG["math"]),
            "reading": section_schema(SECTION_CONFIG["reading"]),
            "science": section_schema(SECTION_CONFIG["science"]),
            "summary": {"type": "string"},
        },
        "required": ["english", "math", "reading", "science", "summary"],
    }


def extract_answer_keys_from_pdf(pdf_bytes, filename):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured for PDF answer key extraction.",
        )

    try:
        import anthropic
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="The anthropic package is required for PDF answer key extraction.",
        ) from exc

    client = anthropic.Anthropic(api_key=api_key)
    pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
    extraction_prompt = (
        "You are extracting answer keys from an uploaded test-answer-key PDF. "
        "Return only the official answer key values for the sections english (50), math (45), "
        "reading (36), and science (40). Convert A or F to 1, B or G to 2, C or H to 3, "
        "D or J to 4. If a question has no answer or is unreadable, return the string 'null'. "
        "Do not skip questions. Keep the answers in order. Also provide a short summary of what "
        "you extracted or any ambiguity you noticed. You must call the provided tool."
    )

    try:
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4096,
            tools=[
                {
                    "name": "submit_answer_key",
                    "description": "Submit the fully extracted answer key for the uploaded test.",
                    "input_schema": build_answer_key_schema(),
                    "strict": True,
                }
            ],
            tool_choice={"type": "tool", "name": "submit_answer_key"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": extraction_prompt,
                        },
                    ],
                }
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Claude extraction request failed: {exc}",
        ) from exc

    tool_block = next(
        (block for block in response.content if getattr(block, "type", None) == "tool_use"),
        None,
    )
    if tool_block is None:
        raise HTTPException(
            status_code=502,
            detail="Claude did not return the answer-key tool payload.",
        )

    extracted = dict(tool_block.input)

    normalized_keys = normalize_answer_keys(extracted)
    return normalized_keys, extracted.get("summary", "")


def section_counts(answer_keys):
    return {
        section_name: {
            "total": len(answers),
            "answered": sum(value is not None for value in answers),
            "blank": sum(value is None for value in answers),
        }
        for section_name, answers in answer_keys.items()
    }


def serialize_test(row, include_answer_keys=False):
    answer_keys = json.loads(row["answer_keys_json"])
    payload = {
        "id": row["id"],
        "name": row["name"],
        "sourceFilename": row["source_filename"],
        "extractionSummary": row["extraction_summary"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "sectionCounts": section_counts(answer_keys),
    }

    if include_answer_keys:
        payload["answerKeys"] = answer_keys

    return payload


def list_tests(include_answer_keys=False):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, answer_keys_json, source_filename, extraction_summary, created_at, updated_at
            FROM tests
            ORDER BY datetime(created_at) DESC, id DESC
            """
        ).fetchall()

    return [serialize_test(row, include_answer_keys=include_answer_keys) for row in rows]


def save_test(name, answer_keys, source_filename=None, extraction_summary=None):
    created_at = utc_now_iso()
    answer_keys_json = json.dumps(answer_keys)

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tests (name, answer_keys_json, source_filename, extraction_summary, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, answer_keys_json, source_filename, extraction_summary, created_at, created_at),
        )
        connection.commit()
        test_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, name, answer_keys_json, source_filename, extraction_summary, created_at, updated_at
            FROM tests
            WHERE id = ?
            """,
            (test_id,),
        ).fetchone()

    return serialize_test(row, include_answer_keys=True)


def require_admin(credentials: HTTPBasicCredentials = Depends(security)):
    is_valid = secrets.compare_digest(credentials.username, ADMIN_USERNAME) and secrets.compare_digest(
        credentials.password, ADMIN_PASSWORD
    )
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


@app.get("/health")
def health():
    return {"status": "ok", "tests": len(list_tests(include_answer_keys=False))}


@app.get("/tests")
def public_tests():
    return {"tests": list_tests(include_answer_keys=False)}


@app.get("/admin/tests")
def admin_tests(_: str = Depends(require_admin)):
    return {"tests": list_tests(include_answer_keys=True)}


@app.post("/admin/tests/import-pdf")
async def import_test_from_pdf(
    name: str = Form(...),
    file: UploadFile = File(...),
    _: str = Depends(require_admin),
):
    cleaned_name = name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Test name is required.")

    filename = file.filename or "answer-key.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF answer key.")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    answer_keys, extraction_summary = extract_answer_keys_from_pdf(pdf_bytes, filename)
    created_test = save_test(
        name=cleaned_name,
        answer_keys=answer_keys,
        source_filename=filename,
        extraction_summary=extraction_summary,
    )
    return {"test": created_test}


@app.post("/split-omr")
async def split_route(file: UploadFile = File(...)):
    img = read_image_from_upload(file)
    gray = preprocess_for_ai(img)
    blocks, debug_info = split_omr(gray)

    return {
        "count": len(blocks),
        "dividers": [divider["y"] for divider in debug_info["dividers"]],
        "inferred_bottom": debug_info["bottom"]["y"],
        "bands": debug_info["bands"],
        "blocks": blocks,
    }


@app.post("/debug-boxes")
async def debug_route(file: UploadFile = File(...)):
    img = read_image_from_upload(file)
    gray = preprocess_for_ai(img)
    _, debug_info = split_omr(gray)
    vis = draw_debug(gray, debug_info)

    ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode debug image")

    return Response(buf.tobytes(), media_type="image/jpeg")


@app.post("/preprocess-omr")
async def preprocess_route(file: UploadFile = File(...)):
    img = read_image_from_upload(file)
    gray = preprocess_for_ai(img)

    ok, buf = cv2.imencode(".jpg", gray, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode preprocessed image")

    return Response(buf.tobytes(), media_type="image/jpeg")
