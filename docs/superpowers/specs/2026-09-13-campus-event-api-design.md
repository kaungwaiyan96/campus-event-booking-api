# System Design: Campus Event Management & Booking API
## Base Setup & Member 2 Scope (Events & Bookings Module)

- **Date:** 2026-09-13
- **Author:** Kaung Wai Yan (Member 2) & Antigravity Assistant
- **Status:** Approved by User
- **Reference Contract:** `COLLABORATION_SPEC.md`

---

## 1. Executive Summary

This design document outlines the technical architecture, database schema, concurrency safeguards, API contracts, and error handling for the **Campus Event Management & Booking API**, specifically focusing on **Base Project Architecture** and **Member 2 Scope (Events & Bookings Module)**.

The system is built with Node.js, Express, TypeScript, and Prisma ORM backed by PostgreSQL. It enforces strict separation of concerns, guarantees concurrency-safe RSVP bookings through database transactions, and leaves well-defined, unblocked integration boundaries for Member 1 (Infra/Auth) and Member 3 (Peer/External APIs).

---

## 2. Architecture & File Allocation

### 2.1 File Ownership Boundaries

Adhering strictly to `COLLABORATION_SPEC.md`, files are mapped cleanly to avoid Git merge conflicts:

```
Backend/
├── prisma/
│   ├── schema.prisma            # [Member 2] Database schema contract
│   └── seed.ts                  # [Member 2] Seed script with mock students, organizers, admins, and events
├── src/
│   ├── app.ts                   # Express application setup, middlewares, base router
│   ├── server.ts                # Server entry point listening on PORT 5000
│   ├── config/
│   │   ├── env.ts               # Environment configuration with dev fallbacks
│   │   └── prisma.ts            # [Member 2] PrismaClient singleton
│   ├── middlewares/
│   │   ├── auth.middleware.ts   # AuthContext interface + dev fallback (ready for Member 1 Azure AD)
│   │   ├── role.middleware.ts   # Role-based access control guard (STUDENT, ORGANIZER, ADMIN)
│   │   └── error.middleware.ts  # [Member 2] Centralized error mapper and response handler
│   ├── types/
│   │   ├── event.types.ts       # [Member 2] Event DTOs, query filter interfaces
│   │   └── booking.types.ts     # [Member 2] Booking DTOs, status interfaces
│   ├── services/
│   │   ├── event.service.ts     # [Member 2] Event CRUD, search/filtering, attendee queries
│   │   └── booking.service.ts   # [Member 2] Concurrency-safe RSVP and cancellation logic
│   ├── controllers/
│   │   ├── event.controller.ts  # [Member 2] HTTP controllers for events
│   │   └── booking.controller.ts# [Member 2] HTTP controllers for bookings
│   └── routes/
│       ├── event.routes.ts      # [Member 2] Mounted at /events-api/v1/events
│       └── booking.routes.ts    # [Member 2] Mounted at /events-api/v1/bookings
├── docker-compose.yml           # Local PostgreSQL container orchestration
├── tsconfig.json                # TypeScript compiler configuration
└── package.json                 # Project dependencies and operational scripts
```

### 2.2 Dev-Friendly Pluggable Authentication

To enable immediate local testing and independent progress before Member 1 deploys Microsoft Entra ID (Azure AD), `auth.middleware.ts` implements:
1. `AuthUser` interface: `{ id: string, adOid: string, name: string, email: string, role: 'STUDENT' | 'ORGANIZER' | 'ADMIN' }`.
2. Attached to Express request as `req.user`.
3. In `development` mode (`NODE_ENV=development`): If no `Authorization: Bearer <token>` is present, it accepts optional headers (e.g. `x-user-id` or defaults to the seeded user).
4. When Member 1 completes Microsoft Entra ID integration, they drop in token verification inside `auth.middleware.ts` without touching any of Member 2's controllers or services.

---

## 3. Database Schema Contract (`prisma/schema.prisma`)

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
  adOid      String    @unique @map("ad_oid")
  name       String
  email      String    @unique
  role       Role      @default(STUDENT)
  createdAt  DateTime  @default(now()) @map("created_at")

  events     Event[]   @relation("OrganizerEvents")
  bookings   Booking[]

  @@map("users")
}

