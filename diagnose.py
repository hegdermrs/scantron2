"""
diagnose.py — Run this to see exactly what the pipeline detects.
Saves annotated images so you can tune parameters visually.

Usage:
    python diagnose.py your_sheet.jpg
"""
import sys, cv2, numpy as np
from omr_engine import load_and_enhance, deskew, binarize, find_bubble_grid

def diagnose(image_path):
    print(f"\n{'='*50}")
    print(f"Diagnosing: {image_path}")
    print('='*50)

    # Step 1: Load
    img = load_and_enhance(image_path)
    print(f"[1] Loaded: {img.shape[1]}x{img.shape[0]}px")
    cv2.imwrite("diag_1_loaded.jpg", img)

    # Step 2: Deskew
    deskewed = deskew(img)
    print(f"[2] Deskewed: {deskewed.shape[1]}x{deskewed.shape[0]}px")
    cv2.imwrite("diag_2_deskewed.jpg", deskewed)

    # Step 3: Binarize
    binary = binarize(deskewed)
    print(f"[3] Binary: white pixels = {cv2.countNonZero(binary)} / {binary.size}")
    cv2.imwrite("diag_3_binary.jpg", binary)

    # Step 4: Try multiple Hough parameter sets and show results
    gray = deskewed
    h, w = binary.shape[:2]
    scale = w / 850.0

    param_sets = [
        {"dp":1.0, "minDist":int(12*scale), "p1":60, "p2":15, "rmin":int(4*scale), "rmax":int(12*scale)},
        {"dp":1.0, "minDist":int(10*scale), "p1":50, "p2":12, "rmin":int(3*scale), "rmax":int(14*scale)},
        {"dp":1.2, "minDist":int(12*scale), "p1":40, "p2":10, "rmin":int(4*scale), "rmax":int(15*scale)},
    ]

    best = None
    best_count = 0
    for i, p in enumerate(param_sets):
        circles = cv2.HoughCircles(
            binary, cv2.HOUGH_GRADIENT,
            dp=p["dp"], minDist=p["minDist"],
            param1=p["p1"], param2=p["p2"],
            minRadius=max(3, p["rmin"]), maxRadius=max(8, p["rmax"])
        )
        count = len(circles[0]) if circles is not None else 0
        print(f"[4] Param set {i+1}: {count} circles detected (r={p['rmin']}–{p['rmax']}px)")

        if circles is not None:
            out = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
            for x, y, r in np.round(circles[0]).astype(int):
                cv2.circle(out, (x,y), r, (0,255,100), 1)
                cv2.circle(out, (x,y), 2, (0,200,255), -1)
            cv2.imwrite(f"diag_4_hough_params{i+1}.jpg", out)

            if abs(count - 375) < abs(best_count - 375):  # 375 = rough expected total ACT bubbles
                best_count = count
                best = circles

    # Step 5: Show clustering
    if best is not None:
        circles_list = [(x,y,r) for x,y,r in np.round(best[0]).astype(int)]
        ys = sorted([c[1] for c in circles_list])
        
        # Find natural row gaps
        gaps = [(ys[i+1]-ys[i], ys[i]) for i in range(len(ys)-1)]
        gaps_sorted = sorted(gaps, reverse=True)[:10]
        print(f"\n[5] Largest Y-gaps between circles (row separators):")
        for gap, y in gaps_sorted[:5]:
            print(f"    gap={gap}px at y≈{y}")
        
        print(f"\n[5] Total circles: {len(circles_list)}")
        print(f"    Expected for full ACT sheet: ~375 (75+60+40+40 × avg options)")
        
        # Count circles per horizontal band
        bands = [(0, h//4), (h//4, h//2), (h//2, 3*h//4), (3*h//4, h)]
        band_names = ["Top quarter (English)", "2nd quarter (Math)", "3rd quarter (Reading)", "Bottom (Science)"]
        for (y1,y2), name in zip(bands, band_names):
            count = sum(1 for _,y,_ in circles_list if y1<=y<y2)
            print(f"    {name}: {count} circles")

    print(f"\nOutput files saved:")
    print("  diag_1_loaded.jpg    — after load & resize")
    print("  diag_2_deskewed.jpg  — after perspective correction")
    print("  diag_3_binary.jpg    — after CLAHE + threshold")
    print("  diag_4_hough_params*.jpg — Hough detection with different params")
    print("\nCheck diag_3_binary.jpg first:")
    print("  GOOD: bubbles appear as bright white circles on black")
    print("  BAD:  mostly black → increase blockSize in binarize()")
    print("  BAD:  mostly white → decrease blockSize or increase C value")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnose.py your_sheet.jpg")
        sys.exit(1)
    diagnose(sys.argv[1])
