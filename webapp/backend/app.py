"""
FastAPI Backend for Chess FEN Generator

Endpoints:
- POST /predict: Receives image, returns FEN and analysis links
- GET /health: Health check endpoint
"""

import base64
import io
import logging
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, File, Query, Request, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from board_detection import detect_board, detect_board_with_intermediates, draw_bbox_on_image
from fen_generator import load_model, predict_fen
from pipeline_viz import (
    viz_rough_crop, viz_equalized, viz_gradients,
    viz_projections, viz_grid_lines,
)

logger = logging.getLogger(__name__)

# --- Constants ---
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Magic byte signatures for allowed image formats
MAGIC_SIGNATURES = [
    (b'\xff\xd8\xff', None, None),           # JPEG
    (b'\x89PNG\r\n\x1a\n', None, None),      # PNG
    (b'RIFF', b'WEBP', 8),                    # WEBP: starts with RIFF, "WEBP" at offset 8
]


def _is_allowed_image(data: bytes) -> bool:
    """Check if data starts with an allowed image magic byte signature."""
    for prefix, extra, offset in MAGIC_SIGNATURES:
        if data[:len(prefix)] == prefix:
            if extra is None:
                return True
            if data[offset:offset + len(extra)] == extra:
                return True
    return False


# Global model instance
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global model
    print("Loading chess piece recognition model...")
    model = load_model()
    print(f"Model loaded. Input shape: {model.input_shape}")
    yield
    # Cleanup (if needed)
    print("Shutting down...")


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Chess FEN Generator API",
    description="Convert chess screenshots to FEN notation",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    # TODO: restrict to production domain
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)


class PredictionResponse(BaseModel):
    """Response model for /predict endpoint."""
    fen: str
    fen_standard: str
    confidence: float
    min_confidence: float
    bbox: list[int]
    annotated_image_base64: str
    low_confidence_squares: list[dict]
    links: dict


class PipelineStep(BaseModel):
    """A single step in the detection pipeline visualization."""
    key: str
    title: str
    description: str
    image_base64: str | None


class PipelineResponse(BaseModel):
    """Response model for /predict/pipeline endpoint."""
    steps: list[PipelineStep]


class HealthResponse(BaseModel):
    """Response model for /health endpoint."""
    status: str
    model_loaded: bool


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None
    )


@app.post("/predict", response_model=PredictionResponse)
@limiter.limit("10/minute")
async def predict(request: Request, file: UploadFile = File(...), active_color: str = Query("w", regex="^[wb]$")):
    """
    Detect chessboard in image and predict FEN notation.

    Args:
        file: Uploaded image file (PNG, JPG, JPEG)

    Returns:
        PredictionResponse with FEN, confidence, bbox, annotated image, and analysis links
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Read and validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate file type via magic bytes
    if not _is_allowed_image(contents):
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Please upload a PNG, JPEG, or WEBP image."
        )

    try:
        # Decode image
        image = Image.open(io.BytesIO(contents))

        # Convert to RGB numpy array
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)

        # Detect board
        cropped, bbox, success = detect_board(image_array)

        if not success:
            raise HTTPException(
                status_code=422,
                detail="Could not detect chessboard in image. Make sure the board is clearly visible."
            )

        # Predict FEN
        result = predict_fen(model, cropped, active_color=active_color)

        # Create annotated image with bbox
        annotated = draw_bbox_on_image(image_array, bbox)

        # Convert annotated image to base64
        annotated_pil = Image.fromarray(annotated)
        buffer = io.BytesIO()
        annotated_pil.save(buffer, format="PNG")
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return PredictionResponse(
            fen=result['fen'],
            fen_standard=result['fen_standard'],
            confidence=result['avg_confidence'],
            min_confidence=result['min_confidence'],
            bbox=list(bbox),
            annotated_image_base64=f"data:image/png;base64,{annotated_base64}",
            low_confidence_squares=result['low_confidence_squares'],
            links=result['links']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing image in /predict: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process image. Please try a different file.")


@app.post("/predict-base64")
@limiter.limit("10/minute")
async def predict_base64(request: Request, data: dict):
    """
    Alternative endpoint that accepts base64-encoded image.

    Args:
        data: Dict with 'image' key containing base64-encoded image data

    Returns:
        Same as /predict endpoint
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if 'image' not in data:
        raise HTTPException(status_code=400, detail="Missing 'image' field")

    try:
        # Decode base64 image
        image_data = data['image']
        if ',' in image_data:
            # Remove data URL prefix if present
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)

        # Validate file size
        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

        # Validate file type via magic bytes
        if not _is_allowed_image(image_bytes):
            raise HTTPException(
                status_code=400,
                detail="Unsupported image format. Please upload a PNG, JPEG, or WEBP image."
            )

        image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB numpy array
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)

        # Detect board
        cropped, bbox, success = detect_board(image_array)

        if not success:
            raise HTTPException(
                status_code=422,
                detail="Could not detect chessboard in image. Make sure the board is clearly visible."
            )

        # Predict FEN
        result = predict_fen(model, cropped)

        # Create annotated image with bbox
        annotated = draw_bbox_on_image(image_array, bbox)

        # Convert annotated image to base64
        annotated_pil = Image.fromarray(annotated)
        buffer = io.BytesIO()
        annotated_pil.save(buffer, format="PNG")
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            'fen': result['fen'],
            'fen_standard': result['fen_standard'],
            'confidence': result['avg_confidence'],
            'min_confidence': result['min_confidence'],
            'bbox': list(bbox),
            'annotated_image_base64': f"data:image/png;base64,{annotated_base64}",
            'low_confidence_squares': result['low_confidence_squares'],
            'links': result['links']
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing image in /predict-base64: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process image. Please try a different file.")


