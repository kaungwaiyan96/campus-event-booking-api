# Campus Event Management & Booking API

A TypeScript REST backend for campus event discovery, organizer management, student RSVPs, and service-to-service venue availability checks. Every HTTP endpoint uses `/events-api/v1`.

## Architecture

```mermaid
flowchart LR
    Client[Web / Mobile / Postman] --> Nginx[Nginx HTTPS reverse proxy]
    Peer[Peer campus service] -->|x-api-key| Nginx
    Nginx --> Node[Node.js / Express in Docker]
    Node --> Prisma[Prisma ORM]
    Prisma --> DB[(PostgreSQL 16)]
    Node --> Entra[Microsoft Entra ID]
    Node --> Vault[Azure Key Vault]
    Node -->|Current campus weather| Meteo[Open-Meteo Public API]
```

Routers delegate to controllers and services. Prisma models are `User`, `Event`, and `Booking`. Bookings use the existing transaction and event row lock to enforce capacity; cancellation retains the booking with `CANCELLED` status. Event detail responses consume Open-Meteo and include current weather for the configured campus coordinates.

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+, TypeScript |
| HTTP | Express 4, CORS |
| Data | PostgreSQL 16, Prisma 5 |
| Identity | Microsoft Entra ID JWT, local JWT, role middleware |
| Secrets | dotenv for development, Azure Key Vault integration |
| Deployment | Docker Compose, Nginx HTTPS proxy |
| Integration / QA | Open-Meteo, Postman v2.1, integration verification script |

## Local development

Requires Node.js 20+, npm, Docker with Compose, and Git.

```bash
git clone https://github.com/kaungwaiyan96/campus-event-booking-api.git
cd campus-event-booking-api
git checkout develop
git pull --ff-only origin develop
npm ci
cp .env.example .env
docker compose up -d postgres
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run build
npm run test:verify
npm run dev
```

The API listens on `http://localhost:5000`. If macOS already uses that port, set `PORT=5001` in `.env` and use `http://localhost:5001/events-api/v1`. Start only `postgres` when running the API with `npm run dev`, to avoid two API servers competing for the same port. The seed script **deletes existing users, events, and bookings**; use a disposable development database. `test:verify` requires seed users and development authentication.

If host port 5432 is occupied, use a separate local database and change only your ignored `.env`:

```bash
docker run -d --name campus_member3_test_db \
  -e POSTGRES_PASSWORD=postgrespassword -e POSTGRES_DB=campus_events \
  -p 127.0.0.1:55432:5432 postgres:16-alpine
# Set DATABASE_URL in .env to:
# postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public
```

This workspace can use that alternate database port for local verification.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default 5000 |
| `NODE_ENV` | `development` enables local user fallback |
| `DATABASE_URL` | PostgreSQL connection URL; host process uses localhost |
| `PEER_API_KEY` | Shared secret checked against the `x-api-key` header |
| `JWT_SECRET` | Signing secret for local demo JWTs |
| `CAMPUS_LATITUDE`, `CAMPUS_LONGITUDE` | Coordinates sent to Open-Meteo for event-detail weather; example defaults point to Bangkok |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_AUDIENCE` | Entra token configuration |
| `KEY_VAULT_NAME` | Azure Key Vault name used by the production managed identity |

Keep `.env` and real keys out of Git. The production VM uses its system-assigned managed identity rather than `AZURE_CLIENT_SECRET`; never put an Azure client secret, production peer key, or runtime secret in this repository or Postman export. The Postman `peerApiKey` variable must match the server's configuration when testing a local development stack.

### Docker and Nginx

The intended full-stack command is `docker compose up -d --build` (or `docker compose up -d` after building). Both services use `campus_network`, and Compose forwards the Entra and campus-coordinate environment variables. Run migrations with `docker compose exec api npx prisma migrate deploy`. Seed only a disposable database from the host using `npx prisma db seed`; the production image does not copy the TypeScript seed source. Compose sets `NODE_ENV=production`, so use Bearer tokens instead of `x-user-id`.

`nginx/default.conf` is a host deployment configuration, not a Compose service. It proxies `/events-api/` to port 5000 and requires the configured hostname and TLS certificates.

## Azure production runbook

The public API base URL is `https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1`. Its public health endpoint is `https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1/health`.

On `campus-event-vm`, the system-assigned managed identity is granted the `Key Vault Secrets User` role on `campus-events-kv-2474`. The VM deployment script signs in with that identity, retrieves `POSTGRES-PASSWORD` into the mode-600 runtime file `/run/campus-event/postgres-password`, and starts the private PostgreSQL container. The API then retrieves `DATABASE-URL`, `JWT-SECRET`, and `PEER-API-KEY` from Key Vault before it imports Prisma. The four required Key Vault secret names are:

- `DATABASE-URL`
- `POSTGRES-PASSWORD`
- `JWT-SECRET`
- `PEER-API-KEY`

`/etc/campus-event/config.env` contains only non-secret deployment identifiers: `KEY_VAULT_NAME`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_AUDIENCE`, `CAMPUS_LATITUDE`, and `CAMPUS_LONGITUDE`. Do not create a production `.env` file and do not add a client secret to this file.

