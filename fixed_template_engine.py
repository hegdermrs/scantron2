import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "act_page2_template.json"
TEMPLATE = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
PAGE_DIMENSIONS = tuple(TEMPLATE["pageDimensions"])
BUBBLE_DIMENSIONS = tuple(TEMPLATE["bubbleDimensions"])
NORMAL_OPTIONS = ("A", "B", "C", "D")
ALT_OPTIONS = ("F", "G", "H", "J")
ALT_QUESTION_SETS = {
    "EN": {10, 20, 30, 40, 50},
    "M": set(range(2, 46, 2)),
    "R": {8, 16, 24, 32, 36},
    "S": {8, 16, 24, 32, 40},
}
SECTION_INFO = [
    {"prefix": "EN", "name": "English", "count": 50},
    {"prefix": "M", "name": "Mathematics", "count": 45},
    {"prefix": "R", "name": "Reading", "count": 36},
    {"prefix": "S", "name": "Science", "count": 40},
]
SECTION_BAND_PADDINGS = {
    "EN": {"top": 55, "bottom": 40},
    "M": {"top": 55, "bottom": 40},
    "R": {"top": 55, "bottom": 36},
    "S": {"top": 55, "bottom": 36},
}
MODE_CONFIGS = {
    "blue_ink": {"mask": "blue_ink", "blank": 0.03, "multiple_min": 0.03, "margin": 0.018},
    "dropout_dark": {"mask": "dropout_dark", "blank": 0.055, "multiple_min": 0.05, "margin": 0.028},
    "standard_gray": {"mask": "adaptive", "blank": 0.09, "multiple_min": 0.08, "margin": 0.032},
}


@dataclass
class Layout:
    prefix: str
    start: int
    end: int
    origin: tuple[float, float]
    bubbles_gap: float
    labels_gap: float


FIELD_LAYOUTS: list[Layout] = []
for block in TEMPLATE["fieldBlocks"].values():
    label = block["fieldLabels"][0]
    prefix = "".join(ch for ch in label if ch.isalpha())
    numeric = label[len(prefix):]
    start_s, end_s = numeric.split("..", 1)
    FIELD_LAYOUTS.append(
        Layout(
            prefix=prefix,
            start=int(start_s),
            end=int(end_s),
            origin=(float(block["origin"][0]), float(block["origin"][1])),
            bubbles_gap=float(block["bubblesGap"]),
            labels_gap=float(block["labelsGap"]),
        )
    )
FIELD_LAYOUTS.sort(key=lambda item: (item.origin[1], item.origin[0]))

SECTION_TEMPLATE_BOXES = {}
for section in SECTION_INFO:
    prefix = section["prefix"]
    layouts = [item for item in FIELD_LAYOUTS if item.prefix == prefix]
    min_x = min(item.origin[0] for item in layouts)
    max_x = max(
        item.origin[0] + ((len(NORMAL_OPTIONS) - 1) * item.bubbles_gap) + BUBBLE_DIMENSIONS[0]
        for item in layouts
    )
    min_y = min(item.origin[1] for item in layouts)
    max_y = max(
        item.origin[1] + ((item.end - item.start) * item.labels_gap) + BUBBLE_DIMENSIONS[1]
        for item in layouts
    )
    padding = SECTION_BAND_PADDINGS[prefix]
    SECTION_TEMPLATE_BOXES[prefix] = {
        "left": int(min_x - 40),
        "right": int(max_x + 32),
        "top": int(min_y - padding["top"]),
        "bottom": int(max_y + padding["bottom"]),
    }


def option_letters(prefix: str, question_number: int) -> tuple[str, str, str, str]:
    return ALT_OPTIONS if question_number in ALT_QUESTION_SETS.get(prefix, set()) else NORMAL_OPTIONS


def load_color_image(image_path: str) -> np.ndarray:
    image_bytes = np.fromfile(str(image_path), dtype=np.uint8)
    img = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR) if image_bytes.size else None
    if img is None:
        raise ValueError(f"Cannot read: {image_path}")
    if img.shape[1] > img.shape[0]:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    return img