@app.post("/predict/pipeline", response_model=PipelineResponse)
@limiter.limit("5/minute")
async def predict_pipeline(request: Request, file: UploadFile = File(...)):
    """
    Run the board detection pipeline and return visualization of each step.

    Returns images and descriptions for each stage of the detection process.
    """
    # Read and validate file
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    if not _is_allowed_image(contents):
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Please upload a PNG, JPEG, or WEBP image."
        )

    try:
        image = Image.open(io.BytesIO(contents))
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)

        # Run detection with intermediates
        cropped, bbox, success, intermediates = detect_board_with_intermediates(image_array)

        steps: list[PipelineStep] = []

        # Step 1: Finding the Board
        crop_png = viz_rough_crop(
            intermediates['original'],
            intermediates['crop_bbox'],
            intermediates['crop_found'],
        )
        steps.append(PipelineStep(
            key="rough_crop",
            title="Finding the Board",
            description="Canny edge detection and contour analysis locate the board region, filtering out browser chrome, sidebars, and eval bars.",
            image_base64=f"data:image/png;base64,{base64.b64encode(crop_png).decode()}",
        ))

        # Step 2: Enhancing Contrast
        eq_png = viz_equalized(intermediates['equalized'])
        steps.append(PipelineStep(
            key="equalized",
            title="Enhancing Contrast",
            description="Histogram equalization normalizes lighting so grid lines stand out regardless of board theme.",
            image_base64=f"data:image/png;base64,{base64.b64encode(eq_png).decode()}",
        ))

        # Step 3: Computing Edge Gradients
        grad_png = viz_gradients(intermediates['grad_x'], intermediates['grad_y'])
        steps.append(PipelineStep(
            key="gradients",
            title="Computing Edge Gradients",
            description="A large Sobel kernel (31x31) detects edges while smoothing out piece-level detail.",
            image_base64=f"data:image/png;base64,{base64.b64encode(grad_png).decode()}",
        ))

        # Step 4: Projecting Gradients
        proj_png = viz_projections(
            intermediates['hough_Dx'],
            intermediates['hough_Dy'],
            intermediates['lines_x'],
            intermediates['lines_y'],
        )
        steps.append(PipelineStep(
            key="projections",
            title="Projecting Gradients",
            description="Positive and negative gradients are multiplied along each axis. Only real grid lines \u2014 which have both dark-to-light and light-to-dark transitions \u2014 produce strong peaks.",
            image_base64=f"data:image/png;base64,{base64.b64encode(proj_png).decode()}",
        ))

        # Step 5: Detecting Grid Lines (only if detection succeeded)
        if success and intermediates['all_x'] and intermediates['all_y']:
            grid_png = viz_grid_lines(
                intermediates['working_image'],
                intermediates['all_x'],
                intermediates['all_y'],
            )
            steps.append(PipelineStep(
                key="grid_lines",
                title="Detecting Grid Lines",
                description="An adaptive threshold finds 7 equally-spaced interior lines per axis. Adding outer boundaries gives the full 9x9 grid.",
                image_base64=f"data:image/png;base64,{base64.b64encode(grid_png).decode()}",
            ))
        else:
            steps.append(PipelineStep(
                key="grid_lines",
                title="Detecting Grid Lines",
                description="Grid line detection was unsuccessful. The adaptive threshold could not find 7 equally-spaced interior lines per axis.",
                image_base64=None,
            ))

        # Step 6: Classifying Squares (text-only)
        steps.append(PipelineStep(
            key="classification",
            title="Classifying Squares",
            description="The detected board is divided into 64 squares (40x40 pixels each). A CNN ensemble classifies each square as one of 13 classes: 6 white pieces, 6 black pieces, or empty.",
            image_base64=None,
        ))

        return PipelineResponse(steps=steps)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing image in /predict/pipeline: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate pipeline visualization.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
