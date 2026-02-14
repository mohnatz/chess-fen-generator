"""
FEN Generator Module

Handles:
- Model loading and inference
- FEN notation conversion
- Analysis link generation
"""

import numpy as np
import urllib.parse
from pathlib import Path
from skimage import transform
from skimage.util.shape import view_as_blocks

import keras
import tensorflow as tf


SQUARE_SIZE = 40
PIECE_SYMBOLS = 'prbnkqPRBNKQ'

# Default model path (relative to this file)
DEFAULT_MODEL_PATH = Path(__file__).parent / 'models' / 'ensemble_medium.keras'


def weighted_categorical_crossentropy(weights):
    """Custom loss function for loading the model."""
    weights = tf.constant(weights, dtype=tf.float32)

    def loss(y_true, y_pred):
        y_pred = y_pred / tf.reduce_sum(y_pred, axis=-1, keepdims=True)
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        loss = y_true * tf.math.log(y_pred) * weights
        loss = -tf.reduce_sum(loss, axis=-1)
        return loss

    return loss


def load_model(model_path: str | Path | None = None) -> keras.Model:
    """Load the chess piece recognition model.

    Args:
        model_path: Path to the model file. If None, uses default path.

    Returns:
        Loaded Keras model
    """
    if model_path is None:
        model_path = DEFAULT_MODEL_PATH

    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at: {model_path}")

    try:
        model = keras.models.load_model(model_path)
    except Exception:
        # Try with custom objects for weighted loss
        weights = np.array([
            1/(0.30*4), 1/(0.20*4), 1/(0.20*4), 1/(0.20*4), 1/1, 1/(0.10*4),
            1/(0.30*4), 1/(0.20*4), 1/(0.20*4), 1/(0.20*4), 1/1, 1/(0.10*4),
            1/(64-10)
        ])
        model = keras.models.load_model(
            model_path,
            custom_objects={'loss': weighted_categorical_crossentropy(weights)}
        )

    return model


def process_board_for_model(board_image: np.ndarray) -> np.ndarray:
    """Process cropped board into 64 squares (64, 40, 40, 3) for model prediction.

    Args:
        board_image: Cropped board image (RGB)

    Returns:
        Array of shape (64, 40, 40, 3) containing the 64 squares
    """
    downsample_size = SQUARE_SIZE * 8  # 320
    if board_image.max() > 1.0:
        board_image = board_image.astype(np.float32) / 255.0
    resized = transform.resize(board_image, (downsample_size, downsample_size), mode='constant')
    tiles = view_as_blocks(resized, block_shape=(SQUARE_SIZE, SQUARE_SIZE, 3))
    tiles = tiles.squeeze(axis=2)
    return tiles.reshape(64, SQUARE_SIZE, SQUARE_SIZE, 3)


def onehot_to_fen(one_hot: np.ndarray) -> str:
    """Convert one-hot encoded board (8x8) to simplified FEN string.

    Args:
        one_hot: 8x8 array of piece indices (0-12, where 12=empty)

    Returns:
        Simplified FEN string (ranks separated by dashes)
    """
    output = ''
    for j in range(8):
        for i in range(8):
            if one_hot[j][i] == 12:
                output += ' '
            else:
                output += PIECE_SYMBOLS[one_hot[j][i]]
        if j != 7:
            output += '-'
    for i in range(8, 0, -1):
        output = output.replace(' ' * i, str(i))
    return output


def simplified_fen_to_standard(simple_fen: str, active_color: str = 'w',
                               castling: str = 'KQkq', en_passant: str = '-',
                               halfmove: int = 0, fullmove: int = 1) -> str:
    """Convert simplified FEN to standard FEN notation.

    Args:
        simple_fen: Simplified FEN (ranks separated by dashes)
        active_color: 'w' or 'b'
        castling: Castling availability
        en_passant: En passant target square
        halfmove: Halfmove clock
        fullmove: Fullmove number

    Returns:
        Standard FEN string
    """
    board_fen = simple_fen.replace('-', '/')
    return f"{board_fen} {active_color} {castling} {en_passant} {halfmove} {fullmove}"


def create_lichess_editor_link(simple_fen: str, active_color: str = 'w') -> str:
    """Create Lichess board editor link."""
    standard_fen = simplified_fen_to_standard(simple_fen, active_color=active_color)
    lichess_fen = standard_fen.replace(' ', '_')
    return f"https://lichess.org/editor/{lichess_fen}"


def create_lichess_analysis_link(simple_fen: str, active_color: str = 'w') -> str:
    """Create Lichess analysis link."""
    standard_fen = simplified_fen_to_standard(simple_fen, active_color=active_color)
    lichess_fen = standard_fen.replace(' ', '_')
    return f"https://lichess.org/analysis/{lichess_fen}"


def create_chesscom_link(simple_fen: str, active_color: str = 'w') -> str:
    """Create Chess.com analysis link."""
    standard_fen = simplified_fen_to_standard(simple_fen, active_color=active_color)
    encoded_fen = urllib.parse.quote(standard_fen)
    return f"https://www.chess.com/analysis?fen={encoded_fen}"


def predict_fen(model: keras.Model, board_image: np.ndarray, active_color: str = 'w') -> dict:
    """Run model inference on cropped board and generate FEN.

    Args:
        model: Loaded Keras model
        board_image: Cropped board image (RGB)

    Returns:
        Dictionary containing:
        - fen: Simplified FEN string
        - fen_standard: Standard FEN string
        - confidences: Per-square confidence array (64,)
        - avg_confidence: Average confidence
        - min_confidence: Minimum confidence
        - low_confidence_squares: List of squares with confidence < 80%
        - links: Dictionary with lichess_editor, lichess_analysis, chesscom URLs
    """
    squares = process_board_for_model(board_image)
    predictions = model.predict(squares, verbose=0)
    predicted_classes = predictions.argmax(axis=1)
    confidences = predictions.max(axis=1) / 3  # ensemble of 3 models

    predicted_board = predicted_classes.reshape(8, 8)
    fen_simple = onehot_to_fen(predicted_board)
    fen_standard = simplified_fen_to_standard(fen_simple, active_color=active_color)

    avg_conf = float(confidences.mean())
    min_conf = float(confidences.min())

    # Find low confidence squares
    low_conf_indices = np.where(confidences < 0.80)[0]
    low_conf_squares = []
    for idx in low_conf_indices:
        row, col = idx // 8, idx % 8
        piece_idx = predicted_classes[idx]
        piece = PIECE_SYMBOLS[piece_idx] if piece_idx < 12 else 'empty'
        low_conf_squares.append({
            'row': int(row),
            'col': int(col),
            'piece': piece,
            'confidence': float(confidences[idx])
        })

    return {
        'fen': fen_simple,
        'fen_standard': fen_standard,
        'confidences': confidences.tolist(),
        'avg_confidence': avg_conf,
        'min_confidence': min_conf,
        'low_confidence_squares': low_conf_squares,
        'links': {
            'lichess_editor': create_lichess_editor_link(fen_simple, active_color),
            'lichess_analysis': create_lichess_analysis_link(fen_simple, active_color),
            'chesscom': create_chesscom_link(fen_simple, active_color)
        }
    }
