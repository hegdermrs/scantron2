"""
OMR Engine v3 — Divider-line anchored pipeline.

Key insight: ACT sheets have thick horizontal divider lines separating each
test section. We detect these lines first, then use them to:
  1. Crop each section precisely (English / Math / Reading / Science)
  2. Derive bubble size from actual section height + known question count
  3. Detect bubbles only within each section — no cross-contamination
  4. Handle skew and lighting per-section independently

Much more reliable than global Hough detection on the full image.
"""
import cv2
import numpy as np
import json
from pathlib import Path


# ── Sheet definition ──────────────────────────────────────────────────────────
# cols = number of question columns laid out horizontally in each section
# English: 3 cols of 25   (q1-25 | q26-50 | q51-75)
# Math:    2 cols of 30   (q1-30 | q31-60)
# Reading: 2 cols of 20   (q1-20 | q21-40)
# Science: 2 cols of 20   (q1-20 | q21-40)
ACT_TESTS = [
    {"name": "English",     "questions": 75, "options": ["A","B","C","D","E"],               "cols": 3},
    {"name": "Mathematics", "questions": 60, "options": ["A","B","C","D","E","F","G","H","J","K"], "cols": 2},
    {"name": "Reading",     "questions": 40, "options": ["A","B","C","D","F","G","H","J"],   "cols": 2},
    {"name": "Science",     "questions": 40, "options": ["A","B","C","D","F","G","H","J"],   "cols": 2},
]


# ── Step 1: Load & normalise ──────────────────────────────────────────────────

def load_image(image_path: str) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read: {image_path}")
    if img.shape[1] > img.shape[0]:          # landscape → rotate
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    h, w = img.shape[:2]
    scale = 2400 / h
    img = cv2.resize(img, (int(w * scale), 2400), interpolation=cv2.INTER_LANCZOS4)
    return img


# ── Step 2: Deskew ────────────────────────────────────────────────────────────

