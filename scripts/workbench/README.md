# Vertex AI Workbench setup

## 1. Upload post-startup script to Cloud Storage

```bash
PROJECT_ID="<your-project-id>"
ZONE="us-central1-b"
BUCKET_NAME="<your-bucket-name>"

WORKSPACE_NAME="<your-folder-name>"
WORKBENCH_PREFIX="projects/${WORKSPACE_NAME}/workbench"
REPO_PREFIX="projects/${WORKSPACE_NAME}/repo"
RUNS_PREFIX="projects/${WORKSPACE_NAME}/runs"
STARTUP_SCRIPT_URI="gs://${BUCKET_NAME}/${WORKBENCH_PREFIX}/post-startup.sh"

gcloud config set project "${PROJECT_ID}"
gcloud services enable notebooks.googleapis.com aiplatform.googleapis.com compute.googleapis.com storage.googleapis.com
gsutil cp scripts/workbench/post-startup.sh "${STARTUP_SCRIPT_URI}"
```

Note:
- The Workbench VM service account must be able to read `gs://${BUCKET_NAME}/${WORKBENCH_PREFIX}/post-startup.sh` (for example, `roles/storage.objectViewer` on the bucket or prefix).
- `WORKSPACE_NAME` is your own path label in the bucket, not a Google Cloud resource ID.

## 2. Create Workbench instance with startup metadata

```bash
WORKSPACE_NAME="<your-folder-name>"
BUCKET_NAME="<your-bucket-name>"
WORKBENCH_PREFIX="projects/${WORKSPACE_NAME}/workbench"
STARTUP_SCRIPT_URI="gs://${BUCKET_NAME}/${WORKBENCH_PREFIX}/post-startup.sh"
INSTANCE_NAME="election-2026-wb"

gcloud workbench instances create "${INSTANCE_NAME}" \
  --location="${ZONE}" \
  --machine-type="n2d-standard-4" \
  --boot-disk-type="PD_BALANCED" \
  --boot-disk-size="150" \
  --data-disk-type="PD_BALANCED" \
  --data-disk-size="100" \
  --vm-image-project="cloud-notebooks-managed" \
  --vm-image-family="workbench-instances" \
  --metadata="post-startup-script=${STARTUP_SCRIPT_URI},post-startup-script-behavior=run_once,post-startup-script-user=jupyter"
```

## 3. Optional metadata knobs

- `REPO_URL`: clone source repo (default: `https://github.com/mu373/election-202602-shugiin.git`)
- `REPO_BRANCH`: branch to checkout (default: `main`)
- `REPO_DIR`: local path on VM (default: `/home/jupyter/election-2026-analysis`)
- `PYTHON_VERSION`: Python runtime for `uv` (default: `3.11`)
- `RUN_BOOTSTRAP_DATA`: set `1` to run `scripts/download/download_all.sh` at startup

Example:

```bash
gcloud workbench instances update "${INSTANCE_NAME}" \
  --location="${ZONE}" \
  --metadata="post-startup-script=${STARTUP_SCRIPT_URI},post-startup-script-behavior=run_every_start,post-startup-script-user=jupyter,REPO_BRANCH=main,RUN_BOOTSTRAP_DATA=0"
```

## 4. Verify on VM

```bash
sudo tail -n 200 /var/log/workbench-post-startup.log
```

If kernel registration failed with `unrecognized arguments: --replace`, run:

```bash
cd /home/jupyter/election-2026-analysis
source .venv/bin/activate
jupyter kernelspec remove -f election-2026-analysis || true
python -m ipykernel install --user --name election-2026-analysis --display-name "Python (election-2026-analysis)"
```

Jupyter kernel should appear as:
- `Python (election-2026-analysis)`

## 5. Persist experiment artifacts to Cloud Storage

If you want to review results locally first and commit later, archive outputs to GCS per run:

```bash
# On the Workbench VM
WORKSPACE_NAME="<your-folder-name>"
BUCKET_NAME="<your-bucket-name>"
RUNS_PREFIX="projects/${WORKSPACE_NAME}/runs"
EXP_ROOT="gs://${BUCKET_NAME}/${RUNS_PREFIX}"
export RUN_ID="$(date +%Y%m%d-%H%M%S)"

gsutil -m rsync -r analysis/output "${EXP_ROOT}/${RUN_ID}/output/"
gsutil -m rsync -r analysis/notebooks "${EXP_ROOT}/${RUN_ID}/notebooks/"
```

This keeps a timestamped backup in `gs://<your-bucket-name>/projects/<your-folder-name>/runs/` while preserving your choice to commit selected files afterward.
