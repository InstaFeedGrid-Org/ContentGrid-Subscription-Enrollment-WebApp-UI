# ContentGrid Instagram Publisher UI

A sample web UI for collecting basic post details and triggering a server endpoint that publishes content to Instagram.

## Run Locally

```bash
npm install
npm run web
```

Open `http://localhost:8081`.

## Instagram Publishing

The publisher form sends a `POST` request to `/publish-instagram`.

Required content fields:

- `imageUrl`: a public `http` or `https` image URL
- `caption`: the caption to publish

Instagram Graph API credentials can be provided either through the form for a demo run or through environment variables:

```bash
IG_USER_ID=your-instagram-user-id
IG_ACCESS_TOKEN=your-access-token
```

When credentials are missing, the endpoint returns a dry-run success response so the UI flow can still be tested.