From the checked-out repository on the VM, deploy an approved commit or tag by passing its exact Git ref:

```bash
./scripts/deploy.sh <git-ref>
```

The script fetches the ref, checks it out detached, builds the production image, applies Prisma migrations, starts the stack, and checks the loopback health endpoint. After DNS points at the VM and inbound HTTP/HTTPS are permitted, configure and validate TLS as root:

```bash
sudo ./scripts/configure-nginx.sh <certbot-email>
```

This script verifies DNS against the VM public IP, installs the HTTP ACME configuration, obtains the certificate, validates the HTTPS configuration, reloads Nginx only after `nginx -t`, and performs a Certbot renewal dry run.

## Authentication and roles

Public discovery and health require no credentials. Protected user routes accept `Authorization: Bearer <token>`. In development only, `x-user-id` selects a database user; omitting both headers selects the oldest user. Use explicit identities in tests.

| Seed role | `x-user-id` |
| --- | --- |
| STUDENT | `11111111-1111-1111-1111-111111111111` |
| ORGANIZER | `22222222-2222-2222-2222-222222222222` |
| ADMIN | `33333333-3333-3333-3333-333333333333` |

`/auth/dev-token` is available only outside production for disposable local demonstrations. It is not mounted when `NODE_ENV=production`; production requests must use valid Microsoft Entra Bearer tokens.

## API reference

Prefix all endpoints below with `/events-api/v1`. JSON bodies require `Content-Type: application/json`. Responses below abbreviate entity fields; IDs and dates are illustrative. Unless indicated, success is HTTP 200 and uses `{ "success": true, "data": ... }`. Health and demo token responses have their own shape.

