# Daily stats backend

Powers the postgame "Top X% of players" line. It's one Cloud Run function (`index.js`, gen2 Cloud Functions) plus a Firestore database, in the GCP project `crawsword-stats`. `deploy.sh` deploys it; nothing in the Angular build or Amplify deploys it.

## Deploy

```bash
./deploy.sh                      # or ./deploy.sh <project-id>
```

The script enables the APIs, creates the `(default)` Firestore database (native mode, `us-west1`) if it's missing, deploys the function publicly with **max 2 instances**, and prints its URL. The instance cap limits the request rate, which also limits the worst-case bill from abuse. Put the URL into `statsApiUrl` in `src/environments/environment.prod.ts` (and `environment.ts` to try it locally).

CORS is handled in the function. By default it allows any origin. To lock it to the app, redeploy with a comma-separated list:

```bash
ALLOWED_ORIGINS='https://main.xxxx.amplifyapp.com,http://localhost:4200' ./deploy.sh
```

The script also sets a cleanup policy on the `gcf-artifacts` image repository. It deletes images older than 7 days but always keeps the 2 newest, so repeated deploys don't build up storage costs.

A **$5/month** budget, "crawsword-stats monthly", is scoped to this project. It emails the billing account's admins at 50%, 90% and 100% of actual spend, and when the forecast passes 100%. The budget only alerts; it doesn't stop anything. It was created once by hand:

```bash
gcloud billing budgets create --billing-account=<billing-account-id> \
  --display-name="crawsword-stats monthly" --budget-amount=5USD \
  --filter-projects=projects/crawsword-stats \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 --threshold-rule=percent=1.0,basis=forecasted-spend
```

## Data

Each puzzle is one document, `daily/<puzzle>`, holding a score histogram: `{ total, s700, s680, ... }`. A POST increments `total` and `s<score>` atomically with `FieldValue.increment`, then reads the document back. Both methods reply `{ total, place, topPercent }` for the given score (`rank.js`): ties share the best place, so everyone tied for the day's best is #1 and top 1%.

## Smoke test

```bash
URL=$(gcloud functions describe crawsword-stats --gen2 --region=us-west1 --project=crawsword-stats --format='value(serviceConfig.uri)')
curl -s -X POST "$URL" -H 'content-type: application/json' -d '{"puzzle":<today>,"score":600}'
curl -s "$URL?puzzle=<today>&score=600"
```

`<today>` is the puzzle number shown in the game ("Crawsword #N"). The API accepts only today's puzzle, give or take a day, and scores from 0 to 700. Anything else gets a 400.

## Run locally

```bash
npm install
gcloud auth application-default login   # Firestore credentials
GOOGLE_CLOUD_PROJECT=crawsword-stats npm start   # http://localhost:8080
```

## Expected cost

It's $0 when idle, and it stays inside the free tiers at normal traffic. Firestore's free tier covers 20k writes and 50k reads a day, and each game costs one write and one read. Cloud Run's free tier covers 2M requests a month.
