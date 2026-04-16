# Project Architecture

This repository is a small ACT-style OMR scoring tool.

It takes a photographed or scanned answer sheet, detects bubbles with
OpenCV, compares the detected answers to user-entered answer keys, and
returns section-level and question-level scoring results.

## What The Project Does

The app is built around one main workflow:

1. A user uploads an answer-sheet image in the browser.
2. The user optionally enters answer keys for each ACT section.
3. The frontend sends the image and keys to the Flask backend.
4. The backend runs the OpenCV OMR pipeline.
5. The app returns detailed results, summary scores, CSV export data, and
   optional debug images.

This is not a generic form processor. It is tuned for ACT-style sheet
layout and option sets.

## Main Files

- `app.py`: Flask server and API layer.
- `omr_engine.py`: Core OpenCV scoring pipeline.
- `static/index.html`: Entire frontend UI in one static page.
- `diagnose.py`: Older debugging helper script that currently appears out
  of sync with the engine API.
- `requirements.txt`: Python dependencies.

## Runtime Architecture

### Frontend

The frontend is a single static HTML page with embedded CSS and JavaScript.
It is responsible for:

- collecting the uploaded sheet image
- rendering the answer-key inputs
- sending requests to the backend
- showing progress states
- rendering section and per-question results
- exporting CSV
- loading debug images

The browser stores the image as base64 and sends it to `/api/score`.

### Backend

The backend is a thin Flask wrapper around the OMR pipeline.

Endpoints:

- `/`: serves `static/index.html`
- `/api/score`: decodes the uploaded image, writes it to a temporary file,
  runs the OMR engine, summarizes results, and returns JSON
- `/api/debug-images`: returns generated debug JPGs as base64 strings

The Flask layer does very little business logic. Nearly all detection and
scoring behavior lives in `omr_engine.py`.

## Data Flow

### 1. Upload And Request Build

In the frontend:

- the uploaded file is read with `FileReader`
- the image bytes are stored as base64
- answer keys are collected from the form into arrays keyed by section name

The request body looks like:

```json
{
  "image": "<base64 image bytes>",
  "answerKeys": {
    "English": ["A", "B", ""],
    "Mathematics": [],
    "Reading": [],
    "Science": []
  },
  "debug": true
}
```

### 2. Request Handling

In `app.py`:

- the backend reads JSON from the POST body
- decodes the base64 image
- writes it to a temp `.jpg`
- calls `process_sheet(temp_path, answer_keys, debug_dir=...)`
- calls `summarize(results)`
- returns:

```json
{
  "summary": { "...": "..." },
  "details": { "...": "..." },
  "success": true
}
```

### 3. OMR Processing

In `omr_engine.py`, `process_sheet()` orchestrates the full pipeline:

1. Load and normalize the image.
2. Deskew the sheet using a perspective transform.
3. Binarize the image using CLAHE and adaptive thresholding.
4. Detect horizontal divider lines between ACT sections.
5. Crop the image into section regions.
6. Detect circles inside each section with Hough Circle detection.
7. Cluster circles into a question-by-option grid.
8. Measure fill darkness inside each bubble.
9. Choose detected answers and compare them to the answer key.
10. Save debug images if enabled.

### 4. Result Rendering

Back in the frontend:

- `renderResults()` builds summary cards and section tables
- `exportCSV()` converts returned detail rows into a downloadable CSV
- `showDebug()` loads and displays backend-generated debug images

## OMR Engine Function Map

### `ACT_TESTS`

Defines the hardcoded ACT layout:

- section names
- question counts
- answer options
- number of vertical columns in each section

This is one of the most important configuration points in the project.

### `load_image(image_path)`

Responsibilities:

- reads the image from disk
- rotates landscape images into portrait
- rescales the image to a fixed height of 2400 pixels

Purpose:

- normalize geometry so downstream detection parameters are more stable

### `deskew_sheet(img)`

Responsibilities:

- detects the main page-like contour
- approximates a quadrilateral sheet boundary
- applies a perspective transform to flatten the page

Fallback:

- returns the original image if it cannot find a reliable sheet boundary

### `binarize(img)`

Responsibilities:

- convert to grayscale
- normalize intensity
- apply CLAHE contrast enhancement
- apply Gaussian blur
- apply adaptive thresholding
- apply morphological open/close cleanup

Purpose:

- make bubble outlines and filled marks easier to detect and measure

### `find_divider_lines(img)`

This is the core layout strategy of the project.

Instead of detecting all bubbles across the full page and hoping the layout
can be reconstructed afterward, the code first finds horizontal divider
lines between ACT sections.

How it works:

- binarize the page
- compute row-wise ink density
- find deep troughs in the vertical projection
- use those troughs as divider line positions

Fallback:

- `_darkest_bands_fallback()` picks likely low-density bands if the main
  trough method does not find enough separators

### `assign_section_crops(img, binary, dividers)`

Responsibilities:

- combine top, divider, and bottom boundaries
- compute gap heights
- treat the 4 largest gaps as the 4 ACT test sections
- return image and binary crops for each section

