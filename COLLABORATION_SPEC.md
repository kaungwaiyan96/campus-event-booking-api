# Campus Event Management & Booking API
## Team Collaboration Specification & AI Prompting Guide

This document is the **Single Source of Truth (SSOT)** for the project. It is designed so that any AI coding assistant (Cursor, Claude, ChatGPT, GitHub Copilot) used by any of the 3 team members will generate code that integrates seamlessly without Git merge conflicts.

---

## 1. Project Architecture & Standards

- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js (REST API)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Authentication:** Microsoft Entra ID (Azure AD) JWT with RBAC (`STUDENT`, `ORGANIZER`, `ADMIN`)
- **Secrets Management:** Azure Key Vault in Production (`@azure/keyvault-secrets`), fallback to `.env` in Development
- **Reverse Proxy Prefix:** `/events-api/v1` (All routes must mount under `/events-api/v1/...`)
- **Containerization:** Docker & Docker Compose (`app` + `postgres`)

---

## 2. Team Member Allocation & File Ownership

To prevent Git merge conflicts, each member has strict file ownership. **Do not modify files owned by another member without coordination.**

```
src/
├── app.ts                        # Shared bootstrap file (Member 1 sets up base, mounts routers)
├── server.ts                     # Shared server entry point
├── config/
│   ├── env.ts                   # [Member 1] Environment variables & Key Vault loader
│   └── prisma.ts                # [Member 2] Prisma Client singleton instance
├── middlewares/
│   ├── auth.middleware.ts       # [Member 1] Microsoft AD JWT verification
│   ├── role.middleware.ts       # [Member 1] RBAC permission checks
│   ├── apiKey.middleware.ts     # [Member 3 - Lwin Htoo Aung] x-api-key validator
│   └── error.middleware.ts      # [Member 2] Global error & exception handler
├── routes/
│   ├── auth.routes.ts           # [Member 1] User identity & profile routes
│   ├── event.routes.ts          # [Member 2] Event CRUD routes
│   ├── booking.routes.ts        # [Member 2] Booking/RSVP routes
│   └── peer.routes.ts           # [Member 3 - Lwin Htoo Aung] Exposed Peer API route
├── controllers/
│   ├── auth.controller.ts       # [Member 1]
│   ├── event.controller.ts      # [Member 2]
│   ├── booking.controller.ts    # [Member 2]
│   └── peer.controller.ts       # [Member 3 - Lwin Htoo Aung]
├── services/
│   ├── keyVault.service.ts      # [Member 1] Azure Key Vault secrets fetcher
│   ├── event.service.ts         # [Member 2] Event business logic
│   ├── booking.service.ts       # [Member 2] Booking business logic & concurrency transactions
│   └── externalApi.service.ts   # [Member 3 - Lwin Htoo Aung] 3rd Party Public API client
└── types/
    ├── auth.types.ts            # [Member 1] JWT payload & user context types
    ├── event.types.ts           # [Member 2] Event DTOs & query types
    ├── booking.types.ts         # [Member 2] Booking DTOs
    └── peer.types.ts            # [Member 3 - Lwin Htoo Aung] Peer & Public API types

Root & Infra:
├── prisma/
│   ├── schema.prisma            # [Member 2] Database schema
│   └── seed.ts                  # [Member 2] Mock seed data
├── docker-compose.yml           # [Member 1] Docker orchestration (Node + Postgres)
├── Dockerfile                   # [Member 1] Multi-stage production build
├── nginx/default.conf           # [Member 1] Nginx reverse proxy with /events-api location
├── postman/                     # [Member 3 - Lwin Htoo Aung] Exported Postman collection JSON
└── README.md                    # [Member 3 - Lwin Htoo Aung] Comprehensive documentation
```

---

## 3. Database Schema Contract (`prisma/schema.prisma`)

All members and AIs must strictly use this schema to avoid database mismatches:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  STUDENT
  ORGANIZER
  ADMIN
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

model User {
  id         String    @id @default(uuid())
  adOid      String    @unique @map("ad_oid") // Microsoft Active Directory Object ID
  name       String
  email      String    @unique
  role       Role      @default(STUDENT)
  createdAt  DateTime  @default(now()) @map("created_at")

  events     Event[]   @relation("OrganizerEvents")
  bookings   Booking[]

  @@map("users")
}

