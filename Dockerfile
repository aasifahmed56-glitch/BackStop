# Multi-stage Dockerfile for Backstop (Frontend + Backend)

# Stage 1: Build React SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python FastAPI Backend
FROM python:3.11-slim
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source, data, and seed cache
COPY backend ./backend

# Copy built frontend assets so FastAPI serves them from frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default port 8000 or $PORT from Render
EXPOSE 8000

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-8000} --app-dir backend"