This function is the bridge between layout detection and per-section bubble
processing.

### `detect_bubbles_in_section(crop_info, test)`

Responsibilities:

- derive expected row height from section geometry
- estimate bubble radius from that row height
- run Hough Circle detection inside the section only
- filter out circles too close to section edges
- pass results into grid clustering

Important idea:

- bubble size is inferred from known ACT section structure rather than using
  one global fixed radius

### `_cluster_into_grid(...)`

Responsibilities:

- split circles into vertical ACT columns
- group circles into rows by similar Y positions
- keep rows whose option counts are close to the expected count
- map each detected row into question indices

Output shape:

- `grid[q_idx][option_idx] = (x, y, r)`

This is how raw circle detections become logical question/answer slots.

### `is_filled(binary, x, y, r, threshold=0.42)`

Responsibilities:

- build a circular mask for a bubble
- measure the fraction of white pixels within that mask
- classify the bubble as filled if the fill ratio is at least `0.42`

This threshold is one of the main tuning points for sensitivity.

### `score_section(binary_crop, grid, options, answer_key=None)`

Responsibilities:

- compute fill ratios for all options in each question row
- choose the darkest option as the detected answer
- suppress detection if the strongest fill ratio is below threshold
- flag double-marked questions if multiple options cross threshold
- compare the detected answer to the provided answer key

Returned fields per question:

- `q`
- `detected`
- `fill_ratios`
- `confidence`
- `double_marked`
- `correct`

### `process_sheet(image_path, answer_keys=None, debug_dir=None)`

Top-level orchestration function.

Responsibilities:

- create debug output directory if requested
- run the image pipeline
- detect section dividers
- fall back to equal splits if divider detection fails badly
- score each ACT section independently
- optionally save debug overlays

Output:

- a dictionary keyed by section name

### `summarize(output)`

Responsibilities:

- compute section-level totals from per-question results
- count detected, correct, wrong, blank, and double-marked items
- compute score percentages where an answer key was available

## Frontend Function Map

### `goTo(id)`

Switches between the upload, answer-key, and result panels.

### `loadFile(file)`

Reads the chosen image, stores base64 bytes, shows a preview, and marks the
upload step as complete in the UI.

### key form builder

An immediately invoked function builds answer-key dropdowns from the `TESTS`
definition in the browser.

### `getKeys()`

Collects current answer-key selections into the JSON structure expected by
the backend.

### `runScoring()`

Main frontend action.

Responsibilities:

- verify an image exists
- show a loading state
- animate a simulated pipeline progress display
- POST the image and keys to `/api/score`
- store the response
- pass the response to `renderResults()`

Note:

- the progress steps are UI-only and are not tied to real backend progress

### `renderResults(data)`

Responsibilities:

- aggregate totals across sections
- render summary stats
- render expandable per-section question tables
- reveal export and debug actions

### `showDebug()`

Loads debug images from `/api/debug-images` and renders them in a grid.

### `exportCSV()`

Creates a CSV from returned `details` and triggers a browser download.

## Result Shapes

### Detailed per-question result

```json
{
  "q": 1,
  "detected": "B",
  "fill_ratios": {
    "A": 0.121,
    "B": 0.773,
    "C": 0.104,
    "D": 0.082
  },
  "confidence": 0.773,
  "double_marked": false,
  "correct": true
}
```

### Section summary result

```json
{
  "total_questions": 75,
  "detected": 71,
  "correct": 64,
  "wrong": 7,
  "blank": 4,
  "double_marked": 1,
  "score_pct": 90.1
}
```

## Key Assumptions

- The sheet is ACT-like and matches the hardcoded section definitions.
- Horizontal divider lines are visible enough to recover section boundaries.
- Circle detection is good enough to reconstruct each section's bubble grid.
- A single fill threshold of `0.42` is acceptable across sections.
- The user may leave answer keys blank, in which case questions can still be
  detected but not judged correct or wrong.

## Known Issues And Risks

- `diagnose.py` appears stale and references older engine function names.
- The frontend and backend both hardcode ACT section metadata, so they can
  drift if only one side is updated.
- There are no automated tests in this folder.
- The app is more prototype/tooling-oriented than production-hardened.
- Accuracy is likely sensitive to sheet style, lighting, blur, and print
  variations.

## Best Entry Points For Future Work

If you want to revisit this project later, these are the best starting
points:

- For backend API behavior: `app.py`
- For detection/scoring logic: `omr_engine.py`
- For UI and request payload shape: `static/index.html`
- For tuning accuracy: `is_filled()`, `detect_bubbles_in_section()`,
  `find_divider_lines()`, and `ACT_TESTS`
- For debugging detections: the `debug_output/` images produced by
  `process_sheet()`

## Short Summary

The project is a Flask + OpenCV ACT answer-sheet scorer.

The frontend gathers an image and answer keys.
The backend runs a divider-line-based OMR pipeline.
The engine splits the sheet into ACT sections, detects bubbles inside each
section, measures fill darkness, scores against the answer key, and returns
detailed results plus optional debug images.
