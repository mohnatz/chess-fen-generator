"""
Board Detection via Gradient Projection

Pipeline:
1. Rough contour-based crop to isolate board region
2. Histogram equalization + normalize to float
3. Large-kernel Sobel gradients (ksize=31)
4. Positive/negative gradient product along each axis
5. Adaptive threshold loop to find 7+7 interior grid lines
6. Extend outward by one step to get full board edges
7. Crop exactly to board edges
"""

import numpy as np
import cv2
from skimage import io


def gradientx(img: np.ndarray) -> np.ndarray:
    """Compute gradient in x-direction using large Sobel kernel (ksize=31).
    Large kernel smooths out piece-level detail, emphasizing board grid lines."""
    return cv2.Sobel(img, cv2.CV_32F, 1, 0, ksize=31)


def gradienty(img: np.ndarray) -> np.ndarray:
    """Compute gradient in y-direction using large Sobel kernel (ksize=31)."""
    return cv2.Sobel(img, cv2.CV_32F, 0, 1, ksize=31)


def skeletonize_1d(arr: np.ndarray) -> np.ndarray:
    """Non-maximum suppression on a 1D signal. Keeps only local maxima,
    zeros out everything else to produce clean peak positions."""
    _arr = arr.copy()
    for i in range(len(_arr) - 1):
        if _arr[i] <= _arr[i + 1]:
            _arr[i] = 0
    for i in range(len(_arr) - 1, 0, -1):
        if _arr[i - 1] > _arr[i]:
            _arr[i] = 0
    return _arr


def check_match(lineset: list, tol_frac: float = 0.06) -> bool:
    """Check if a set of lines has 6 consecutive approximately-equal-spaced diffs.
    Uses relative tolerance: each diff must be within tol_frac of the running average."""
    if len(lineset) < 7:
        return False
    linediff = np.diff(lineset)
    x = 0
    cnt = 0
    for line in linediff:
        tol = max(5, x * tol_frac) if x > 0 else 5
        if abs(line - x) < tol:
            cnt += 1
        else:
            cnt = 0
            x = line
    return cnt >= 5


def prune_lines(lineset: list, image_dim: int, margin: int = 10) -> list:
    """Remove lines near image margins and find the 7 consecutive equally-spaced
    lines that form the interior grid of a chessboard.
    Uses relative tolerance for spacing comparison."""
    lineset = [x for x in lineset if x > margin and x < image_dim - margin]
    if len(lineset) < 7:
        return lineset
    linediff = np.diff(lineset)
    x = 0
    cnt = 0
    start_pos = 0
    for i, line in enumerate(linediff):
        tol = max(5, x * 0.06) if x > 0 else 5
        if abs(line - x) < tol:
            cnt += 1
            if cnt == 5:
                end_pos = i + 2
                return lineset[start_pos:end_pos]
        else:
            cnt = 0
            x = line
            start_pos = i
    return lineset


def fill_missing_lines(lineset: list, image_dim: int, margin: int = 10) -> list:
    """If we have 6 lines with 5 consistent diffs where one gap is ~2x the spacing,
    interpolate the missing line to get 7 equally-spaced lines."""
    lineset = [x for x in lineset if x > margin and x < image_dim - margin]
    if len(lineset) < 6:
        return lineset

    linediff = np.diff(lineset)

    for start in range(len(linediff)):
        if start + 4 > len(linediff):
            break
        segment_diffs = linediff[start:start+5] if start + 5 <= len(linediff) else linediff[start:]
        if len(segment_diffs) < 4:
            continue

        median_step = np.median(segment_diffs[segment_diffs < np.median(segment_diffs) * 1.5])

        consistent = 0
        double_idx = -1
        for j, d in enumerate(segment_diffs):
            if abs(d - median_step) < median_step * 0.08:
                consistent += 1
            elif abs(d - 2 * median_step) < median_step * 0.15:
                double_idx = j

        if consistent >= len(segment_diffs) - 1 and double_idx >= 0:
            insert_pos = start + double_idx + 1
            missing_val = int(round(lineset[insert_pos - 1] + median_step))
            new_lines = lineset[:insert_pos] + [missing_val] + lineset[insert_pos:]
            return new_lines

    return lineset


def _score_board_candidate(bw: int, bh: int, image_area: int) -> float:
    """Score a contour candidate for board likelihood (lower = better).

    Uses quadratic aspect penalty so extreme rectangles are penalized steeply,
    with a size bonus so larger contours are preferred among similar aspects.
    """
    aspect = bw / bh if bh > 0 else 0
    aspect_penalty = (1.0 - aspect) ** 2
    area_frac = (bw * bh) / image_area
    return aspect_penalty - 0.5 * area_frac


