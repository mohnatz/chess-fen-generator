FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY board_detection.py .
COPY fen_generator.py .
COPY pipeline_viz.py .

# Copy model
COPY models/ ./models/

# Run as non-root user
RUN useradd -r -u 1000 -s /usr/sbin/nologin appuser
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
