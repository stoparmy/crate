# Crate for Chatwoot

Crate is an embedded Chatwoot dashboard app that lists attachments for the currently open conversation and lets agents:

- open attachments in a new tab
- download all attachments from the current conversation

## Release Model

The default distribution target is a Docker image published to GitHub Container Registry:

```text
ghcr.io/stoparmy/crate
```

Published images are runtime-slug aware. The same image can be mounted at `/crate/`, `/shared-attachments/`, or another fixed slug on the same host as Chatwoot.

Releases are managed with `semantic-release`. A qualifying commit pushed to `main` creates a GitHub release and publishes matching Docker image tags.

## Environment

Copy `.env.example` to `.env` and set:

- `CHATWOOT_BASE_URL`: public Chatwoot base URL, for example `https://helpdesk.example.org`
- `CHATWOOT_APP_TOKEN`: Chatwoot app token for the installed Crate dashboard app
- `PORT`: optional server port, defaults to `3000`

## Local Development

Install and run each package separately:

```bash
cd server && npm install
cd ../web && npm install
```

Build the server:

```bash
cd server && npm run build
```

Build the web app:

```bash
cd web && npm run build
```

Run the production container locally:

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

The health endpoint is `GET /api/health`.

## Embedding in Chatwoot

Crate expects to run behind the same origin as Chatwoot, mounted at a fixed slug. The slug is chosen at deploy time by your reverse proxy, not at image build time.

The embedded dashboard flow relies on:

- the `cw_d_session_info` cookie
- the configured `CHATWOOT_APP_TOKEN`
- the Chatwoot dashboard auth headers `access-token`, `token-type`, `client`, `expiry`, and `uid`
- Chatwoot `postMessage` context for the currently open conversation

When reverse proxying, forward the chosen slug directly to the Crate container. The app derives asset and API paths from its mounted URL at runtime.

Example nginx location block:

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

If you want a different slug, replace `/crate/` consistently in your proxy config. Keep the redirect from `/slug` to `/slug/` so relative asset and API URLs resolve correctly.

## Publishing

GitHub Actions runs `semantic-release` from `.github/workflows/publish-image.yml`.

- pushes to `main` analyze commit messages and cut a release when needed
- each release publishes GitHub release notes plus Docker image tags for `latest`, `<major>`, `<major>.<minor>`, and `<major>.<minor>.<patch>`
- the Docker image version is derived from the semantic-release version, so Git tags, GitHub releases, and GHCR tags stay aligned

If the repository lives at `stoparmy/crate`, the published image path is `ghcr.io/stoparmy/crate`.

Crate now expects Conventional Commit style messages on changes that should affect released versions:

- `fix:` creates a patch release
- `feat:` creates a minor release
- `BREAKING CHANGE:` or `!` creates a major release

Commits that do not match the configured release rules will not publish a new version.

## First Release Checklist

1. Enable GitHub Actions for the repository.
2. Ensure the package visibility/settings for GHCR are acceptable for your audience.
3. Merge or push a Conventional Commit to `main` to trigger the first semantic release.
4. Confirm the resulting GitHub release and GHCR tags, for example `latest`, `1`, `1.2`, and `1.2.3`.
5. Give downstream users the nginx snippet plus the required `CHATWOOT_BASE_URL` and `CHATWOOT_APP_TOKEN` settings.