def _find_best_board_contour(contours: list, image_area: int, min_area_frac: float):
    """From a list of contours, find the best board candidate above the area threshold.

    Returns (bx, by, bw, bh) or None.
    """
    best = None
    best_score = float('inf')
    for cnt in contours[:20]:
        bx, by, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < min_area_frac * image_area:
            continue
        aspect = bw / bh if bh > 0 else 0
        if aspect < 0.5 or aspect > 2.0:
            continue
        score = _score_board_candidate(bw, bh, image_area)
        if score < best_score:
            best_score = score
            best = (bx, by, bw, bh)
    return best


def rough_crop_board(image: np.ndarray, min_area_frac: float = 0.05, padding_frac: float = 0.02):
    """Contour-based rough crop to isolate the board region before gradient projection.

    Multi-strategy approach:
    1. Canny + morphological closing + RETR_EXTERNAL (original)
    2. Canny + morphological closing + RETR_TREE (finds nested contours)
    3. Canny without closing + RETR_EXTERNAL (fallback for dense layouts)

    Returns:
        (cropped_image, (y_offset, x_offset), found_bool)
    """
    h, w = image.shape[:2]
    image_area = h * w

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if image.ndim == 3 else image.copy()
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    k_size = max(10, min(h, w) // 80)
    kernel = np.ones((k_size, k_size), np.uint8)
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    contours_ext, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_ext = sorted(contours_ext, key=cv2.contourArea, reverse=True)

    contours_tree, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    contours_tree = sorted(contours_tree, key=cv2.contourArea, reverse=True)

    contours_raw, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_raw = sorted(contours_raw, key=cv2.contourArea, reverse=True)

    candidates = []
    for contours in [contours_ext, contours_tree, contours_raw]:
        result = _find_best_board_contour(contours, image_area, min_area_frac)
        if result is not None:
            candidates.append(result)

    if not candidates:
        return image, (0, 0), False

    best = min(candidates, key=lambda c: _score_board_candidate(c[2], c[3], image_area))

    bx, by, bw, bh = best
    pad_x = int(padding_frac * bw)
    pad_y = int(padding_frac * bh)
    y0 = max(0, by - pad_y)
    y1 = min(h, by + bh + pad_y)
    x0 = max(0, bx - pad_x)
    x1 = min(w, bx + bw + pad_x)

    cropped = image[y0:y1, x0:x1]
    return cropped, (y0, x0), True


def get_chess_lines(hdx: np.ndarray, hdy: np.ndarray, hdx_thresh: float,
                    hdy_thresh: float, image_shape: tuple):
    """Detect 7 horizontal and 7 vertical interior chessboard lines.

    Returns:
        lines_x: list of x-positions of vertical lines
        lines_y: list of y-positions of horizontal lines
        is_match: True if exactly 7+7 equally-spaced lines found
    """
    window_size = 21
    sigma = 8.0
    gausswin = cv2.getGaussianKernel(window_size, sigma, cv2.CV_64F).flatten()

    hdx_binary = np.where(hdx > hdx_thresh, 1.0, 0.0)
    hdy_binary = np.where(hdy > hdy_thresh, 1.0, 0.0)

    blur_x = np.convolve(hdx_binary, gausswin, mode='same')
    blur_y = np.convolve(hdy_binary, gausswin, mode='same')

    skel_x = skeletonize_1d(blur_x)
    skel_y = skeletonize_1d(blur_y)

    lines_x = np.where(skel_x > 0)[0].tolist()
    lines_y = np.where(skel_y > 0)[0].tolist()

    lines_x = prune_lines(lines_x, image_shape[1])
    lines_y = prune_lines(lines_y, image_shape[0])

    if len(lines_x) != 7 or not check_match(lines_x):
        raw_x = np.where(skel_x > 0)[0].tolist()
        lines_x = fill_missing_lines(raw_x, image_shape[1])
        lines_x = prune_lines(lines_x, image_shape[1])

    if len(lines_y) != 7 or not check_match(lines_y):
        raw_y = np.where(skel_y > 0)[0].tolist()
        lines_y = fill_missing_lines(raw_y, image_shape[0])
        lines_y = prune_lines(lines_y, image_shape[0])

    is_match = (len(lines_x) == 7) and (len(lines_y) == 7) and \
               check_match(lines_x) and check_match(lines_y)

    return lines_x, lines_y, is_match


def detect_board(image: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int], bool]:
    """
    Detect chessboard via gradient projection with pos/neg product.

    Args:
        image: RGB image as numpy array

    Returns:
        cropped: The cropped board image (RGB)
        bbox: (y0, y1, x0, x1) bounding box in original image coordinates
        success: True if board was detected successfully
    """
    if image.ndim == 3 and image.shape[2] == 4:
        image = image[:, :, :3]
    h_orig, w_orig = image.shape[:2]

    # Rough crop to isolate board region
    cropped_rough, (y_off, x_off), crop_found = rough_crop_board(image)
    if crop_found:
        working_image = cropped_rough
    else:
        working_image = image
        y_off, x_off = 0, 0

    h, w = working_image.shape[:2]

    # Convert to grayscale
    gray = cv2.cvtColor(working_image, cv2.COLOR_RGB2GRAY)

    # Histogram equalization + normalize to float
    equ = cv2.equalizeHist(gray)
    norm_image = equ.astype(np.float32) / 255.0

    # Compute gradients with large Sobel kernel
    grad_x = gradientx(norm_image)
    grad_y = gradienty(norm_image)

    # Split into positive and negative gradients
    Dx_pos = np.clip(grad_x, 0, None).astype(np.float64)
    Dx_neg = np.clip(-grad_x, 0, None).astype(np.float64)
    Dy_pos = np.clip(grad_y, 0, None).astype(np.float64)
    Dy_neg = np.clip(-grad_y, 0, None).astype(np.float64)

    # Hough-like projection: multiply positive and negative sums
    hough_Dx = (np.sum(Dx_pos, axis=0) * np.sum(Dx_neg, axis=0)) / (h ** 2)
    hough_Dy = (np.sum(Dy_pos, axis=1) * np.sum(Dy_neg, axis=1)) / (w ** 2)

    # Adaptive threshold loop
    is_match = False
    lines_x = []
    lines_y = []
    a = 1

    while a < 5:
        threshold_x = np.max(hough_Dx) * (a / 5.0)
        threshold_y = np.max(hough_Dy) * (a / 5.0)

        lines_x, lines_y, is_match = get_chess_lines(
            hough_Dx, hough_Dy, threshold_x, threshold_y, norm_image.shape
        )

        if is_match:
            # Refinement: try next threshold level
            if a < 4:
                next_thresh_x = np.max(hough_Dx) * ((a + 1) / 5.0)
                next_thresh_y = np.max(hough_Dy) * ((a + 1) / 5.0)
                next_lx, next_ly, next_match = get_chess_lines(
                    hough_Dx, hough_Dy, next_thresh_x, next_thresh_y, norm_image.shape
                )
                if next_match:
                    lines_x, lines_y = next_lx, next_ly
            break
        a += 1

    if not is_match:
        # Return full image if detection failed
        return working_image, (y_off, h + y_off, x_off, w + x_off), False

    # Compute step sizes from the 7 interior lines
    stepx = int(round(np.mean(np.diff(lines_x))))
    stepy = int(round(np.mean(np.diff(lines_y))))

    # Build the full 9 lines (outer edges + 7 interior)
    all_x = [lines_x[0] - stepx] + lines_x + [lines_x[-1] + stepx]
    all_y = [lines_y[0] - stepy] + lines_y + [lines_y[-1] + stepy]

    # Crop bbox: exactly on the outer grid edges
    x0 = max(0, all_x[0])
    x1 = min(w, all_x[-1])
    y0 = max(0, all_y[0])
    y1 = min(h, all_y[-1])

    cropped = working_image[y0:y1, x0:x1]

    # Offset bbox back to original image coordinates
    bbox = (y0 + y_off, y1 + y_off, x0 + x_off, x1 + x_off)

    return cropped, bbox, True


