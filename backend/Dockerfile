# One image for every NOVA backend service (D33).
FROM ghcr.io/astral-sh/uv:0.12.18 AS uv

FROM python:3.12.14-slim
COPY --from=uv /uv /uvx /usr/local/bin/

# The venv lives outside /repo so the backend-check bind mount replaces the code, not the venv.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/tmp/uv-cache \
    RUFF_CACHE_DIR=/tmp/ruff-cache \
    MYPY_CACHE_DIR=/tmp/mypy-cache \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH

RUN useradd --create-home --uid 10001 nova \
    && mkdir -p /opt/venv /repo/backend \
    && chown nova:nova /opt/venv /repo/backend

WORKDIR /repo/backend
COPY --chown=nova:nova . .
USER nova
RUN uv sync --frozen && rm -rf /tmp/uv-cache

EXPOSE 8000
CMD ["uvicorn", "nova_core.main:app", "--host", "0.0.0.0", "--port", "8000"]
