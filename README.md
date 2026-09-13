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
    Helper[Internal weather helper] --> Meteo[Open-Meteo Public API]
```

Routers delegate to controllers and services. Prisma models are `User`, `Event`, and `Booking`. Bookings use the existing transaction and event row lock to enforce capacity; cancellation retains the booking with `CANCELLED` status. The weather helper is available for internal callers; the existing event service does not yet invoke it.

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
git checkout -b feature/member3-integrations-docs
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

The API listens on `http://localhost:5000`. Start only `postgres` when running the API with `npm run dev`, to avoid two servers competing for port 5000. The seed script **deletes existing users, events, and bookings**; use a disposable development database. `test:verify` requires seed users and development authentication.

If host port 5432 is occupied, use a separate local database and change only your ignored `.env`:

```bash
docker run -d --name campus_member3_test_db \
  -e POSTGRES_PASSWORD=postgrespassword -e POSTGRES_DB=campus_events \
  -p 127.0.0.1:55432:5432 postgres:16-alpine
# Set DATABASE_URL in .env to:
# postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public
```

This workspace uses that alternate port for Member 3 verification.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default 5000 |
| `NODE_ENV` | `development` enables local user fallback |
| `DATABASE_URL` | PostgreSQL connection URL; host process uses localhost |
| `PEER_API_KEY` | Shared secret checked against the `x-api-key` header |
| `JWT_SECRET` | Signing secret for local demo JWTs |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_AUDIENCE` | Entra token configuration |
| `KEY_VAULT_NAME`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | Key Vault and Azure credentials |

Keep `.env` and real keys out of Git. Replace example secrets for deployment. The Postman `peerApiKey` variable must match the server's configuration.

### Docker and Nginx

The intended full-stack command is `docker compose up -d --build` (or `docker compose up -d` after building). The current upstream Compose file attaches `api` to `campus_network` but leaves `postgres` on the default network. Member 1 must align these networks before the API can resolve `postgres`. These infrastructure files are outside Member 3 ownership.

After those infrastructure corrections, run migrations with `docker compose exec api npx prisma migrate deploy`. Seed a disposable database from the host using `npx prisma db seed`; the production image does not copy the TypeScript seed source. Compose sets `NODE_ENV=production`, so use Bearer tokens instead of `x-user-id`. Its current environment mapping does not forward the `AZURE_AD_*` variables; Member 1 must add them for Entra deployment.

`nginx/default.conf` is a host deployment configuration, not a Compose service. It proxies `/events-api/` to port 5000 and requires the configured hostname and TLS certificates.

## Authentication and roles

Public discovery and health require no credentials. Protected user routes accept `Authorization: Bearer <token>`. In development only, `x-user-id` selects a database user; omitting both headers selects the oldest user. Use explicit identities in tests.

| Seed role | `x-user-id` |
| --- | --- |
| STUDENT | `11111111-1111-1111-1111-111111111111` |
| ORGANIZER | `22222222-2222-2222-2222-222222222222` |
| ADMIN | `33333333-3333-3333-3333-333333333333` |

The upstream `/auth/dev-token` route currently has no environment guard and can issue privileged demo tokens. It must be restricted by Member 1 before public deployment. This branch preserves the assigned auth code.

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
| GET | `/events/:id` | Public | — | `{"success":true,"data":{"id":"...","organizer":{"id":"...","name":"Organizer","email":"..."},"confirmedBookings":0,"remainingCapacity":10}}` |
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

`src/services/externalApi.service.ts` exports an internal callable helper:

```typescript
import { fetchExternalPublicData } from './src/services/externalApi.service';
const weather = await fetchExternalPublicData({ latitude: 16.8661, longitude: 96.1951 });
```

It calls the [Open-Meteo forecast endpoint](https://open-meteo.com/en/docs) for current `temperature_2m` and `weather_code`, in Celsius and UTC. Coordinates are explicit; a room label cannot reliably identify a geographic location. Weather data attribution: Open-Meteo.

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

**Integration handoff:** The helper implements public API consumption and graceful failure. Automatic weather enrichment of event creation/detail remains a Member 2 integration step, requiring a venue-to-coordinate mapping. This branch deliberately changes only Member 3 files and the permitted router mount; it does not claim event responses already contain weather.

## Postman workflow

Import `postman/campus_events_api.postman_collection.json` as a v2.1 collection. Set `baseUrl` (default `http://localhost:5000/events-api/v1`) and `peerApiKey` locally. Run against a development database, in collection order. Seed `studentId`, `organizerId`, and `adminId` are supplied. Requests use `x-user-id` for development; to test production, replace those with valid role-specific Bearer tokens.

The runner creates a uniquely named ongoing fixture at a unique venue, captures `eventId` and `bookingId`, verifies bookings and peer responses, cancels the booking, and deletes its event last. A separate Room101 example demonstrates the requested URL. Date variables are generated at run time. Auth tests sync the seed student's existing name/email and set its role to STUDENT; run only on disposable seed data. The demo-token request creates a demo user. If a run is interrupted, delete its created event manually. No real keys are stored in the export.

## Verification performed

On the Member 3 local branch, `npm run build` and `npm run test:verify` passed against the isolated PostgreSQL database. An additional temporary Node harness executed the exported collection request/test scripts and checked invalid queries, inclusive start/end boundaries using real Prisma, valid weather, malformed/failed responses, invalid coordinates, and body-read timeout: 61 assertions passed. This was a script-level collection check, not a Postman GUI run. A live Open-Meteo call also returned available weather. The temporary harness lives outside the repository to preserve file ownership.

## Team ownership

See `COLLABORATION_SPEC.md`. Member 1 owns identity/infrastructure; Member 2 owns schema/events/bookings; Member 3 (Lwin Htoo Aung) owns peer middleware/routes/controller/types, the external service, Postman, and this README. The only shared bootstrap change is importing/mounting the peer router. Work remains on `feature/member3-integrations-docs` until reviewed for `develop`.