def enhance_grayscale(image_gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(image_gray, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    return clahe.apply(blurred)


def order_points(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1)
    rect[0] = points[np.argmin(sums)]
    rect[2] = points[np.argmax(sums)]
    rect[1] = points[np.argmin(diffs)]
    rect[3] = points[np.argmax(diffs)]
    return rect


def score_document_candidate(points: np.ndarray, image_shape: tuple[int, int], image_area: float, target_ratio: float) -> float:
    area = cv2.contourArea(points.astype(np.float32))
    if area <= 0:
        return float("-inf")

    area_ratio = area / image_area
    width_a = np.linalg.norm(points[2] - points[3])
    width_b = np.linalg.norm(points[1] - points[0])
    height_a = np.linalg.norm(points[1] - points[2])
    height_b = np.linalg.norm(points[0] - points[3])
    width = max(width_a, width_b, 1.0)
    height = max(height_a, height_b, 1.0)
    candidate_ratio = min(width, height) / max(width, height)
    ratio_penalty = abs(candidate_ratio - target_ratio)

    margin_x = image_shape[1] * 0.02
    margin_y = image_shape[0] * 0.02
    xs = points[:, 0]
    ys = points[:, 1]
    border_hits = 0
    if np.min(xs) <= margin_x:
        border_hits += 1
    if np.max(xs) >= image_shape[1] - margin_x:
        border_hits += 1
    if np.min(ys) <= margin_y:
        border_hits += 1
    if np.max(ys) >= image_shape[0] - margin_y:
        border_hits += 1

    center = np.array([image_shape[1] / 2.0, image_shape[0] / 2.0], dtype=np.float32)
    centroid = points.mean(axis=0)
    center_distance = np.linalg.norm(centroid - center)
    max_distance = np.linalg.norm(center)
    center_penalty = (center_distance / max(max_distance, 1.0)) * 0.05

    return area_ratio - (ratio_penalty * 1.3) - (0.05 * border_hits) - center_penalty


def find_document_corners(binary_image: np.ndarray, image_shape: tuple[int, int], min_area_ratio: float = 0.18) -> np.ndarray | None:
    contours, _ = cv2.findContours(binary_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    image_area = float(image_shape[0] * image_shape[1])
    target_ratio = PAGE_DIMENSIONS[0] / PAGE_DIMENSIONS[1]
    best_candidate = None
    best_score = float("-inf")

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * min_area_ratio:
            continue

        perimeter = cv2.arcLength(contour, True)
        approximation = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        candidates = []
        if len(approximation) == 4:
            candidates.append(approximation.reshape(4, 2).astype(np.float32))

        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect).astype(np.float32)
        if cv2.contourArea(box) >= image_area * min_area_ratio:
            candidates.append(box)

        for candidate in candidates:
            ordered = order_points(candidate)
            score = score_document_candidate(ordered, image_shape, image_area, target_ratio)
            if score > best_score:
                best_score = score
                best_candidate = ordered

    return best_candidate


def four_point_transform(image: np.ndarray, points: np.ndarray) -> np.ndarray:
    destination = np.array(
        [
            [0, 0],
            [PAGE_DIMENSIONS[0] - 1, 0],
            [PAGE_DIMENSIONS[0] - 1, PAGE_DIMENSIONS[1] - 1],
            [0, PAGE_DIMENSIONS[1] - 1],
        ],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(points, destination)
    return cv2.warpPerspective(image, matrix, PAGE_DIMENSIONS, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))


def build_document_edges(image_gray: np.ndarray) -> np.ndarray:
    normalized = cv2.normalize(image_gray, None, 0, 255, cv2.NORM_MINMAX)
    edges = cv2.Canny(normalized, 60, 180)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
    return edges


def try_bright_page_normalization(original_color: np.ndarray) -> dict | None:
    gray = cv2.cvtColor(original_color, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 0)
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.medianBlur(mask, 7)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    mask = cv2.dilate(mask, kernel, iterations=1)
    corners = find_document_corners(mask, gray.shape, min_area_ratio=0.18)
    if corners is None:
        return None
    warped_color = four_point_transform(original_color, corners)
    overlay = original_color.copy()
    cv2.polylines(overlay, [corners.astype(np.int32)], True, (255, 0, 0), 6)
    return {"warped_color": warped_color, "detection_overlay": overlay, "method": "bright_page_warp", "page_found": True}


def try_edge_page_normalization(original_color: np.ndarray) -> dict | None:
    gray = cv2.cvtColor(original_color, cv2.COLOR_BGR2GRAY)
    edges = build_document_edges(enhance_grayscale(gray))
    corners = find_document_corners(edges, gray.shape, min_area_ratio=0.16)
    if corners is None:
        return None
    warped_color = four_point_transform(original_color, corners)
    overlay = original_color.copy()
    cv2.polylines(overlay, [corners.astype(np.int32)], True, (0, 255, 0), 6)
    return {"warped_color": warped_color, "detection_overlay": overlay, "method": "edge_page_warp", "page_found": True}


def try_projection_crop(original_color: np.ndarray) -> dict | None:
    gray = cv2.cvtColor(original_color, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (15, 15), 0)
    row_means = blurred.mean(axis=1)
    col_means = blurred.mean(axis=0)

    def bright_band(values: np.ndarray) -> tuple[int | None, int | None]:
        low = float(np.percentile(values, 15))
        high = float(np.percentile(values, 90))
        threshold = low + ((high - low) * 0.55)
        indices = np.where(values >= threshold)[0]
        if indices.size == 0:
            return None, None
        splits = np.split(indices, np.where(np.diff(indices) > 1)[0] + 1)
        longest = max(splits, key=len)
        return int(longest[0]), int(longest[-1])

    top, bottom = bright_band(row_means)
    left, right = bright_band(col_means)
    if None in {top, bottom, left, right}:
        return None
    height, width = gray.shape
    if (bottom - top) < height * 0.6 or (right - left) < width * 0.6:
        return None
    pad_y = int((bottom - top) * 0.02)
    pad_x = int((right - left) * 0.02)
    top = max(0, top - pad_y)
    bottom = min(height, bottom + pad_y)
    left = max(0, left - pad_x)
    right = min(width, right + pad_x)
    cropped = original_color[top:bottom, left:right]
    if cropped.size == 0:
        return None
    warped_color = cv2.resize(cropped, PAGE_DIMENSIONS, interpolation=cv2.INTER_LINEAR)
    overlay = original_color.copy()
    cv2.rectangle(overlay, (left, top), (right, bottom), (0, 255, 255), 6)
    return {"warped_color": warped_color, "detection_overlay": overlay, "method": "projection_crop", "page_found": True}


def prepare_normalized_sheet(original_color: np.ndarray) -> dict:
    for normalizer in (try_bright_page_normalization, try_edge_page_normalization, try_projection_crop):
        result = normalizer(original_color)
        if result is not None:
            warped_gray = cv2.cvtColor(result["warped_color"], cv2.COLOR_BGR2GRAY)
            result["normalized_color"] = result["warped_color"]
            result["normalized_gray"] = enhance_grayscale(warped_gray)
            return result

    resized_color = cv2.resize(original_color, PAGE_DIMENSIONS, interpolation=cv2.INTER_LINEAR)
    resized_gray = cv2.cvtColor(resized_color, cv2.COLOR_BGR2GRAY)
    overlay = resized_color.copy()
    cv2.rectangle(overlay, (5, 5), (overlay.shape[1] - 5, overlay.shape[0] - 5), (0, 0, 255), 5)
    return {
        "normalized_color": resized_color,
        "normalized_gray": enhance_grayscale(resized_gray),
        "detection_overlay": overlay,
        "method": "resize_only_fallback",
        "page_found": False,
    }


def cleanup_mask(mask: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    return mask


def build_mark_masks(normalized_color: np.ndarray, normalized_gray: np.ndarray) -> dict[str, np.ndarray]:
    hsv = cv2.cvtColor(normalized_color, cv2.COLOR_BGR2HSV)
    _, s_channel, v_channel = cv2.split(hsv)

    blue_ink = cv2.inRange(hsv, (90, 30, 20), (150, 255, 255))
    dropout_dark = cv2.bitwise_and(cv2.inRange(s_channel, 0, 85), cv2.inRange(v_channel, 0, 170))
    adaptive = cv2.adaptiveThreshold(normalized_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 7)
    orange_mask = cv2.bitwise_or(
        cv2.inRange(hsv, (0, 15, 80), (25, 255, 255)),
        cv2.inRange(hsv, (170, 15, 80), (179, 255, 255)),
    )

    return {
        "blue_ink": cleanup_mask(blue_ink),
        "dropout_dark": cleanup_mask(dropout_dark),
        "adaptive": cleanup_mask(adaptive),
        "orange_print": cleanup_mask(orange_mask),
    }


def clamp_box(box: tuple[int, int, int, int], image_shape: tuple[int, int]) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    height, width = image_shape[:2]
    x1 = max(0, min(width - 1, x1))
    y1 = max(0, min(height - 1, y1))
    x2 = max(x1 + 1, min(width, x2))
    y2 = max(y1 + 1, min(height, y2))
    return x1, y1, x2, y2


def score_bubble(mask: np.ndarray, gray: np.ndarray, box: tuple[int, int, int, int]) -> float:
    x1, y1, x2, y2 = clamp_box(box, mask.shape)
    patch_mask = mask[y1:y2, x1:x2]
    patch_gray = gray[y1:y2, x1:x2]
    if patch_mask.size == 0:
        return 0.0

    inset_x = max(1, int(round((x2 - x1) * 0.22)))
    inset_y = max(1, int(round((y2 - y1) * 0.22)))
    inner = patch_mask[inset_y:max(inset_y + 1, patch_mask.shape[0] - inset_y), inset_x:max(inset_x + 1, patch_mask.shape[1] - inset_x)]
    if inner.size == 0:
        inner = patch_mask
    inner_fill = float(np.count_nonzero(inner) / inner.size)

    ring_area = patch_mask.size - inner.size
    ring_fill = float((np.count_nonzero(patch_mask) - np.count_nonzero(inner)) / ring_area) if ring_area > 0 else 0.0

    gray_inner = patch_gray[inset_y:max(inset_y + 1, patch_gray.shape[0] - inset_y), inset_x:max(inset_x + 1, patch_gray.shape[1] - inset_x)]
    if gray_inner.size == 0:
        gray_inner = patch_gray
    darkness = 1.0 - float(np.mean(gray_inner) / 255.0)

    return max(0.0, inner_fill - (ring_fill * 0.20)) + (darkness * 0.10)


def merge_horizontal_line_boxes(line_boxes: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
    if not line_boxes:
        return []

    sorted_boxes = sorted(line_boxes, key=lambda box: box[1] + (box[3] / 2.0))
    merged = []
    current_group = [sorted_boxes[0]]
    current_center = sorted_boxes[0][1] + (sorted_boxes[0][3] / 2.0)

    for box in sorted_boxes[1:]:
        center_y = box[1] + (box[3] / 2.0)
        if abs(center_y - current_center) <= 18:
            current_group.append(box)
            current_center = float(np.mean([b[1] + (b[3] / 2.0) for b in current_group]))
            continue

        xs = [x for x, _, _, _ in current_group]
        ys = [y for _, y, _, _ in current_group]
        rights = [x + w for x, _, w, _ in current_group]
        bottoms = [y + h for _, y, _, h in current_group]
        merged.append((int(min(xs)), int(min(ys)), int(max(rights) - min(xs)), int(max(bottoms) - min(ys))))
        current_group = [box]
        current_center = center_y

    xs = [x for x, _, _, _ in current_group]
    ys = [y for _, y, _, _ in current_group]
    rights = [x + w for x, _, w, _ in current_group]
    bottoms = [y + h for _, y, _, h in current_group]
    merged.append((int(min(xs)), int(min(ys)), int(max(rights) - min(xs)), int(max(bottoms) - min(ys))))
    return merged


def detect_section_bands(normalized_color: np.ndarray, orange_mask: np.ndarray) -> dict[str, dict] | None:
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(normalized_color.shape[1] // 6, 80), 3))
    horizontal = cv2.morphologyEx(orange_mask, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
    horizontal = cv2.dilate(horizontal, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 3)), iterations=1)

    contours, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    line_boxes = []
    min_width = normalized_color.shape[1] * 0.45
    max_height = max(int(normalized_color.shape[0] * 0.02), 22)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w >= min_width and h <= max_height:
            line_boxes.append((x, y, w, h))

    merged_lines = merge_horizontal_line_boxes(line_boxes)
    if len(merged_lines) < 5:
        return None

    strongest_lines = sorted(merged_lines, key=lambda box: box[2], reverse=True)[:10]
    strongest_lines = sorted(strongest_lines, key=lambda box: box[1] + (box[3] / 2.0))
    expected_positions = [
        SECTION_TEMPLATE_BOXES["EN"]["top"],
        SECTION_TEMPLATE_BOXES["M"]["top"],
        SECTION_TEMPLATE_BOXES["R"]["top"],
        SECTION_TEMPLATE_BOXES["S"]["top"],
        SECTION_TEMPLATE_BOXES["S"]["bottom"] + 28,
    ]
    candidate_lines = []
    used_indexes = set()
    centers = [box[1] + (box[3] / 2.0) for box in strongest_lines]
    for expected in expected_positions:
        best_index = None
        best_distance = float("inf")
        for index, center in enumerate(centers):
            if index in used_indexes:
                continue
            distance = abs(center - expected)
            if distance < best_distance:
                best_distance = distance
                best_index = index
        if best_index is None or best_distance > 140:
            return None
        used_indexes.add(best_index)
        candidate_lines.append(strongest_lines[best_index])

    candidate_lines = sorted(candidate_lines, key=lambda box: box[1] + (box[3] / 2.0))
    if len(candidate_lines) != 5:
        return None

    left = int(max(0, np.percentile([box[0] for box in candidate_lines], 20) - (normalized_color.shape[1] * 0.02)))
    right = int(
        min(
            normalized_color.shape[1] - 1,
            np.percentile([box[0] + box[2] for box in candidate_lines], 80) + (normalized_color.shape[1] * 0.02),
        )
    )

    bands = {}
    for section, upper, lower in zip(SECTION_INFO, candidate_lines[:-1], candidate_lines[1:]):
        prefix = section["prefix"]
        upper_center = int(round(upper[1] + (upper[3] / 2.0)))
        lower_center = int(round(lower[1] + (lower[3] / 2.0)))
        top = max(0, upper_center + 6)
        bottom = min(normalized_color.shape[0] - 1, lower_center - 6)
        if bottom <= top:
            return None
        bands[prefix] = {"left": left, "right": right, "top": top, "bottom": bottom}
    return bands


def iter_question_boxes(section_bands: dict[str, dict] | None):
    for layout in FIELD_LAYOUTS:
        actual_box = (section_bands or {}).get(layout.prefix)
        template_box = SECTION_TEMPLATE_BOXES[layout.prefix]

        if actual_box is None:
            x_scale = 1.0
            y_scale = 1.0
            base_x = layout.origin[0]
            base_y = layout.origin[1]
        else:
            x_scale = (actual_box["right"] - actual_box["left"]) / max(template_box["right"] - template_box["left"], 1)
            y_scale = (actual_box["bottom"] - actual_box["top"]) / max(template_box["bottom"] - template_box["top"], 1)
            base_x = actual_box["left"] + ((layout.origin[0] - template_box["left"]) * x_scale)
            base_y = actual_box["top"] + ((layout.origin[1] - template_box["top"]) * y_scale)

        for question_number in range(layout.start, layout.end + 1):
            row_index = question_number - layout.start
            row_y = base_y + (row_index * layout.labels_gap * y_scale)
            bubble_gap = layout.bubbles_gap * x_scale
            bubble_width = BUBBLE_DIMENSIONS[0] * x_scale
            bubble_height = BUBBLE_DIMENSIONS[1] * y_scale
            boxes = []
            for bubble_index in range(4):
                x1 = int(round(base_x + (bubble_index * bubble_gap)))
                y1 = int(round(row_y))
                x2 = int(round(x1 + bubble_width))
                y2 = int(round(y1 + bubble_height))
                boxes.append((x1, y1, x2, y2))
            yield layout.prefix, question_number, boxes


def classify_scores(scores: list[float], *, blank_threshold: float, multiple_min: float, margin: float) -> tuple[int | None, bool, float]:
    ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
    best_idx, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0

    if best_score < blank_threshold:
        return None, False, best_score
    if second_score >= multiple_min and (best_score - second_score) < margin:
        return best_idx, True, best_score
    return best_idx, False, best_score


def summarize(output: dict) -> dict:
    summary = {}
    for section_name, rows in output.items():
        correct = sum(1 for row in rows if row.get("correct") is True)
        wrong = sum(1 for row in rows if row.get("correct") is False)
        detected = sum(1 for row in rows if row["detected"])
        summary[section_name] = {
            "total_questions": len(rows),
            "detected": detected,
            "correct": correct,
            "wrong": wrong,
            "blank": len(rows) - detected,
            "double_marked": sum(1 for row in rows if row.get("double_marked")),
            "score_pct": round((correct / (correct + wrong)) * 100, 1) if (correct + wrong) > 0 else None,
        }
    return summary


def score_with_mode(normalized_color: np.ndarray, normalized_gray: np.ndarray, mask: np.ndarray, mode_name: str, section_bands: dict[str, dict] | None, answer_keys: dict | None = None) -> tuple[dict, dict, np.ndarray]:
    config = MODE_CONFIGS[mode_name]
    sections = {section["name"]: [] for section in SECTION_INFO}
    section_names = {section["prefix"]: section["name"] for section in SECTION_INFO}
    overlay = normalized_color.copy()

    for prefix, question_number, boxes in iter_question_boxes(section_bands):
        labels = option_letters(prefix, question_number)
        scores = [score_bubble(mask, normalized_gray, box) for box in boxes]
        best_idx, double_marked, confidence = classify_scores(
            scores,
            blank_threshold=config["blank"],
            multiple_min=config["multiple_min"],
            margin=config["margin"],
        )
        detected = labels[best_idx] if best_idx is not None else None

        key_list = (answer_keys or {}).get(section_names[prefix], [])
        correct = None
        if question_number - 1 < len(key_list):
            expected = (key_list[question_number - 1] or "").strip().upper()
            if expected and detected:
                correct = expected == detected

        result = {
            "q": question_number,
            "detected": detected,
            "fill_ratios": {labels[idx]: round(score, 3) for idx, score in enumerate(scores)},
            "confidence": round(confidence, 3),
            "double_marked": double_marked,
            "correct": correct,
        }
        sections[section_names[prefix]].append(result)

        for idx, box in enumerate(boxes):
            color = (110, 110, 110)
            thickness = 1
            if double_marked:
                color = (0, 0, 255)
                thickness = 2
            elif best_idx is not None and idx == best_idx:
                if correct is True:
                    color = (0, 220, 100)
                elif correct is False:
                    color = (60, 60, 255)
                else:
                    color = (255, 200, 0)
                thickness = 2
            cv2.rectangle(overlay, (box[0], box[1]), (box[2], box[3]), color, thickness)

    if section_bands:
        for section in SECTION_INFO:
            prefix = section["prefix"]
            box = section_bands[prefix]
            cv2.rectangle(overlay, (box["left"], box["top"]), (box["right"], box["bottom"]), (0, 200, 255), 2)
            cv2.putText(overlay, section["name"], (box["left"] + 8, max(20, box["top"] - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2, cv2.LINE_AA)

    return sections, summarize(sections), overlay


def mode_quality(results: dict) -> float:
    all_rows = [row for rows in results.values() for row in rows]
    blanks = sum(1 for row in all_rows if not row["detected"])
    doubles = sum(1 for row in all_rows if row["double_marked"])
    detected = sum(1 for row in all_rows if row["detected"])
    avg_conf = (sum(row["confidence"] for row in all_rows) / len(all_rows)) if all_rows else 0.0

    if detected == 0:
        return -100.0
    density = detected / max(len(all_rows), 1)
    density_penalty = (density - 0.92) * 180.0 if density > 0.92 else 0.0
    return (avg_conf * 120.0) + (blanks * 0.18) - (doubles * 7.0) - density_penalty


def choose_mode(mark_masks: dict[str, np.ndarray], normalized_color: np.ndarray, normalized_gray: np.ndarray, answer_keys: dict | None, requested_mode: str) -> tuple[str, dict, dict, np.ndarray, np.ndarray, dict[str, dict] | None]:
    section_bands = detect_section_bands(normalized_color, mark_masks["orange_print"])
    if requested_mode in MODE_CONFIGS:
        mask_name = MODE_CONFIGS[requested_mode]["mask"]
        results, summary, overlay = score_with_mode(normalized_color, normalized_gray, mark_masks[mask_name], requested_mode, section_bands, answer_keys)
        return requested_mode, results, summary, overlay, mark_masks[mask_name], section_bands

    candidates = []
    for mode_name, config in MODE_CONFIGS.items():
        mask_name = config["mask"]
        results, summary, overlay = score_with_mode(normalized_color, normalized_gray, mark_masks[mask_name], mode_name, section_bands, answer_keys)
        candidates.append((mode_quality(results), mode_name, results, summary, overlay, mark_masks[mask_name]))

    candidates.sort(key=lambda item: item[0], reverse=True)
    _, mode_name, results, summary, overlay, selected_mask = candidates[0]
    return mode_name, results, summary, overlay, selected_mask, section_bands


def process_sheet(image_path: str, answer_keys: dict | None = None, debug_dir: str | None = None, mark_mode: str = "auto") -> dict:
    original = load_color_image(image_path)
    normalization = prepare_normalized_sheet(original)
    normalized_color = normalization["normalized_color"]
    normalized_gray = normalization["normalized_gray"]
    mark_masks = build_mark_masks(normalized_color, normalized_gray)
    selected_mode, results, summary, overlay, selected_mask, section_bands = choose_mode(mark_masks, normalized_color, normalized_gray, answer_keys, mark_mode)

    if debug_dir:
        out_dir = Path(debug_dir)
        out_dir.mkdir(exist_ok=True)
        cv2.imwrite(str(out_dir / "01_original.jpg"), original)
        cv2.imwrite(str(out_dir / "02_detection_overlay.jpg"), normalization["detection_overlay"])
        cv2.imwrite(str(out_dir / "03_normalized.jpg"), normalized_color)
        cv2.imwrite(str(out_dir / "04_enhanced_gray.jpg"), normalized_gray)
        cv2.imwrite(str(out_dir / "05_mask_blue_ink.jpg"), mark_masks["blue_ink"])
        cv2.imwrite(str(out_dir / "06_mask_dropout_dark.jpg"), mark_masks["dropout_dark"])
        cv2.imwrite(str(out_dir / "07_mask_adaptive.jpg"), mark_masks["adaptive"])
        cv2.imwrite(str(out_dir / "08_mask_orange_print.jpg"), mark_masks["orange_print"])
        cv2.imwrite(str(out_dir / "09_selected_mask.jpg"), selected_mask)
        cv2.imwrite(str(out_dir / "10_overlay.jpg"), overlay)
        (out_dir / "metadata.json").write_text(
            json.dumps(
                {
                    "normalization_method": normalization["method"],
                    "page_found": normalization["page_found"],
                    "selected_mode": selected_mode,
                    "section_bands_found": section_bands is not None,
                    "summary": summary,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    return results
