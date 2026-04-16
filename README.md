# OMR Scorer — OpenCV ML Edition

Accurate ACT answer sheet scoring using computer vision.
Works with phone camera photos — handles skew, glare, shadows.

## Setup (2 minutes)

```bash
# 1. Install Python 3.9+, then:
pip install -r requirements.txt

# 2. Run the server
python app.py

# 3. Open browser
# http://localhost:5000
```

## How it works

```
Phone photo
    ↓
Load & resize to 2200px height
    ↓
Perspective correction (deskew) — fixes camera angle up to ~15°
    ↓
CLAHE contrast equalization — fixes uneven lighting & shadows
    ↓
Adaptive threshold — converts to black/white per local region
    ↓
Morphological cleanup — removes noise
    ↓
Hough Circle Transform — finds all bubble positions
    ↓
Fill ratio classification — measures darkness of each bubble
    ↓
Grid grouping — maps circles to Q×Option grid
    ↓
Scoring — compares detected answers to key
    ↓
Results + confidence + CSV export
```

## Tips for best accuracy

| Condition | Recommendation |
|-----------|----------------|
| Lighting  | Natural daylight or overhead lamp. Avoid flash. |
| Angle     | Straight down. Up to ~15° tilt is auto-corrected. |
| Distance  | Sheet fills the frame. Bubbles clearly visible. |
| Blur      | Hold steady. Motion blur hurts accuracy. |
| Erasures  | Dark erasures may be detected as filled — check flagged items. |

## Files

```
omr/
├── app.py           # Flask server
├── omr_engine.py    # OpenCV pipeline
├── requirements.txt
├── static/
│   └── index.html   # Frontend
└── debug_output/    # Created on first run — shows CV detections
    ├── binary.jpg
    ├── deskewed.jpg
    └── debug_*.jpg  # Per-test detection overlay
```

## Deploy to client

**Local network (easiest):**
```bash
# Run on your machine, share IP with client on same WiFi
python app.py --host 0.0.0.0
# Client opens: http://YOUR_IP:5000
```

**Cloud (Railway/Render):**
```bash
# Add Procfile:
echo "web: python app.py" > Procfile
# Push to GitHub → connect to Railway → deploy
```

## Tuning accuracy

In `omr_engine.py`, adjust these if detection is off:

```python
# is_filled() — lower = more sensitive (catches lightly filled bubbles)
threshold = 0.42   # default: 0.42 (42% of bubble must be dark)

# find_bubble_grid() — tune for your sheet's bubble size
minRadius = 6      # minimum bubble radius in pixels
maxRadius = 18     # maximum bubble radius in pixels
minDist = 14       # minimum distance between bubble centers
```

## Debug images

After scoring, click "Debug images" in the UI to see:
- `binary.jpg` — thresholded image (what OpenCV sees)
- `deskewed.jpg` — perspective-corrected image  
- `debug_English.jpg` — detected bubbles overlaid (green=correct, red=wrong, yellow=detected/no key)
