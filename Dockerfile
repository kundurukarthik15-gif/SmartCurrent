# Root Dockerfile for Backend Service
FROM python:3.10-slim

# Set environment variable to optimize python output buffering
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies
COPY backend/requirements.txt /app/

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code files
COPY backend /app/backend
COPY ml /app/ml
COPY database /app/database

# Expose FastAPI default port
EXPOSE 8000

# Set Python Path to resolve modules
ENV PYTHONPATH=/app/backend:/app

# Start server using the app directory setting
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/backend"]