| Method | Endpoint | Role / Auth | Request body / query | Sample response |
| --- | --- | --- | --- | --- |
| GET | `/health` | Public | — | `{"status":"healthy","timestamp":"2026-09-14T00:00:00.000Z"}` |
| POST | `/auth/dev-token` | Public demo utility | `{"role":"STUDENT"}`; optional `name`, `email` | `{"success":true,"token":"<jwt>","user":{"id":"...","role":"STUDENT"}}` |
| GET | `/auth/me` | Bearer / dev user | — | `{"success":true,"data":{"id":"...","role":"STUDENT","_count":{"bookings":1,"events":0}}}` |
| POST | `/auth/sync` | Bearer / dev user | `{"name":"Student Name","email":"student@campus.edu"}` | `{"success":true,"message":"User profile synchronized successfully.","data":{"id":"..."}}` |
| PATCH | `/users/:id/role` | ADMIN | `{"role":"STUDENT"}` | `{"success":true,"message":"User role updated to STUDENT.","data":{"id":"...","role":"STUDENT"}}` |
| GET | `/events` | Public | `search`, `venue`, `date=YYYY-MM-DD`, `upcoming=true` | `{"success":true,"data":[{"id":"...","title":"Workshop","remainingCapacity":10}]}` |
| GET | `/events/:id` | Public | — | `{"success":true,"data":{"id":"...","confirmedBookings":0,"remainingCapacity":10,"weather":{"source":"open-meteo","available":true,"temperatureC":30.5,"weatherCode":2,"observedAt":"2026-09-15T10:00Z"}}}` |
| POST | `/events` | ORGANIZER / ADMIN | Event body below | HTTP 201: `{"success":true,"data":{"id":"...","title":"Workshop","capacity":10}}` |
| PUT | `/events/:id` | Owning ORGANIZER / ADMIN | Any event body fields, e.g. `{"capacity":20}` | `{"success":true,"data":{"id":"...","capacity":20}}` |
| DELETE | `/events/:id` | Owning ORGANIZER / ADMIN | — | `{"success":true,"data":{"message":"Event and associated bookings successfully deleted."}}` |
| GET | `/events/:id/attendees` | Owning ORGANIZER / ADMIN | — | `{"success":true,"data":[{"bookingId":"...","bookedAt":"...","student":{"id":"...","name":"Student","email":"..."}}]}` |
| POST | `/bookings` | STUDENT / ADMIN | `{"eventId":"<event-id>"}` | HTTP 201: `{"success":true,"data":{"id":"...","status":"CONFIRMED","eventId":"..."}}` |
| GET | `/bookings/my-bookings` | STUDENT / ADMIN | — | `{"success":true,"data":[{"id":"...","status":"CONFIRMED","event":{"id":"...","title":"Workshop"}}]}` |
| DELETE | `/bookings/:id` | Owning STUDENT / ADMIN | — | `{"success":true,"data":{"message":"Booking cancelled successfully. Capacity freed.","booking":{"id":"...","status":"CANCELLED"}}}` |
| GET | `/events/active` | `x-api-key` | `location=Room101` | `{"success":true,"data":{"active":false,"event":null}}` |

Event creation body (use current/future ISO dates when testing bookings):

```json
{
  "title": "Workshop",
  "description": "Campus technology workshop",
  "venueName": "Room101",
  "venueAddress": "Building A, Campus",
  "startTime": "2026-10-01T09:00:00Z",
  "endTime": "2026-10-01T11:00:00Z",
  "capacity": 10
}
```

`mapImageUrl` is optional; no map generation runs automatically. Event filters combine; `date` selects the UTC start day and `upcoming=true` requires a future start. `search` matches title, description, or venue and `venue` matches venue, case-insensitively.

Common errors use `{"success":false,"error":{"code":"...","message":"..."}}`: 400 for invalid input/time/capacity or a full/concluded event; 401 for invalid identity/key; 403 for role/ownership denial; 404 for missing records/routes; 409 `ALREADY_BOOKED` for duplicate active RSVPs. Cancelled bookings remain in `/my-bookings`.

## Exposed Peer API — rubric evidence

```bash
curl --get 'http://localhost:5000/events-api/v1/events/active' \
  --data-urlencode 'location=Room101' \
  -H "x-api-key: $PEER_API_KEY"
```

Set the shell variable to the same value as `.env` before this command. A Bearer token is not a substitute for the peer key. Missing, empty, or incorrect keys return exactly HTTP 401:

```json
{"success":false,"error":{"code":"UNAUTHORIZED","message":"Invalid or missing API key."}}
```

A valid key with a missing, blank, repeated, or structured `location` returns HTTP 400 `BAD_REQUEST`. A valid location is trimmed and matched exactly, case-sensitively, against `venueName`. The Prisma query uses a single server timestamp and inclusive `startTime <= now <= endTime`. No match returns `active: false, event: null`; a match returns `active: true` and the event's scalar database fields (no attendee/user relations). If events overlap, earliest start then event ID determine the result. Database failures pass to the shared error handler, never masquerading as an empty venue.

The router mounts before `/events/:id`. Postman includes active/inactive checks plus missing and invalid key assertions, demonstrating service-to-service protection.

