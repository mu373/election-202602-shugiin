#!/usr/bin/env bash
set -euo pipefail

# Vertex AI Workbench post-startup script for this repository.
# - Installs system deps used by geopandas/pymc workflows
# - Clones or updates repo
# - Creates/updates project environment via uv or conda
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
ENV_MANAGER="${ENV_MANAGER:-uv}" # uv | conda
CONDA_ENV_NAME="${CONDA_ENV_NAME:-election-pymc}"

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

if [[ -d "${REPO_DIR}/.git" ]]; then
  run_as_jupyter "git -C '${REPO_DIR}' fetch --all --prune"
  run_as_jupyter "git -C '${REPO_DIR}' checkout '${REPO_BRANCH}' || git -C '${REPO_DIR}' checkout -b '${REPO_BRANCH}' 'origin/${REPO_BRANCH}'"
  run_as_jupyter "git -C '${REPO_DIR}' pull --ff-only origin '${REPO_BRANCH}' || true"
else
  run_as_jupyter "git clone --branch '${REPO_BRANCH}' '${REPO_URL}' '${REPO_DIR}'"
fi

if [[ "${ENV_MANAGER}" == "uv" ]]; then
  if ! run_as_jupyter 'command -v uv >/dev/null 2>&1'; then
    run_as_jupyter 'curl -LsSf https://astral.sh/uv/install.sh | sh'
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
elif [[ "${ENV_MANAGER}" == "conda" ]]; then
  run_as_jupyter "
    set -euo pipefail
    if [ -f /opt/conda/etc/profile.d/conda.sh ]; then
      source /opt/conda/etc/profile.d/conda.sh
    elif [ -f \"\${HOME}/miniforge3/etc/profile.d/conda.sh\" ]; then
      source \"\${HOME}/miniforge3/etc/profile.d/conda.sh\"
    else
      echo '[ERROR] conda.sh not found. Set ENV_MANAGER=uv or install conda.'
      exit 1
    fi

    cd '${REPO_DIR}'
    if ! command -v mamba >/dev/null 2>&1; then
      conda install -n base -c conda-forge mamba -y
    fi

    if [ -f environment.yml ]; then
      mamba env update -n '${CONDA_ENV_NAME}' -f environment.yml --prune
    else
      mamba create -n '${CONDA_ENV_NAME}' -c conda-forge \
        python='${PYTHON_VERSION}' \
        pymc pytensor arviz numpy pandas scipy scikit-learn \
        geopandas pyproj shapely libpysal graphviz ipykernel \
        'blas=*=openblas' -y
    fi

    CONDA_BASE=\$(conda info --base)
    TARGET_ENV_DIR=\"\${CONDA_BASE}/envs/${CONDA_ENV_NAME}\"
    mkdir -p \"\${TARGET_ENV_DIR}/etc/conda/activate.d\"
    cat > \"\${TARGET_ENV_DIR}/etc/conda/activate.d/pytensor-blas.sh\" <<'EOF'
export PYTENSOR_FLAGS=\"blas__ldflags=-L\${CONDA_PREFIX}/lib -lopenblas\"
EOF

    jupyter kernelspec remove -f '${KERNEL_NAME}' >/dev/null 2>&1 || true
    conda run -n '${CONDA_ENV_NAME}' python -m ipykernel install --user --name '${KERNEL_NAME}' --display-name '${KERNEL_DISPLAY_NAME}'
  "
else
  echo "[ERROR] Unsupported ENV_MANAGER='${ENV_MANAGER}'. Use 'uv' or 'conda'."
  exit 1
fi

if [[ "${RUN_BOOTSTRAP_DATA}" == "1" ]]; then
  run_as_jupyter "
    export PATH=\"\${HOME}/.local/bin:\${PATH}\"
    cd '${REPO_DIR}'
    bash scripts/download/download_all.sh
  "
fi

echo "[INFO] $(date -Is) post-startup completed"
