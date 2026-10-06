# Docker server runtime

This compose file is the Docker deployment path for a self-hosted Imigrasi24jam server.

## Services

- `db`: persistent PostgreSQL 16 volume.
- `app`: canonical Imigrasi24jam runtime, bound to localhost only.
- `migrate`: manual migration profile; it is intentionally not started by default.
- `cloudflared`: optional named Cloudflare Tunnel profile; starts only after `app` is healthy.

## First deployment

1. Copy `.env.server.example` to `.env`.
2. Set a long random `POSTGRES_PASSWORD`.
3. Set the named Cloudflare Tunnel token only when the tunnel gate is authorized.
4. Start PostgreSQL and application:

```bash
docker compose -f docker-compose.server.yml up -d db app
```

5. Verify the local runtime:

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/readyz
```

6. Apply migrations only after the migration gate is explicitly authorized:

```bash
docker compose -f docker-compose.server.yml --profile migration run --rm migrate
```

7. Re-check `/readyz`. It must report database and schema as `ok`.

8. Only after readiness is proven, start the named tunnel:

```bash
docker compose -f docker-compose.server.yml --profile tunnel up -d cloudflared
```

## Safety boundary

This file does not publish PostgreSQL to the Internet. The application is bound to `127.0.0.1`, and public ingress is exclusively through Cloudflare Tunnel.

Do not commit `.env` or the real tunnel token.
