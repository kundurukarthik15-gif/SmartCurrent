# Stage 1: Build the frontend React app
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend

# Copy frontend configuration files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Define environment variables for the frontend build
ENV VITE_API_URL=/api
ENV VITE_SUPABASE_URL=https://vvfqioddzstswyemrypy.supabase.co
ENV VITE_SUPABASE_ANON_KEY=sb_publishable_k925XOIwi8hV8ics3d6CJw_JuZ0Q-AM

# Build the frontend static bundle
RUN npm run build

# Stage 2: Build the FastAPI backend and serve the built frontend assets
FROM python:3.10-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files and ML folders
COPY backend /app/backend
COPY ml /app/ml
COPY database /app/database

# Copy the compiled static frontend files into FastAPI's static folder
COPY --from=frontend-builder /frontend/dist /app/backend/app/static

# Expose API port
EXPOSE 8000

# Set Python Path
ENV PYTHONPATH=/app/backend:/app

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/backend"]
