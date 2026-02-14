"""
Pipeline Visualization Helpers

Each function takes intermediate pipeline data and returns PNG bytes
for displaying detection steps in the web UI.
"""

import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def _resize_for_viz(img: np.ndarray, max_width: int = 600) -> np.ndarray:
    """Resize image so width <= max_width, preserving aspect ratio."""
    h, w = img.shape[:2]
    if w <= max_width:
        return img
    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _encode_png(img_bgr: np.ndarray) -> bytes:
    """Encode a BGR (or grayscale) image as PNG bytes."""
    success, buf = cv2.imencode('.png', img_bgr)
    if not success:
        raise RuntimeError("Failed to encode image as PNG")
    return buf.tobytes()


def viz_rough_crop(original_rgb: np.ndarray, crop_bbox: tuple, crop_found: bool) -> bytes:
    """Draw green bounding box on the original image showing the rough crop region.

    Args:
        original_rgb: Original input image (RGB)
        crop_bbox: (y_offset, x_offset) top-left corner of crop
        crop_found: Whether a crop region was found
    """
    vis = original_rgb.copy()
    vis_bgr = cv2.cvtColor(vis, cv2.COLOR_RGB2BGR)

    if crop_found:
        y_off, x_off = crop_bbox[:2]
        # We need the crop dimensions — infer from working_shape
        # crop_bbox is (y_off, x_off, h, w)
        if len(crop_bbox) == 4:
            y_off, x_off, h, w = crop_bbox
            thickness = max(2, min(vis.shape[:2]) // 200)
            cv2.rectangle(vis_bgr, (x_off, y_off), (x_off + w, y_off + h),
                          (0, 255, 0), thickness)
        else:
            # Fallback: just mark the offset point
            pass

    vis_bgr = _resize_for_viz(vis_bgr)
    return _encode_png(vis_bgr)


def viz_equalized(equalized_gray: np.ndarray) -> bytes:
    """Return the histogram-equalized grayscale image as PNG bytes."""
    vis = _resize_for_viz(equalized_gray)
    return _encode_png(vis)


def viz_gradients(grad_x: np.ndarray, grad_y: np.ndarray) -> bytes:
    """Compute gradient magnitude, normalize, and apply inferno colormap."""
    magnitude = np.sqrt(grad_x.astype(np.float64) ** 2 + grad_y.astype(np.float64) ** 2)
    # Normalize to 0-255
    mag_max = magnitude.max()
    if mag_max > 0:
        magnitude = (magnitude / mag_max * 255).astype(np.uint8)
    else:
        magnitude = magnitude.astype(np.uint8)
    colored = cv2.applyColorMap(magnitude, cv2.COLORMAP_INFERNO)
    colored = _resize_for_viz(colored)
    return _encode_png(colored)


def viz_projections(hough_Dx: np.ndarray, hough_Dy: np.ndarray,
                    lines_x: list, lines_y: list) -> bytes:
    """Create matplotlib 2-subplot figure with projection signals and detected peaks."""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 4), dpi=100)
    fig.patch.set_facecolor('#1a1a1a')

    for ax, signal, lines, label in [
        (ax1, hough_Dx, lines_x, 'Vertical Lines (X projection)'),
        (ax2, hough_Dy, lines_y, 'Horizontal Lines (Y projection)'),
    ]:
        ax.set_facecolor('#1a1a1a')
        ax.plot(signal, color='#d4a017', linewidth=1, alpha=0.9)
        for line in lines:
            if 0 <= line < len(signal):
                ax.axvline(x=line, color='#22c55e', linewidth=1, alpha=0.7, linestyle='--')
                ax.plot(line, signal[line], 'o', color='#22c55e', markersize=5)
        ax.set_title(label, color='#a0a0a0', fontsize=9, pad=4)
        ax.tick_params(colors='#666666', labelsize=7)
        for spine in ax.spines.values():
            spine.set_color('#333333')
        ax.set_xlim(0, len(signal))

    fig.tight_layout(pad=1.5)

    # Render to PNG bytes
    import io
    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=fig.get_facecolor(),
                edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def viz_grid_lines(working_image_rgb: np.ndarray, all_x: list, all_y: list) -> bytes:
    """Draw 9 vertical + 9 horizontal green lines on the working image."""
    vis = working_image_rgb.copy()
    vis_bgr = cv2.cvtColor(vis, cv2.COLOR_RGB2BGR)
    h, w = vis_bgr.shape[:2]
    thickness = max(1, min(h, w) // 300)

    for x in all_x:
        x_clamped = max(0, min(x, w - 1))
        cv2.line(vis_bgr, (x_clamped, 0), (x_clamped, h - 1), (0, 255, 0), thickness)

    for y in all_y:
        y_clamped = max(0, min(y, h - 1))
        cv2.line(vis_bgr, (0, y_clamped), (w - 1, y_clamped), (0, 255, 0), thickness)

    vis_bgr = _resize_for_viz(vis_bgr)
    return _encode_png(vis_bgr)