def deskew_sheet(img: np.ndarray) -> np.ndarray:
    """Warp the white sheet rectangle to a flat upright view."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    k    = np.ones((25, 25), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k)

    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return img
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)

    sheet = None
    min_area = 0.15 * img.shape[0] * img.shape[1]
    for c in cnts[:4]:
        if cv2.contourArea(c) < min_area:
            continue
        peri    = cv2.arcLength(c, True)
        approx  = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            sheet = approx; break
        hull    = cv2.convexHull(c)
        happrox = cv2.approxPolyDP(hull, 0.03 * peri, True)
        if len(happrox) == 4:
            sheet = happrox; break

    if sheet is None:
        print("[WARN] Sheet boundary not found — using full image")
        return img

    pts       = _order_points(sheet.reshape(4, 2).astype("float32"))
    tl,tr,br,bl = pts
    W = int(max(np.linalg.norm(br-bl), np.linalg.norm(tr-tl)))
    H = int(max(np.linalg.norm(tr-br), np.linalg.norm(tl-bl)))
    dst = np.array([[0,0],[W-1,0],[W-1,H-1],[0,H-1]], dtype="float32")
    M   = cv2.getPerspectiveTransform(pts, dst)
    return cv2.warpPerspective(img, M, (W, H))


def _order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s    = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)];  rect[2] = pts[np.argmax(s)]
    diff    = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]; rect[3] = pts[np.argmax(diff)]
    return rect


# ── Step 3: Binarise ──────────────────────────────────────────────────────────

def binarize(img: np.ndarray) -> np.ndarray:
    """CLAHE + adaptive threshold. Filled marks → WHITE, paper → BLACK."""
    gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    norm    = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    clahe   = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(16, 16))
    eq      = clahe.apply(norm)
    blur    = cv2.GaussianBlur(eq, (3, 3), 0)
    binary  = cv2.adaptiveThreshold(blur, 255,
                  cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 8)
    ko = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    kc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary  = cv2.morphologyEx(binary, cv2.MORPH_OPEN,  ko)
    binary  = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kc)
    return binary


# ── Step 4: Find divider lines (THE KEY INNOVATION) ──────────────────────────

def find_divider_lines(img: np.ndarray) -> list:
    """
    Detect horizontal divider lines using binary projection TROUGHS.

    After binarization (ink=WHITE, paper=BLACK), divider rules appear as
    rows with VERY FEW white pixels — solid ink, no bubbles.
    Question rows have lots of white (bubble outlines + filled marks).
    We find deep troughs in the row projection = divider positions.
    """
    from scipy.ndimage import maximum_filter1d
    h, w   = img.shape[:2]
    binary = binarize(img)

    # Normalised row projection
    proj   = np.sum(binary, axis=1).astype(float) / (w * 255)
    proj_s = np.convolve(proj, np.ones(7)/7, mode='same')

    # Local context: how high are the neighbouring rows?
    local_max = maximum_filter1d(proj_s, size=120)

    # Trough: row is very sparse AND surrounded by busier rows
    trough_mask = (proj_s < 0.04) & ((local_max - proj_s) > 0.05)

    in_t, t_start = False, 0
    raw = []
    for y in range(h):
        if trough_mask[y] and not in_t:
            in_t, t_start = True, y
        elif not trough_mask[y] and in_t:
            in_t = False
            bh   = y - t_start
            if 3 <= bh <= 60:
                raw.append((t_start + y) // 2)

    troughs = _deduplicate(sorted(raw), min_gap=int(h * 0.03))

    if len(troughs) < 3:
        print("[INFO] Trough method found few lines — using fallback")
        troughs = _darkest_bands_fallback(proj_s, h)

    print(f"[INFO] Divider lines at Y = {troughs} (image h={h}px)")
    return troughs


def _darkest_bands_fallback(proj, h, n=8):
    """Find the n deepest local minima as fallback divider positions."""
    candidates = []
    window = 30
    for y in range(window, h - window):
        nb = np.concatenate([proj[max(0,y-window):y], proj[y+1:y+window+1]])
        if proj[y] < np.percentile(nb, 20) and proj[y] < 0.08:
            candidates.append((proj[y], y))
    candidates.sort()
    selected = sorted([y for _, y in candidates[:n]])
    return _deduplicate(selected, min_gap=int(h * 0.03))


def _deduplicate(values, min_gap):
    if not values:
        return []
    result = [values[0]]
    for v in values[1:]:
        if v - result[-1] >= min_gap:
            result.append(v)
    return result


# ── Step 5: Assign section crops ─────────────────────────────────────────────

def assign_section_crops(img: np.ndarray, binary: np.ndarray, dividers: list) -> list:
    """
    Slice image into the 4 test sections using divider Y positions.
    The 4 biggest inter-divider gaps = the 4 test sections.
    """
    h, w    = img.shape[:2]
    all_div = sorted([0] + dividers + [h])
    gaps    = []
    for i in range(len(all_div) - 1):
        y1, y2 = all_div[i], all_div[i+1]
        gaps.append((y2 - y1, y1, y2))

    # Take the 4 largest gaps — these are the test sections
    section_gaps = sorted(sorted(gaps, reverse=True)[:4], key=lambda x: x[1])

    pad    = max(4, int(h * 0.004))
    crops  = []
    for _, y1, y2 in section_gaps:
        y1c = min(y1 + pad, h - 1)
        y2c = max(y2 - pad, 0)
        crops.append({
            "y1": y1c, "y2": y2c,
            "img_crop":    img[y1c:y2c, :],
            "binary_crop": binary[y1c:y2c, :],
            "height": y2c - y1c,
            "width":  w
        })

    return crops


# ── Step 6: Detect bubbles within a section ───────────────────────────────────

def detect_bubbles_in_section(crop_info: dict, test: dict) -> dict:
    """
    Detect bubbles using geometry derived from the section dimensions.
    Because we know the crop height and question count, we can calculate
    the expected bubble size — no guessing.
    """
    binary       = crop_info["binary_crop"]
    h, w         = binary.shape[:2]
    n_q          = test["questions"]
    n_opts       = len(test["options"])
    n_cols       = test["cols"]
    rows_per_col = n_q // n_cols

    # Derive bubble radius from section geometry
    row_h = h / rows_per_col
    r_est = row_h * 0.38
    r_min = max(3, int(r_est * 0.65))
    r_max = max(6, int(r_est * 1.45))
    d_min = max(r_min * 2, int(row_h * 0.50))

    print(f"  [{test['name']}] h={h}px  row_h={row_h:.1f}  r={r_min}–{r_max}px")

    circles = cv2.HoughCircles(binary, cv2.HOUGH_GRADIENT,
                dp=1.0, minDist=d_min, param1=50, param2=13,
                minRadius=r_min, maxRadius=r_max)
    if circles is None:
        circles = cv2.HoughCircles(binary, cv2.HOUGH_GRADIENT,
                    dp=1.2, minDist=d_min, param1=35, param2=10,
                    minRadius=r_min, maxRadius=r_max + 2)
    if circles is None:
        print(f"  [{test['name']}] ⚠ No circles detected")
        return {}

    raw = [(int(x), int(y), int(r)) for x,y,r in np.round(circles[0]).astype(int)]
    margin = r_max + 2
    raw = [(x,y,r) for x,y,r in raw if margin < x < w-margin and margin < y < h-margin]
    print(f"  [{test['name']}] {len(raw)} circles after filter")

    return _cluster_into_grid(raw, n_q, n_opts, n_cols, rows_per_col, h, w, row_h)


def _cluster_into_grid(circles, n_q, n_opts, n_cols, rows_per_col, h, w, row_h):
    """Assign circles to a Q×Options grid using section-column bands."""
    if not circles:
        return {}

    col_w = w / n_cols
    grid  = {}
    tol   = row_h * 0.45

    q_offset = 0
    for col_idx in range(n_cols):
        x0 = col_idx * col_w
        x1 = (col_idx + 1) * col_w
        col_c = [(x,y,r) for x,y,r in circles if x0 <= x < x1]
        if not col_c:
            q_offset += rows_per_col
            continue

        col_s = sorted(col_c, key=lambda c: c[1])
        rows, cur = [], [col_s[0]]
        for c in col_s[1:]:
            if abs(c[1] - np.mean([r[1] for r in cur])) < tol:
                cur.append(c)
            else:
                rows.append(sorted(cur, key=lambda c: c[0]))
                cur = [c]
        rows.append(sorted(cur, key=lambda c: c[0]))

        valid = [r for r in rows if abs(len(r) - n_opts) <= 3]
        if len(valid) < rows_per_col // 2:
            valid = [r for r in rows if len(r) >= max(2, n_opts - 4)]
        valid = valid[:rows_per_col]

        for row_idx, row in enumerate(valid):
            q_idx = q_offset + row_idx
            grid[q_idx] = {o: circle for o, circle in enumerate(row[:n_opts])}

        q_offset += rows_per_col

    return grid


# ── Step 7: Classify fill ────────────────────────────────────────────────────

def is_filled(binary, x, y, r, threshold=0.42):
    mask = np.zeros(binary.shape[:2], np.uint8)
    cv2.circle(mask, (x, y), max(r-2, 3), 255, -1)
    total = cv2.countNonZero(mask)
    if total == 0:
        return False, 0.0
    dark  = cv2.countNonZero(cv2.bitwise_and(binary, binary, mask=mask))
    ratio = dark / total
    return ratio >= threshold, round(ratio, 3)


# ── Step 8: Score ────────────────────────────────────────────────────────────

def score_section(binary_crop, grid, options, answer_key=None):
    results = []
    for q_idx in sorted(grid.keys()):
        row    = grid[q_idx]
        ratios = {o: is_filled(binary_crop, x, y, r)[1] for o,(x,y,r) in row.items()}
        if not ratios:
            results.append({"q":q_idx+1,"detected":None,"fill_ratios":{},"confidence":0})
            continue

        best_opt   = max(ratios, key=ratios.get)
        best_ratio = ratios[best_opt]
        detected   = options[best_opt] if best_ratio >= 0.42 else None
        double     = sum(1 for r in ratios.values() if r >= 0.42) > 1
        correct    = None
        if answer_key and q_idx < len(answer_key) and answer_key[q_idx] and detected:
            correct = detected.upper() == answer_key[q_idx].upper()

        results.append({
            "q":           q_idx + 1,
            "detected":    detected,
            "fill_ratios": {options[o]: round(r,3) for o,r in ratios.items()},
            "confidence":  round(best_ratio, 3),
            "double_marked": double,
            "correct":     correct
        })
    return results


# ── Main pipeline ─────────────────────────────────────────────────────────────

def process_sheet(image_path: str, answer_keys: dict = None, debug_dir: str = None) -> dict:
    if debug_dir:
        Path(debug_dir).mkdir(exist_ok=True)

    img    = load_image(image_path)
    img    = deskew_sheet(img)
    binary = binarize(img)

    if debug_dir:
        cv2.imwrite(f"{debug_dir}/01_deskewed.jpg", img)
        cv2.imwrite(f"{debug_dir}/02_binary.jpg",   binary)

    dividers = find_divider_lines(img)

    if debug_dir:
        dbg = img.copy()
        for y in dividers:
            cv2.line(dbg, (0,y), (img.shape[1],y), (0,200,255), 3)
        cv2.imwrite(f"{debug_dir}/03_dividers.jpg", dbg)

    if len(dividers) < 3:
        print("[WARN] Too few dividers found — using equal splits")
        dividers = [int(img.shape[0] * i / 6) for i in range(1, 6)]

    crops = assign_section_crops(img, binary, dividers)
    while len(crops) < 4:
        blank = np.zeros((50,50,3), np.uint8)
        crops.append({"img_crop":blank,"binary_crop":blank[:,:,0],
                      "height":50,"width":50,"y1":0,"y2":50})

    output = {}
    for i, test in enumerate(ACT_TESTS):
        crop    = crops[i]
        key     = (answer_keys or {}).get(test["name"], [])
        grid    = detect_bubbles_in_section(crop, test)
        results = score_section(crop["binary_crop"], grid, test["options"], key)
        output[test["name"]] = results

        if debug_dir:
            _draw_section_debug(crop["img_crop"].copy(), grid, results,
                                test["options"],
                                f"{debug_dir}/04_{test['name']}.jpg")

    return output


def _draw_section_debug(img, grid, results, options, out_path):
    rmap = {r["q"]: r for r in results}
    for q_idx, row in grid.items():
        rd = rmap.get(q_idx+1, {})
        det, cor = rd.get("detected"), rd.get("correct")
        for o_idx, (x,y,radius) in row.items():
            letter = options[o_idx] if o_idx < len(options) else "?"
            if det == letter:
                color = (0,220,100) if cor is True else (60,60,255) if cor is False else (255,200,0)
                cv2.circle(img,(x,y),radius,color,2)
            else:
                cv2.circle(img,(x,y),radius,(80,80,80),1)
    cv2.imwrite(out_path, img)


def summarize(output: dict) -> dict:
    summary = {}
    for name, results in output.items():
        correct = sum(1 for r in results if r.get("correct") is True)
        wrong   = sum(1 for r in results if r.get("correct") is False)
        scored  = correct + wrong
        summary[name] = {
            "total_questions": len(results),
            "detected":    sum(1 for r in results if r["detected"]),
            "correct":     correct,
            "wrong":       wrong,
            "blank":       len(results) - sum(1 for r in results if r["detected"]),
            "double_marked": sum(1 for r in results if r.get("double_marked")),
            "score_pct":   round(correct/scored*100,1) if scored > 0 else None
        }
    return summary


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python omr_engine.py <image> [answer_key.json]")
        sys.exit(1)
    keys = {}
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as f: keys = json.load(f)
    results = process_sheet(sys.argv[1], keys, debug_dir="debug_output")
    print(json.dumps({"summary": summarize(results), "details": results}, indent=2))
