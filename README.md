# Crate for Chatwoot

Crate is an embedded Chatwoot dashboard app for browsing conversation attachments. Agents can open files in a new tab and download all attachments from the current conversation.

## Docker Image

Crate is published as a Docker image:

```text
ghcr.io/stoparmy/crate
```

The image is runtime-slug aware. You can mount it at `/crate/`, `/attachments/`, or another fixed slug on the same Chatwoot host.

## Configuration

Copy `.env.example` to `.env` and set:

- `CHATWOOT_BASE_URL`: public Chatwoot base URL, for example `https://helpdesk.example.org`
- `CHATWOOT_APP_TOKEN`: Chatwoot app token for the installed Crate dashboard app
- `PORT`: optional server port, defaults to `3000`

## Local Development

Install dependencies:

```bash
cd server && npm install
cd ../web && npm install
```

Build the app:

```bash
cd server && npm run build
cd ../web && npm run build
```

Run it with Docker Compose:

```bash
docker compose up --build
```

Run the published image directly:

```bash
docker run --rm -p 3000:3000 \
  -e CHATWOOT_BASE_URL=https://helpdesk.example.org \
  -e CHATWOOT_APP_TOKEN=your-chatwoot-app-token \
  ghcr.io/stoparmy/crate:latest
```

Health check:

```text
GET /api/health
```

## Chatwoot Embedding

Crate runs behind the same origin as Chatwoot and receives dashboard context from the parent app.

It relies on:

- the `cw_d_session_info` cookie
- `CHATWOOT_APP_TOKEN`
- the Chatwoot dashboard auth headers `access-token`, `token-type`, `client`, `expiry`, and `uid`
- Chatwoot `postMessage` context for the active conversation

When reverse proxying, forward the chosen slug to the Crate container and keep the trailing-slash redirect so relative asset and API paths resolve correctly.

Example nginx config:

```nginx
location = /crate {
  return 302 /crate/;
}

location /crate/ {
  proxy_pass http://crate:3000/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Ssl on;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_http_version 1.1;
  proxy_buffering off;
}
```

The same example is available at `examples/nginx/chatwoot-crate.conf`.

## Releases

GitHub Actions runs `semantic-release` from `.github/workflows/publish-image.yml`.

Each release creates:

- a GitHub release
- a `latest` image tag
- semver image tags such as `<major>`, `<major>.<minor>`, and `<major>.<minor>.<patch>`

Release versions come from Conventional Commit messages on `main`:

- `fix:` for patch releases
- `feat:` for minor releases
- `BREAKING CHANGE:` or `!` for major releases