## Consumed Public API — rubric evidence

`GET /events/:id` calls `src/services/externalApi.service.ts`, which consumes the public Open-Meteo API using `CAMPUS_LATITUDE` and `CAMPUS_LONGITUDE`. No classmate API or API key is required for this consumed integration. The helper also remains directly callable:

```typescript
import { fetchExternalPublicData } from './src/services/externalApi.service';
const weather = await fetchExternalPublicData({ latitude: 16.8661, longitude: 96.1951 });
```

It calls the [Open-Meteo forecast endpoint](https://open-meteo.com/en/docs) for current `temperature_2m` and `weather_code`, in Celsius and UTC. Campus coordinates are explicit because a room label cannot reliably identify a geographic location. Weather data attribution: Open-Meteo.

```json
{"source":"open-meteo","available":true,"temperatureC":29.5,"weatherCode":3,"observedAt":"2026-09-14T09:00Z"}
```

A three-second abort timeout covers network and body reads. Network failures, non-2xx responses, invalid JSON, malformed data, and timeout return a safe fallback, without throwing into callers:

```json
{"source":"open-meteo","available":false,"temperatureC":null,"weatherCode":null,"observedAt":null,"reason":"UNAVAILABLE"}
```

Invalid coordinates return the same shape with `reason: "INVALID_COORDINATES"` without making a request. Null values indicate unavailable weather; fabricated weather is never substituted.

Run the helper locally:

```bash
npx ts-node -e "import { fetchExternalPublicData } from './src/services/externalApi.service'; fetchExternalPublicData({latitude:16.8661,longitude:96.1951}).then(console.log)"
```

If Open-Meteo is unavailable, `GET /events/:id` still returns HTTP 200 with the event and the safe `available: false` weather object above. This demonstrates public API consumption without making core event access depend on a third-party outage.

## Postman workflow

Import `postman/campus_events_api.postman_collection.json` as a v2.1 collection. Set `baseUrl` (default `http://localhost:5000/events-api/v1`) and `peerApiKey` locally. Run against a development database, in collection order. Seed `studentId`, `organizerId`, and `adminId` are supplied. Requests use `x-user-id` for development.

For production, set `baseUrl` to `https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1` and obtain a role-appropriate Microsoft Entra access token using Postman's **OAuth 2.0** Authorization Code grant with PKCE. The collection provides only these non-secret Entra variables:

- `entraTenantId`: `c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f`
- `entraClientId`: `d16771d8-2e37-476a-be7c-63f4ed09c819`
- `entraAudience`: `d16771d8-2e37-476a-be7c-63f4ed09c819`
- `entraScope`: `api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user openid profile email`

Use `https://login.microsoftonline.com/{{entraTenantId}}/oauth2/v2.0/authorize` as the authorization endpoint, `https://login.microsoftonline.com/{{entraTenantId}}/oauth2/v2.0/token` as the token endpoint, and `https://oauth.pstmn.io/v1/callback` as the callback URL. Do not configure client authentication or enter a client secret. Access and refresh tokens stay in the local Postman session and are never exported in this collection.

The runner creates a uniquely named ongoing fixture at a unique venue, captures `eventId` and `bookingId`, verifies event weather, bookings, and peer responses, cancels the booking, and deletes its event last. A separate Room101 example demonstrates the requested URL. Date variables are generated at run time. Auth tests sync the seed student's existing name/email and set its role to STUDENT; run only on disposable seed data. The demo-token request creates a demo user. If a run is interrupted, delete its created event manually. No real keys are stored in the export.

## Verification performed

Run `npm run build` and `npm run test:verify` against an isolated PostgreSQL database before deployment. The verification script checks the real event-detail route with controlled Open-Meteo success and failure responses, plus event booking, capacity, cancellation, authorization, filtering, and error behavior. A live event-detail request can then demonstrate the real public API response.

## Team ownership

See `COLLABORATION_SPEC.md` for the original split of responsibilities. The public weather integration is now connected to the event-detail service and does not depend on another team or classmate service.
