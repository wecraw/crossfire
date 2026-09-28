#!/usr/bin/env bash
# Creates (idempotently) the Firestore database and deploys the stats function.
# Usage: ./deploy.sh [project-id]   (defaults to crawsword-stats)
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="${1:-crawsword-stats}"
REGION=us-west1
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-*}"

gcloud services enable run.googleapis.com cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com \
  --project="$PROJECT"

if ! gcloud firestore databases describe --database='(default)' --project="$PROJECT" >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" --type=firestore-native --project="$PROJECT"
fi

#max-instances caps the request rate, which also caps the worst-case bill from abuse
gcloud functions deploy crawsword-stats \
  --gen2 --runtime=nodejs22 --region="$REGION" --project="$PROJECT" \
  --source=. --entry-point=stats --trigger-http --allow-unauthenticated \
  --memory=256Mi --max-instances=2 \
  --set-env-vars="^|^ALLOWED_ORIGINS=$ALLOWED_ORIGINS"

#every deploy adds an image to gcf-artifacts: drop anything older than a week,
#but always keep the 2 newest versions (the live one included)
POLICY=$(mktemp)
cat > "$POLICY" <<'EOF'
[
  {"name": "delete-old", "action": {"type": "Delete"}, "condition": {"tagState": "any", "olderThan": "7d"}},
  {"name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}}
]
EOF
gcloud artifacts repositories set-cleanup-policies gcf-artifacts --location="$REGION" \
  --project="$PROJECT" --policy="$POLICY" --no-dry-run >/dev/null
rm -f "$POLICY"

gcloud functions describe crawsword-stats --gen2 --region="$REGION" --project="$PROJECT" \
  --format='value(serviceConfig.uri)'
