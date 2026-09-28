# Daily stats backend

Powers the postgame "Top X% of N players today" line. It's one Lambda (`index.mjs`) behind a Function URL, plus one DynamoDB table. Everything is created by hand in the AWS console; nothing in the Angular build or Amplify deploys it.

## One-time setup

1. **DynamoDB → Create table**
   - Name: `crawsword-daily`
   - Partition key: `puzzle` (Number)
   - Table settings: Customize → **On-demand** capacity
2. **Lambda → Create function**
   - Name: `crawsword-stats`, runtime **Node.js 22.x**, "Create a new role with basic Lambda permissions"
   - Code: replace the default `index.mjs` with this folder's `index.mjs` → Deploy
   - Configuration → Environment variables: `TABLE_NAME` = `crawsword-daily` (optional; that's the default)
   - Configuration → Concurrency → **Reserved concurrency: 2**. This caps the request rate, which also caps the worst-case bill from abuse at about $200/month.
3. **Permissions**: Configuration → Permissions → click the role → Add permissions → Create inline policy (JSON):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["dynamodb:UpdateItem", "dynamodb:GetItem"],
       "Resource": "arn:aws:dynamodb:<region>:<account-id>:table/crawsword-daily"
     }]
   }
   ```
4. **Function URL**: Configuration → Function URL → Create
   - Auth type: **NONE**
   - Configure CORS: on
     - Allow origin: your Amplify domain (e.g. `https://main.xxxx.amplifyapp.com` and any custom domain) and `http://localhost:4200`
     - Allow methods: `GET`, `POST`
     - Allow headers: `content-type`
   - Copy the URL into `statsApiUrl` in `src/environments/environment.prod.ts` (and `environment.ts` to try it locally).
5. **Billing → Budgets → Create budget**: a monthly cost budget of **$5** with an email alert.

## Smoke test

```bash
URL=https://<id>.lambda-url.<region>.on.aws/
curl -s -X POST "$URL" -H 'content-type: application/json' -d '{"puzzle":<today>,"score":900}'
curl -s "$URL?puzzle=<today>&score=900"
```

`<today>` is the puzzle number shown in the game ("Crawsword #N"). The API accepts only today's puzzle, give or take a day, and scores from 0 to 700. Anything else gets a 400.

## Expected cost

It's $0 when idle and about $0.30/month at 5k players/day. Each game costs one write (about 3 write units). Lambda stays inside its free tier until about 16k players/day.
