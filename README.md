# Chess FEN Generator

A web app that converts chess board screenshots into [FEN notation](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation), with one-click links to analyse the position on Lichess or Chess.com.

Upload a screenshot from any chess website, and the app will:
1. **Detect** the board region using computer vision
2. **Recognise** the pieces using a CNN ensemble
3. **Output** the FEN string and analysis links

## How It Works

### Board Detection (Computer Vision)

The board detection pipeline is adapted from [kratos606/chessboard-recogniser](https://github.com/kratos606/chessboard-recogniser), which uses gradient projection to locate chessboard grid lines without relying on Hough transforms.

The pipeline:
1. **Rough crop** — contour-based isolation to find the board region in a full screenshot (handles browser UI, sidebars, etc.)
2. **Histogram equalisation** on grayscale, normalise to float
3. **Large-kernel Sobel gradients** (ksize=31) — smooths piece-level detail, emphasising grid edges
4. **Positive/negative gradient product** — sum positive and negative gradients separately along each axis, then multiply. Only real grid lines (which have both dark-to-light *and* light-to-dark transitions) produce strong peaks
5. **Adaptive thresholding + Gaussian blur + skeletonisation** to find peak positions
6. **Line pruning** to find 7 equally-spaced interior lines per axis (with missing-line interpolation for partial detections)
7. **Extend outward** by one step to get the 9 boundary lines (full board edges)

The `board_detection.ipynb` notebook walks through each step visually.

### Piece Recognition (CNN Ensemble)

A 4-layer CNN (833k parameters) classifies each of the 64 squares into 13 classes (6 white pieces + 6 black pieces + empty). The model uses:

- 40x40 pixel input per square
- Weighted categorical cross-entropy to handle class imbalance (empty squares dominate)
- K-fold cross-validation (3 folds) with the final model being an ensemble that averages predictions across all folds
- **100% board-level accuracy** on the test set (5,000 boards / 320,000 squares)

Training details are in `train_chess_model.ipynb` and evaluation in `test_chess_model.ipynb`.

### Dataset

The training data comes from the [Chess Positions](https://www.kaggle.com/datasets/koryakinp/chess-positions) dataset by Pavel Koryakin on Kaggle — 100,000 synthetically generated board images (80k train / 20k test) with FEN labels encoded in the filenames.

## Project Structure

```
chess_fen_generator/
├── board_detection.ipynb       # Board detection walkthrough (step-by-step)
├── train_chess_model.ipynb     # Model training notebook
├── test_chess_model.ipynb      # Model evaluation notebook
└── webapp/
    ├── backend/
    │   ├── app.py              # FastAPI server
    │   ├── board_detection.py  # Board detection module
    │   ├── fen_generator.py    # Model inference + FEN generation
    │   ├── models/             # Trained ensemble model (.keras)
    │   ├── Dockerfile
    │   └── requirements.txt
    └── frontend/
        ├── src/
        │   ├── app/page.tsx    # Main page
        │   └── components/     # DropZone, ResultCard
        ├── next.config.ts
        └── package.json
```

## Running Locally

### Backend

```bash
cd webapp/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd webapp/frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and expects the backend at `http://localhost:8000`.

### Docker (backend only)

```bash
cd webapp/backend
docker build -t chess-fen-backend .
docker run -p 8000:8000 chess-fen-backend
```

## Tech Stack

- **Backend:** FastAPI, TensorFlow/Keras, OpenCV, scikit-image, slowapi (rate limiting)
- **Frontend:** Next.js, TypeScript, Tailwind CSS, Framer Motion
- **ML:** CNN ensemble trained with K-fold cross-validation

## Acknowledgements

- Board detection approach adapted from [kratos606/chessboard-recogniser](https://github.com/kratos606/chessboard-recogniser)
- Training data from [Chess Positions](https://www.kaggle.com/datasets/koryakinp/chess-positions) by Pavel Koryakin
