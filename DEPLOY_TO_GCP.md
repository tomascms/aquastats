# Deploy Aquastats to Google Cloud Run

## Prerequisites
```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

## Deploy Backend API

```bash
cd /c/Users/tcmso/Desktop/app

# Build and deploy API
gcloud run deploy aquastats-api \
  --source api/ \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 3600
```

## Deploy Frontend

```bash
cd /c/Users/tcmso/Desktop/app/web

# Build
npm run build

# Deploy to Cloud Run (use Node.js server)
gcloud run deploy aquastats-web \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 256Mi
```

## Environment Variables

Set in Cloud Run console:
- `NEXT_PUBLIC_API_URL` → `https://aquastats-api-XXXXX.run.app`
- `NEXT_PUBLIC_ENVIRONMENT` → `production`

## Result

- API: `https://aquastats-api-XXXXX.run.app`
- Web: `https://aquastats-web-XXXXX.run.app`

Replace `XXXXX` with your Cloud Run service names.