model Event {
  id          String    @id @default(uuid())
  title       String
  description String    @db.Text
  venueName   String    @map("venue_name")
  venueAddress String   @map("venue_address")
  mapImageUrl String?   @map("map_image_url")
  startTime   DateTime  @map("start_time")
  endTime     DateTime  @map("end_time")
  capacity    Int
  organizerId String    @map("organizer_id")
  createdAt   DateTime  @default(now()) @map("created_at")

  organizer   User      @relation("OrganizerEvents", fields: [organizerId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@map("events")
}

model Booking {
  id        String        @id @default(uuid())
  eventId   String        @map("event_id")
  studentId String        @map("student_id")
  status    BookingStatus @default(CONFIRMED)
  bookedAt  DateTime      @default(now()) @map("booked_at")

  event     Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  student   User          @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([eventId, studentId]) // Prevent duplicate active bookings per student
  @@map("bookings")
}
```

---

## 4. API Endpoints Specification

Base Path: `/events-api/v1`

### A. Auth & User Module ([Member 1])
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/events-api/v1/auth/me` | Bearer JWT | Returns current authenticated user profile and role |
| `POST` | `/events-api/v1/auth/sync` | Bearer JWT | Syncs/creates user record in DB upon Azure AD login |
| `PATCH`| `/events-api/v1/users/:id/role`| ADMIN only | Updates user role (`STUDENT`, `ORGANIZER`, `ADMIN`) |

### B. Event Module ([Member 2])
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/events-api/v1/events` | Public / Student | List all events with query filters (`search`, `date`, `upcoming`) |
| `GET` | `/events-api/v1/events/:id` | Public / Student | Get event detail (Includes weather/map data from Member 3) |
| `POST`| `/events-api/v1/events` | ORGANIZER, ADMIN | Create event (calls Member 3's `externalApi.service` for map/weather) |
| `PUT` | `/events-api/v1/events/:id` | ORGANIZER, ADMIN | Update event (Organizer can only update own event) |
| `DELETE`| `/events-api/v1/events/:id`| ORGANIZER, ADMIN | Delete event (Cascade deletes bookings) |
| `GET` | `/events-api/v1/events/:id/attendees` | ORGANIZER, ADMIN | List attendees for specific event |

### C. Booking Module ([Member 2])
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/events-api/v1/bookings` | STUDENT | RSVP for an event. Must use Prisma Transaction for concurrency |
| `GET` | `/events-api/v1/bookings/my-bookings` | STUDENT | List all bookings created by the logged-in student |
| `DELETE`| `/events-api/v1/bookings/:id` | STUDENT | Cancel booking (Sets status to `CANCELLED` & frees capacity) |

### D. Service-to-Service & Peer API ([Member 3 - Lwin Htoo Aung])
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/events-api/v1/events/active` | `x-api-key` header | **Exposed Peer API:** Checks if an event is active at `?location={venue_name}`. Returns `{ active: boolean, event: object \| null }`. Rejects with `401` if key is missing/invalid. |
| Helper | `fetchExternalPublicData()` | Internal Service | **Consuming Public API:** Consumes Open-Meteo Weather API or Google Maps API for event venue insights. |

---

## 5. Git Workflow & Merge Strategy

### Branches
- `main`: Protected production branch.
- `develop`: Shared integration branch.
- `feature/member1-infra-auth`: Member 1 branch
- `feature/member2-events-bookings`: Member 2 branch
- `feature/member3-integrations-docs`: Member 3 branch (Lwin Htoo Aung)

### Step-by-Step Merge Sequence
1. **Milestone 1:** Member 1 pushes base repository structure, `package.json`, and TypeScript config to `develop`.
2. **Milestone 2:** Member 2 pulls `develop`, adds `prisma/schema.prisma`, runs migration, and pushes to `develop`.
3. **Milestone 3 (Parallel Development):**
   - Member 1 builds Auth middleware & Azure Key Vault service.
   - Member 2 builds Event & Booking CRUD logic.
   - Member 3 builds `apiKey.middleware.ts`, `peer.routes.ts`, and `externalApi.service.ts`.
4. **Milestone 4:** Each member creates a Pull Request into `develop`.
5. **Milestone 5:** Member 3 finalizes `README.md` and Postman collection on `develop`, then creates final PR to `main`.

---

## 6. Copy-Paste AI Prompts for Each Team Member

Below are individual prompt templates designed to be pasted directly into any AI assistant (Cursor / Claude / ChatGPT) used by each student.

---

### 📋 AI Prompt for Member 1 (Infra, Azure Key Vault & AD Auth)
```text
You are working as Member 1 on the "Campus Event Management & Booking API" backend team (Node.js, Express, TypeScript, PostgreSQL, Prisma).
Read COLLABORATION_SPEC.md for all project standards.
Your exact responsibilities:
1. Setup Azure Key Vault secrets loader in `src/services/keyVault.service.ts` using `@azure/keyvault-secrets` and `@azure/identity`. If in development mode (NODE_ENV=development), fallback to process.env.
2. Implement Microsoft Entra ID (Azure AD) JWT verification middleware in `src/middlewares/auth.middleware.ts` to decode token and extract adOid, name, and email.
3. Implement RBAC middleware in `src/middlewares/role.middleware.ts` supporting roles: 'STUDENT', 'ORGANIZER', 'ADMIN'.
4. Implement `src/routes/auth.routes.ts` and `src/controllers/auth.controller.ts` with:
   - GET /events-api/v1/auth/me (returns req.user)
   - POST /events-api/v1/auth/sync (syncs AD user into local PostgreSQL User table via Prisma)
5. Create production `Dockerfile`, `docker-compose.yml` (Node app + PostgreSQL), and `nginx/default.conf` routing `/events-api/` to port 5000 without conflicting with existing server routes.
Stay strictly within your assigned files. Do not modify event or booking business logic.
```

---

### 📋 AI Prompt for Member 2 (Database & Core Domain Logic)
```text
You are working as Member 2 on the "Campus Event Management & Booking API" backend team (Node.js, Express, TypeScript, PostgreSQL, Prisma).
Read COLLABORATION_SPEC.md for all project standards.
Your exact responsibilities:
1. Ensure `prisma/schema.prisma` matches the exact models (User, Event, Booking) and enums in COLLABORATION_SPEC.md.
2. Implement `prisma/seed.ts` to populate sample users (student, organizer, admin), sample events, and sample bookings.
3. Implement `src/services/event.service.ts`, `src/controllers/event.controller.ts`, and `src/routes/event.routes.ts` mounted at `/events-api/v1/events`:
   - GET / (filter by search keyword, upcoming date)
   - GET /:id (detailed view)
   - POST / (ORGANIZER/ADMIN only; accepts title, description, venueName, venueAddress, startTime, endTime, capacity)
   - PUT /:id (ORGANIZER can only update own event, ADMIN can update any)
   - DELETE /:id (ORGANIZER can only delete own event, ADMIN can delete any)
   - GET /:id/attendees (ORGANIZER/ADMIN only)
4. Implement `src/services/booking.service.ts`, `src/controllers/booking.controller.ts`, and `src/routes/booking.routes.ts` mounted at `/events-api/v1/bookings`:
   - POST / (STUDENT only; RSVP for event). Use `prisma.$transaction` to guarantee capacity is not exceeded (concurrency check) and prevent duplicate bookings for the same user.
   - GET /my-bookings (STUDENT only; list their bookings)
   - DELETE /:id (STUDENT only; cancel booking and free capacity)
5. Implement centralized error handler in `src/middlewares/error.middleware.ts`.
Stay strictly within your assigned files. Do not touch auth middleware or peer API routes.
```

---

### 📋 AI Prompt for Member 3 - Lwin Htoo Aung (Integrations, Docs & QA)
```text
You are working as Member 3 (Lwin Htoo Aung) on the "Campus Event Management & Booking API" backend team (Node.js, Express, TypeScript, PostgreSQL, Prisma).
Read COLLABORATION_SPEC.md for all project standards.
Your exact responsibilities:
1. Implement `src/middlewares/apiKey.middleware.ts`:
   - Checks `x-api-key` in incoming request headers.
   - If missing or invalid, returns 401 Unauthorized { "error": "Invalid or missing API key" }.
   - If valid (matching process.env.PEER_API_KEY), calls next().
2. Implement `src/services/externalApi.service.ts`:
   - Consumes a public API (e.g., Open-Meteo Weather API or Google Maps Static API) to provide location/weather insights for event venues.
   - Include robust error handling and timeout so external API downtime never crashes the event server.
3. Implement `src/routes/peer.routes.ts` and `src/controllers/peer.controller.ts` mounted at `/events-api/v1/events/active`:
   - Protected by `apiKey.middleware.ts`.
   - Accepts query parameter `?location={room_name}`.
   - Queries Prisma to check if any event is currently active at that venue right now (`startTime <= now <= endTime`).
   - Returns `{ "active": true/false, "event": {...} }`.
4. Create `postman/campus_events_api.postman_collection.json`:
   - Includes requests for all endpoints (Auth, Events, Bookings, Peer API).
   - Includes positive and negative test cases for `x-api-key` validation.
5. Write a comprehensive, professional `README.md` covering:
   - System Architecture Diagram
   - Tech Stack
   - Local Setup & Docker instructions
   - Complete API documentation table
   - Explicit Peer API & External API usage documentation (as strictly required by course rubric).
Stay strictly within your assigned files. Do not edit core booking transaction code or auth logic.
```