def detect_board_with_intermediates(image: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int], bool, dict]:
    """
    Detect chessboard via gradient projection, capturing intermediate data for visualization.

    Same pipeline as detect_board(), but returns a dict of intermediate values.

    Args:
        image: RGB image as numpy array

    Returns:
        cropped: The cropped board image (RGB)
        bbox: (y0, y1, x0, x1) bounding box in original image coordinates
        success: True if board was detected successfully
        intermediates: dict of intermediate pipeline data
    """
    if image.ndim == 3 and image.shape[2] == 4:
        image = image[:, :, :3]
    h_orig, w_orig = image.shape[:2]

    intermediates = {
        'original': image,
    }

    # Rough crop to isolate board region
    cropped_rough, (y_off, x_off), crop_found = rough_crop_board(image)
    if crop_found:
        working_image = cropped_rough
    else:
        working_image = image
        y_off, x_off = 0, 0

    h, w = working_image.shape[:2]
    intermediates['working_image'] = working_image
    intermediates['crop_bbox'] = (y_off, x_off, h, w)
    intermediates['crop_found'] = crop_found

    # Convert to grayscale
    gray = cv2.cvtColor(working_image, cv2.COLOR_RGB2GRAY)

    # Histogram equalization + normalize to float
    equ = cv2.equalizeHist(gray)
    norm_image = equ.astype(np.float32) / 255.0
    intermediates['equalized'] = equ

    # Compute gradients with large Sobel kernel
    grad_x = gradientx(norm_image)
    grad_y = gradienty(norm_image)
    intermediates['grad_x'] = grad_x
    intermediates['grad_y'] = grad_y

    # Split into positive and negative gradients
    Dx_pos = np.clip(grad_x, 0, None).astype(np.float64)
    Dx_neg = np.clip(-grad_x, 0, None).astype(np.float64)
    Dy_pos = np.clip(grad_y, 0, None).astype(np.float64)
    Dy_neg = np.clip(-grad_y, 0, None).astype(np.float64)

    # Hough-like projection: multiply positive and negative sums
    hough_Dx = (np.sum(Dx_pos, axis=0) * np.sum(Dx_neg, axis=0)) / (h ** 2)
    hough_Dy = (np.sum(Dy_pos, axis=1) * np.sum(Dy_neg, axis=1)) / (w ** 2)
    intermediates['hough_Dx'] = hough_Dx
    intermediates['hough_Dy'] = hough_Dy

    # Adaptive threshold loop
    is_match = False
    lines_x = []
    lines_y = []
    a = 1

    while a < 5:
        threshold_x = np.max(hough_Dx) * (a / 5.0)
        threshold_y = np.max(hough_Dy) * (a / 5.0)

        lines_x, lines_y, is_match = get_chess_lines(
            hough_Dx, hough_Dy, threshold_x, threshold_y, norm_image.shape
        )

        if is_match:
            # Refinement: try next threshold level
            if a < 4:
                next_thresh_x = np.max(hough_Dx) * ((a + 1) / 5.0)
                next_thresh_y = np.max(hough_Dy) * ((a + 1) / 5.0)
                next_lx, next_ly, next_match = get_chess_lines(
                    hough_Dx, hough_Dy, next_thresh_x, next_thresh_y, norm_image.shape
                )
                if next_match:
                    lines_x, lines_y = next_lx, next_ly
            break
        a += 1

    intermediates['lines_x'] = lines_x
    intermediates['lines_y'] = lines_y

    if not is_match:
        intermediates['all_x'] = []
        intermediates['all_y'] = []
        return working_image, (y_off, h + y_off, x_off, w + x_off), False, intermediates

    # Compute step sizes from the 7 interior lines
    stepx = int(round(np.mean(np.diff(lines_x))))
    stepy = int(round(np.mean(np.diff(lines_y))))

    # Build the full 9 lines (outer edges + 7 interior)
    all_x = [lines_x[0] - stepx] + lines_x + [lines_x[-1] + stepx]
    all_y = [lines_y[0] - stepy] + lines_y + [lines_y[-1] + stepy]
    intermediates['all_x'] = all_x
    intermediates['all_y'] = all_y

    # Crop bbox: exactly on the outer grid edges
    x0 = max(0, all_x[0])
    x1 = min(w, all_x[-1])
    y0 = max(0, all_y[0])
    y1 = min(h, all_y[-1])

    cropped = working_image[y0:y1, x0:x1]

    # Offset bbox back to original image coordinates
    bbox = (y0 + y_off, y1 + y_off, x0 + x_off, x1 + x_off)

    return cropped, bbox, True, intermediates


def detect_board_from_file(image_path: str) -> tuple[np.ndarray, tuple[int, int, int, int], bool]:
    """
    Detect chessboard from an image file.

    Args:
        image_path: Path to the image file

    Returns:
        cropped: The cropped board image (RGB)
        bbox: (y0, y1, x0, x1) bounding box in original image coordinates
        success: True if board was detected successfully
    """
    image = io.imread(image_path)
    return detect_board(image)


def draw_bbox_on_image(image: np.ndarray, bbox: tuple[int, int, int, int],
                       color: tuple = (0, 255, 0), thickness: int = 3) -> np.ndarray:
    """Draw bounding box on image.

    Args:
        image: RGB image
        bbox: (y0, y1, x0, x1)
        color: BGR color tuple
        thickness: Line thickness

    Returns:
        Image with bbox drawn
    """
    y0, y1, x0, x1 = bbox
    annotated = image.copy()
    # Convert RGB to BGR for OpenCV, draw rectangle, convert back
    annotated_bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)
    cv2.rectangle(annotated_bgr, (x0, y0), (x1, y1), color, thickness)
    return cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
