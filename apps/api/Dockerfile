FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    PYTHONPATH=/app/src

WORKDIR /app

# xgboost needs the OpenMP runtime, which slim images don't ship.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src ./src
COPY db ./db

RUN useradd --system --uid 10001 app
USER app

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers"]