model Event {
  id           String    @id @default(uuid())
  title        String
  description  String    @db.Text
  venueName    String    @map("venue_name")
  venueAddress String    @map("venue_address")
  mapImageUrl  String?   @map("map_image_url")
  startTime    DateTime  @map("start_time")
  endTime      DateTime  @map("end_time")
  capacity     Int
  organizerId  String    @map("organizer_id")
  createdAt    DateTime  @default(now()) @map("created_at")

  organizer    User      @relation("OrganizerEvents", fields: [organizerId], references: [id], onDelete: Cascade)
  bookings     Booking[]

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

  @@unique([eventId, studentId])
  @@map("bookings")
}
```

---

## 4. Business Logic & Concurrency Control

### 4.1 RSVP Booking Flow (`booking.service.ts`)

To prevent overbooking when multiple concurrent requests arrive at near-capacity events:
1. Wrap the entire reservation within `prisma.$transaction(async (tx) => { ... })`.
2. Check that the event exists and fetch its `capacity`.
3. Count all active bookings for this event:
   ```ts
   const confirmedCount = await tx.booking.count({
     where: { eventId, status: 'CONFIRMED' },
   });
   ```
4. If `confirmedCount >= event.capacity`, abort transaction with `AppError(400, 'CAPACITY_EXCEEDED', 'Event is at full capacity')`.
5. Check if a booking record already exists for `[eventId, studentId]`:
   - If existing record has `status: 'CONFIRMED'`, abort with `AppError(409, 'ALREADY_BOOKED', 'You have already booked this event')`.
   - If existing record has `status: 'CANCELLED'`, reinstate by updating `status: 'CONFIRMED'` and `bookedAt: new Date()`.
   - If no existing record, create a new record with `status: 'CONFIRMED'`.
6. Return the confirmed booking object with joined event details.

### 4.2 Cancellation Flow
1. Find booking by `id`. If not found, return 404.
2. Verify ownership: `booking.studentId === req.user.id` (or `req.user.role === 'ADMIN'`).
3. If already cancelled, return 400.
4. Update `status = 'CANCELLED'`.
5. Result: Seat is immediately released for other students without deleting the audit history.

### 4.3 Event Management Flow (`event.service.ts`)
1. **Create Event:**
   - Role required: `ORGANIZER` or `ADMIN`.
   - Validate `startTime < endTime` and `startTime >= now`.
   - Validate `capacity >= 1`.
   - Store organizer ID from `req.user.id`.
2. **List Events:**
   - Query filters: `search` (case-insensitive search on `title`, `description`, `venueName`), `upcoming` (boolean: filters `startTime >= now`), `venue` filter.
   - Computes `remainingCapacity` per event (`capacity - confirmedBookingsCount`).
3. **Update Event:**
   - Verification: Only the event's creator (`organizerId === req.user.id`) or an `ADMIN` can update.
   - If new `capacity` is provided, verify `newCapacity >= confirmedBookingsCount`.
4. **Delete Event:**
   - Verification: Only creator or `ADMIN`. Cascade deletes associated bookings.
5. **Get Attendees:**
   - Verification: Creator or `ADMIN`.
   - Returns list of students with `CONFIRMED` status.

---

## 5. API Contracts & Error Specifications

Base URL: `/events-api/v1`

### 5.1 Endpoints Table

| Route | Method | Roles | Request Body / Query | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `/events` | `GET` | All | `?search=&upcoming=true` | `200` + Array of Events with `remainingCapacity` |
| `/events/:id` | `GET` | All | None | `200` + Single Event details |
| `/events` | `POST` | `ORGANIZER`, `ADMIN` | `{ title, description, venueName, venueAddress, startTime, endTime, capacity }` | `201` + Created Event |
| `/events/:id` | `PUT` | `ORGANIZER` (own), `ADMIN` | `{ title?, description?, venueName?, venueAddress?, startTime?, endTime?, capacity? }` | `200` + Updated Event |
| `/events/:id` | `DELETE` | `ORGANIZER` (own), `ADMIN` | None | `200` + `{ message: "Event deleted successfully" }` |
| `/events/:id/attendees` | `GET` | `ORGANIZER` (own), `ADMIN` | None | `200` + Array of Attendees |
| `/bookings` | `POST` | `STUDENT` | `{ eventId: string }` | `201` + Created Booking |
| `/bookings/my-bookings` | `GET` | `STUDENT` | None | `200` + User's bookings |
| `/bookings/:id` | `DELETE` | `STUDENT` (own) | None | `200` + Cancelled Booking |

### 5.2 Unified Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "CAPACITY_EXCEEDED",
    "message": "Event is at full capacity"
  }
}
```

---

## 6. Verification & Testing Strategy

1. **Database Spin-up:**
   - Start PostgreSQL via `docker compose up -d`.
   - Verify connection via `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campus_events?schema=public`.
2. **Prisma Synchronization:**
   - Execute `npx prisma migrate dev --name init`.
   - Execute `npx prisma db seed` to populate student, organizer, admin, and test events.
3. **Automated Verification Script:**
   - Script testing:
     - Health check `GET /events-api/v1/health`.
     - Event creation by Organizer.
     - Event listing with search query.
     - Booking RSVP by Student (success).
     - Duplicate RSVP rejection (`ALREADY_BOOKED`).
     - Capacity saturation and rejection (`CAPACITY_EXCEEDED`).
     - Booking cancellation and capacity liberation.
     - Attendee list verification.
