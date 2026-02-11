#!/usr/bin/env bash
set -euo pipefail

# Vertex AI Workbench post-startup script for this repository.
# - Installs system deps used by geopandas/pymc workflows
# - Clones or updates repo
# - Creates/updates project virtualenv via uv
# - Registers Jupyter kernel
# - Optionally runs data download pipeline

LOG_FILE="/var/log/workbench-post-startup.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[INFO] $(date -Is) post-startup begin"

JUPYTER_USER="${JUPYTER_USER:-jupyter}"
JUPYTER_HOME="$(getent passwd "${JUPYTER_USER}" | cut -d: -f6 || true)"
if [[ -z "${JUPYTER_HOME}" ]]; then
  JUPYTER_HOME="/home/${JUPYTER_USER}"
fi

REPO_URL="${REPO_URL:-https://github.com/mu373/election-202602-shugiin.git}"
REPO_DIR="${REPO_DIR:-${JUPYTER_HOME}/election-2026-analysis}"
REPO_BRANCH="${REPO_BRANCH:-main}"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
KERNEL_NAME="${KERNEL_NAME:-election-2026-analysis}"
KERNEL_DISPLAY_NAME="${KERNEL_DISPLAY_NAME:-Python (election-2026-analysis)}"
RUN_BOOTSTRAP_DATA="${RUN_BOOTSTRAP_DATA:-0}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  g++ \
  gcc \
  gdal-bin \
  git \
  graphviz \
  libgdal-dev \
  libgeos-dev \
  libproj-dev \
  pkg-config \
  unzip

run_as_jupyter() {
  sudo -u "${JUPYTER_USER}" -H bash -lc "$*"
}

run_as_jupyter 'mkdir -p "${HOME}/.local/bin"'

if ! run_as_jupyter 'command -v uv >/dev/null 2>&1'; then
  run_as_jupyter 'curl -LsSf https://astral.sh/uv/install.sh | sh'
fi

if [[ -d "${REPO_DIR}/.git" ]]; then
  run_as_jupyter "git -C '${REPO_DIR}' fetch --all --prune"
  run_as_jupyter "git -C '${REPO_DIR}' checkout '${REPO_BRANCH}' || git -C '${REPO_DIR}' checkout -b '${REPO_BRANCH}' 'origin/${REPO_BRANCH}'"
  run_as_jupyter "git -C '${REPO_DIR}' pull --ff-only origin '${REPO_BRANCH}' || true"
else
  run_as_jupyter "git clone --branch '${REPO_BRANCH}' '${REPO_URL}' '${REPO_DIR}'"
fi

run_as_jupyter "
  export PATH=\"\${HOME}/.local/bin:\${PATH}\"
  cd '${REPO_DIR}'
  uv python install '${PYTHON_VERSION}'
  uv venv --python '${PYTHON_VERSION}' .venv
  uv sync --frozen
  source .venv/bin/activate
  jupyter kernelspec remove -f '${KERNEL_NAME}' >/dev/null 2>&1 || true
  python -m ipykernel install --user --name '${KERNEL_NAME}' --display-name '${KERNEL_DISPLAY_NAME}'
"

if [[ "${RUN_BOOTSTRAP_DATA}" == "1" ]]; then
  run_as_jupyter "
    export PATH=\"\${HOME}/.local/bin:\${PATH}\"
    cd '${REPO_DIR}'
    bash scripts/download/download_all.sh
  "
fi

echo "[INFO] $(date -Is) post-startup completed"
