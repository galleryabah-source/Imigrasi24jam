# Production Runtime — Docker + Cloudflare Tunnel

## Scope

This runtime boundary adds infrastructure around the existing canonical application. It does not change the canonical inbox → conversation → outbox → audit lifecycle or the PostgreSQL schema/migrations.

## Runtime entrypoint

The Docker entrypoint is:

    node src/runtime/server.js

Endpoints:

- GET /healthz — process liveness only; no database dependency.
- GET /readyz — production readiness; requires DATABASE_URL and executes SELECT 1.
- unknown routes return 404.

The WhatsApp webhook route is intentionally not invented at this stage. The repository has canonical webhook/reconciliation domain functions, but it does not yet contain a complete production provider adapter plus conversation-persistence composition that can be safely wired into an HTTP endpoint without creating a competing lifecycle.

## Docker

Prepare the host environment:

    cp .env.example .env

Set the real production DATABASE_URL in .env. Never commit the real .env.

Build and start the origin:

    docker compose build
    docker compose up -d app
    docker compose ps
    docker compose logs --tail=100 app

Verify locally:

    curl http://127.0.0.1:8080/healthz
    curl http://127.0.0.1:8080/readyz

Expected:
- /healthz returns HTTP 200.
- /readyz returns HTTP 200 only when the configured PostgreSQL endpoint is reachable.

Port 8080 is bound to loopback only. The application is therefore not directly published to the LAN/Internet.

## Cloudflare Tunnel

Use a remotely-managed Cloudflare Tunnel for the Docker deployment. Cloudflare recommends remotely-managed tunnels for Docker. Configure the public hostname/published application route in Cloudflare to point to:

    http://app:8080

Store the tunnel token only in the host environment or a secret mechanism.

Start the tunnel after the application is healthy:

    docker compose --profile tunnel up -d
    docker compose ps
    docker compose logs --tail=100 cloudflared

No inbound origin port is required; cloudflared establishes outbound connections to Cloudflare.

## Gate order

1. Build the image.
2. Verify local /healthz.
3. Verify local /readyz against the new production Supabase PostgreSQL.
4. Confirm the Cloudflare Tunnel is Healthy.
5. Verify the public hostname reaches /healthz.
6. Wire the real WhatsApp provider adapter and HTTP webhook only after its composition is complete.
7. Run real WhatsApp E2E.
8. Execute final production smoke test.

## Security constraints

- Do not publish port 8080 directly to the Internet.
- Do not commit .env or Cloudflare tunnel tokens.
- Keep DATABASE_URL outside the image.
- Do not add a second message lifecycle in the HTTP layer.
- Do not add schema changes as part of this runtime work.
