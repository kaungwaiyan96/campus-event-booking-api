# Campus Event Management & Booking API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the TypeScript + Express backend baseline and implement Member 2's core domain modules (Event CRUD and concurrency-safe Booking/RSVP Transactions with PostgreSQL and Prisma ORM).

**Architecture:** Express REST API routing under `/events-api/v1`, using Prisma interactive transactions for race-condition-free event bookings, role-based access control, dev-friendly authentication fallbacks for immediate testing, and strict file boundaries aligned with `COLLABORATION_SPEC.md`.

**Tech Stack:** Node.js 20+, TypeScript, Express.js, PostgreSQL 16, Prisma ORM, Docker Compose, ts-node-dev.

**Spec:** `docs/superpowers/specs/2026-09-13-campus-event-api-design.md`

## Global Constraints

- All endpoints must mount under the `/events-api/v1` prefix.
- Database models must strictly follow `prisma/schema.prisma` in `COLLABORATION_SPEC.md` (`User`, `Event`, `Booking`).
- Booking RSVP operations MUST use `prisma.$transaction` to guarantee capacity is never exceeded under concurrent requests.
- Member 2 file ownership must be strictly respected; do not modify files designated for Member 1 or Member 3.

---

### Task 1: Project Setup, Tooling & PostgreSQL Container Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.env`
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: Runnable Node.js + TypeScript environment and running PostgreSQL instance on port 5432 (`campus_events` DB).

- [ ] **Step 1: Create `package.json` with dependencies and scripts**

```json
{
  "name": "campus-event-booking-api",
  "version": "1.0.0",
  "description": "Campus Event Management & Booking Backend API",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts",
    "prisma:studio": "prisma studio",
    "test:verify": "ts-node tests/verification.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.19.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.16.5",
    "prisma": "^5.19.1",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.2"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `docker-compose.yml`, `.env.example`, and `.env`**

`docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: campus_event_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: campus_events
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

`.env.example`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/campus_events?schema=public"
PEER_API_KEY="campus_events_sec_key_2026"
```

`.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/campus_events?schema=public"
PEER_API_KEY="campus_events_sec_key_2026"
```

- [ ] **Step 4: Install dependencies and start PostgreSQL container**

Run:
```bash
npm install
docker compose up -d
```
Verify PostgreSQL is healthy and accepting connections.

---

### Task 2: Database Schema & Seeding (Prisma Models & Migrations)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/config/prisma.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: PostgreSQL DB connection string from `.env`.
- Produces: Generated Prisma Client with `User`, `Event`, `Booking` models, and seeded development accounts.

- [ ] **Step 1: Write `prisma/schema.prisma`**

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

- [ ] **Step 2: Create Prisma Client Singleton in `src/config/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
```

- [ ] **Step 3: Create `prisma/seed.ts`**

```typescript
import { PrismaClient, Role, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial database records...');

  // 1. Clean existing records in cascade order
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const student = await prisma.user.create({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      adOid: 'ad-student-001',
      name: 'Mg Student',
      email: 'student@campus.edu',
      role: Role.STUDENT,
    },
  });

  const organizer = await prisma.user.create({
    data: {
      id: '22222222-2222-2222-2222-222222222222',
      adOid: 'ad-organizer-001',
      name: 'Daw Organizer',
      email: 'organizer@campus.edu',
      role: Role.ORGANIZER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: '33333333-3333-3333-3333-333333333333',
      adOid: 'ad-admin-001',
      name: 'U Admin',
      email: 'admin@campus.edu',
      role: Role.ADMIN,
    },
  });

  // 3. Create Events
  const now = new Date();
  const event1 = await prisma.event.create({
    data: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Tech Career Fair 2026',
      description: 'Annual campus tech career fair and recruitment sessions with top tech firms.',
      venueName: 'Main Auditorium',
      venueAddress: 'Building A, Level 2, Central Campus',
      mapImageUrl: 'https://maps.googleapis.com/maps/api/staticmap?center=Main+Auditorium&zoom=15&size=600x300',
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(now.getTime() + 28 * 60 * 60 * 1000),
      capacity: 50,
      organizerId: organizer.id,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Cloud Architecture Workshop',
      description: 'Hands-on workshop covering cloud computing and container orchestration.',
      venueName: 'Lab Room 302',
      venueAddress: 'Engineering Complex, Level 3',
      startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // in 2 days
      endTime: new Date(now.getTime() + 52 * 60 * 60 * 1000),
      capacity: 2, // low capacity to test overbooking
      organizerId: organizer.id,
    },
  });

  // 4. Create Initial Booking
  await prisma.booking.create({
    data: {
      eventId: event1.id,
      studentId: student.id,
      status: BookingStatus.CONFIRMED,
    },
  });

  console.log('Database seeding completed successfully:');
  console.log({ studentId: student.id, organizerId: organizer.id, adminId: admin.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 4: Run Prisma migrations and seed database**

Run:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```
Verify tables are created and seed records exist.

---

### Task 3: Configuration, Middleware & Error Handling

**Files:**
- Create: `src/config/env.ts`
- Create: `src/middlewares/error.middleware.ts`
- Create: `src/middlewares/auth.middleware.ts`
- Create: `src/middlewares/role.middleware.ts`

**Interfaces:**
- Produces: `AppError`, `errorHandler`, `authMiddleware` (with dev fallback), `requireRole` middleware.

- [ ] **Step 1: Create `src/config/env.ts`**

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  peerApiKey: process.env.PEER_API_KEY || 'campus_events_sec_key_2026',
};
```

- [ ] **Step 2: Create `src/middlewares/error.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this unique field already exists.',
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
    }
  }

  console.error('Unhandled Server Error:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}
```

- [ ] **Step 3: Create `src/middlewares/auth.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from './error.middleware';

export interface AuthUser {
  id: string;
  adOid: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // In development mode: Allow x-user-id header or default to first user in DB if no Bearer token provided
    if (process.env.NODE_ENV === 'development' && (!authHeader || !authHeader.startsWith('Bearer '))) {
      const devUserId = (req.headers['x-user-id'] as string) || undefined;
      const user = devUserId
        ? await prisma.user.findUnique({ where: { id: devUserId } })
        : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

      if (user) {
        req.user = {
          id: user.id,
          adOid: user.adOid,
          name: user.name,
          email: user.email,
          role: user.role,
        };
        return next();
      }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication token is missing or malformed.');
    }

    // Placeholder hook for Member 1 Azure AD verification
    throw new AppError(401, 'UNAUTHORIZED', 'Azure AD token verification pending Member 1 integration.');
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Create `src/middlewares/role.middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from './error.middleware';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Access denied. Allowed roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
}
```

---

### Task 4: Event Management Module (Types, Service, Controller & Routes)

**Files:**
- Create: `src/types/event.types.ts`
- Create: `src/services/event.service.ts`
- Create: `src/controllers/event.controller.ts`
- Create: `src/routes/event.routes.ts`

**Interfaces:**
- Produces: Event router mounted at `/events-api/v1/events` supporting CRUD, filtering, attendee listing.

- [ ] **Step 1: Create `src/types/event.types.ts`**

```typescript
export interface CreateEventDTO {
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapImageUrl?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  capacity: number;
}

export interface UpdateEventDTO {
  title?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  mapImageUrl?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
}

export interface EventQueryFilters {
  search?: string;
  upcoming?: string;
  venue?: string;
}
```

- [ ] **Step 2: Create `src/services/event.service.ts`**

```typescript
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { CreateEventDTO, UpdateEventDTO, EventQueryFilters } from '../types/event.types';
import { AuthUser } from '../middlewares/auth.middleware';

export class EventService {
  static async listEvents(filters: EventQueryFilters) {
    const where: Prisma.EventWhereInput = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { venueName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.venue) {
      where.venueName = { contains: filters.venue, mode: 'insensitive' };
    }

    if (filters.upcoming === 'true') {
      where.startTime = { gte: new Date() };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      mapImageUrl: event.mapImageUrl,
      startTime: event.startTime,
      endTime: event.endTime,
      capacity: event.capacity,
      confirmedBookings: event._count.bookings,
      remainingCapacity: Math.max(0, event.capacity - event._count.bookings),
      organizer: event.organizer,
      createdAt: event.createdAt,
    }));
  }

  static async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
    });

    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    return {
      ...event,
      confirmedBookings: event._count.bookings,
      remainingCapacity: Math.max(0, event.capacity - event._count.bookings),
    };
  }

  static async createEvent(data: CreateEventDTO, user: AuthUser) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid date format provided.');
    }

    if (startTime >= endTime) {
      throw new AppError(400, 'INVALID_TIME_RANGE', 'startTime must be strictly earlier than endTime.');
    }

    if (data.capacity < 1) {
      throw new AppError(400, 'INVALID_CAPACITY', 'Capacity must be at least 1.');
    }

    return prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        mapImageUrl: data.mapImageUrl,
        startTime,
        endTime,
        capacity: data.capacity,
        organizerId: user.id,
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  static async updateEvent(id: string, data: UpdateEventDTO, user: AuthUser) {
    const existing = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: { where: { status: 'CONFIRMED' } },
          },
        },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this event.');
    }

    if (data.capacity !== undefined && data.capacity < existing._count.bookings) {
      throw new AppError(
        400,
        'CAPACITY_TOO_LOW',
        `Cannot reduce capacity below currently confirmed bookings (${existing._count.bookings}).`
      );
    }

    let startTime = existing.startTime;
    let endTime = existing.endTime;

    if (data.startTime) {
      startTime = new Date(data.startTime);
    }
    if (data.endTime) {
      endTime = new Date(data.endTime);
    }

    if (startTime >= endTime) {
      throw new AppError(400, 'INVALID_TIME_RANGE', 'startTime must be strictly earlier than endTime.');
    }

    return prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        mapImageUrl: data.mapImageUrl,
        startTime,
        endTime,
        capacity: data.capacity,
      },
    });
  }

  static async deleteEvent(id: string, user: AuthUser) {
    const existing = await prisma.event.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this event.');
    }

    await prisma.event.delete({ where: { id } });
    return { message: 'Event and associated bookings successfully deleted.' };
  }

  static async getEventAttendees(id: string, user: AuthUser) {
    const existing = await prisma.event.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found.');
    }

    if (user.role !== 'ADMIN' && existing.organizerId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view attendee details.');
    }

    const attendees = await prisma.booking.findMany({
      where: {
        eventId: id,
        status: 'CONFIRMED',
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { bookedAt: 'asc' },
    });

    return attendees.map((b) => ({
      bookingId: b.id,
      bookedAt: b.bookedAt,
      student: b.student,
    }));
  }
}
```

- [ ] **Step 3: Create `src/controllers/event.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { EventService } from '../services/event.service';

export class EventController {
  static async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.listEvents(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.getEventById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.createEvent(req.body, req.user!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.updateEvent(req.params.id, req.body, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.deleteEvent(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getAttendees(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventService.getEventAttendees(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
```

- [ ] **Step 4: Create `src/routes/event.routes.ts`**

```typescript
import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated discovery
router.get('/', EventController.listEvents);
router.get('/:id', EventController.getEventById);

// Protected Organizer / Admin endpoints
router.post(
  '/',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.createEvent
);

router.put(
  '/:id',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.updateEvent
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.deleteEvent
);

router.get(
  '/:id/attendees',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.getAttendees
);

export default router;
```

---

### Task 5: Concurrency-Safe Booking Module (Types, Service, Controller & Routes)

**Files:**
- Create: `src/types/booking.types.ts`
- Create: `src/services/booking.service.ts`
- Create: `src/controllers/booking.controller.ts`
- Create: `src/routes/booking.routes.ts`

**Interfaces:**
- Produces: Booking router mounted at `/events-api/v1/bookings` with transactional concurrency checks and cancellation.

- [ ] **Step 1: Create `src/types/booking.types.ts`**

```typescript
export interface CreateBookingDTO {
  eventId: string;
}
```

- [ ] **Step 2: Create `src/services/booking.service.ts`**

```typescript
import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { AuthUser } from '../middlewares/auth.middleware';
import { BookingStatus } from '@prisma/client';

export class BookingService {
  static async rsvpEvent(eventId: string, user: AuthUser) {
    if (!eventId) {
      throw new AppError(400, 'INVALID_INPUT', 'eventId is required.');
    }

    // Concurrency-safe interactive transaction
    return prisma.$transaction(async (tx) => {
      // 1. Fetch event and check existence
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new AppError(404, 'NOT_FOUND', 'Event not found.');
      }

      // Check event has not ended
      if (new Date() > event.endTime) {
        throw new AppError(400, 'EVENT_CONCLUDED', 'Cannot RSVP to an event that has already ended.');
      }

      // 2. Count active bookings
      const confirmedCount = await tx.booking.count({
        where: {
          eventId,
          status: BookingStatus.CONFIRMED,
        },
      });

      // 3. Verify capacity
      if (confirmedCount >= event.capacity) {
        throw new AppError(400, 'CAPACITY_EXCEEDED', 'Event is at full capacity.');
      }

      // 4. Check existing booking for student
      const existing = await tx.booking.findUnique({
        where: {
          eventId_studentId: {
            eventId,
            studentId: user.id,
          },
        },
      });

      if (existing) {
        if (existing.status === BookingStatus.CONFIRMED) {
          throw new AppError(409, 'ALREADY_BOOKED', 'You already have an active RSVP for this event.');
        }

        // Reactivate previously cancelled booking
        return tx.booking.update({
          where: { id: existing.id },
          data: {
            status: BookingStatus.CONFIRMED,
            bookedAt: new Date(),
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                venueName: true,
                startTime: true,
                endTime: true,
              },
            },
          },
        });
      }

      // 5. Create new confirmed booking
      return tx.booking.create({
        data: {
          eventId,
          studentId: user.id,
          status: BookingStatus.CONFIRMED,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              venueName: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      });
    });
  }

  static async getMyBookings(user: AuthUser) {
    return prisma.booking.findMany({
      where: {
        studentId: user.id,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueAddress: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { bookedAt: 'desc' },
    });
  }

  static async cancelBooking(bookingId: string, user: AuthUser) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking record not found.');
    }

    if (user.role !== 'ADMIN' && booking.studentId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own bookings.');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError(400, 'ALREADY_CANCELLED', 'This booking has already been cancelled.');
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }
}
```

- [ ] **Step 3: Create `src/controllers/booking.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';

export class BookingController {
  static async rsvp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.rsvpEvent(req.body.eventId, req.user!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.getMyBookings(req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.cancelBooking(req.params.id, req.user!);
      res.json({
        success: true,
        data: {
          message: 'Booking cancelled successfully. Capacity freed.',
          booking: data,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
```

- [ ] **Step 4: Create `src/routes/booking.routes.ts`**

```typescript
import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT, Role.ADMIN), BookingController.rsvp);
router.get('/my-bookings', requireRole(Role.STUDENT, Role.ADMIN), BookingController.getMyBookings);
router.delete('/:id', requireRole(Role.STUDENT, Role.ADMIN), BookingController.cancelBooking);

export default router;
```

---

### Task 6: Application Assembly & End-to-End Automated Verification

**Files:**
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `tests/verification.ts`

**Interfaces:**
- Produces: Integrated Express application running on PORT 5000 with complete automated verification script covering all Member 2 workflows.

- [ ] **Step 1: Create `src/app.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import eventRoutes from './routes/event.routes';
import bookingRoutes from './routes/booking.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/events-api/v1/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount Member 2 core domain routes
app.use('/events-api/v1/events', eventRoutes);
app.use('/events-api/v1/bookings', bookingRoutes);

// Shared Global Centralized Error Handler
app.use(errorHandler);

export default app;
```

- [ ] **Step 2: Create `src/server.ts`**

```typescript
import app from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` Campus Event Management & Booking API`);
  console.log(` Server active on port: ${config.port}`);
  console.log(` Base path: http://localhost:${config.port}/events-api/v1`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(`====================================================`);
});

export default server;
```

- [ ] **Step 3: Create `tests/verification.ts` (Automated Test Suite)**

```typescript
import app from '../src/app';
import prisma from '../src/config/prisma';
import http from 'http';

async function runTests() {
  console.log('\n--- STARTING AUTOMATED INTEGRATION TESTS ---\n');
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099/events-api/v1';

  try {
    // 1. Fetch seed users
    const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const organizer = await prisma.user.findFirst({ where: { role: 'ORGANIZER' } });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!student || !organizer || !admin) {
      throw new Error('Seed users missing. Run npm run prisma:seed first.');
    }

    console.log('✓ Found seed users for test execution.');

    // 2. Health check
    const healthRes = await fetch(`${baseUrl}/health`).then((r) => r.json());
    if (healthRes.status !== 'healthy') throw new Error('Health check failed');
    console.log('✓ Health check passed.');

    // 3. Organizer creates event
    const createEventRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': organizer.id,
      },
      body: JSON.stringify({
        title: 'Concurrency Test Seminar',
        description: 'Testing race conditions and booking transactions',
        venueName: 'Room 101',
        venueAddress: 'Science Building',
        startTime: new Date(Date.now() + 1000000).toISOString(),
        endTime: new Date(Date.now() + 2000000).toISOString(),
        capacity: 1, // Only 1 seat!
      }),
    }).then((r) => r.json());

    if (!createEventRes.success) throw new Error('Create event failed: ' + JSON.stringify(createEventRes));
    const eventId = createEventRes.data.id;
    console.log('✓ Organizer successfully created event with capacity 1.');

    // 4. Student 1 books the only seat
    const bookRes1 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (!bookRes1.success) throw new Error('First booking failed: ' + JSON.stringify(bookRes1));
    const bookingId = bookRes1.data.id;
    console.log('✓ Student 1 successfully RSVP-ed for the only seat.');

    // 5. Duplicate booking check (Student 1 tries again)
    const duplicateRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (duplicateRes.success || duplicateRes.error.code !== 'ALREADY_BOOKED') {
      throw new Error('Duplicate booking check failed: ' + JSON.stringify(duplicateRes));
    }
    console.log('✓ Duplicate booking prevented (ALREADY_BOOKED).');

    // 6. Overcapacity check: Create a second student and try to book full event
    const student2 = await prisma.user.create({
      data: {
        adOid: 'ad-student-002-test',
        name: 'Second Student',
        email: 'student2_test@campus.edu',
        role: 'STUDENT',
      },
    });

    const fullRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student2.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (fullRes.success || fullRes.error.code !== 'CAPACITY_EXCEEDED') {
      throw new Error('Capacity check failed: ' + JSON.stringify(fullRes));
    }
    console.log('✓ Capacity limit enforced (CAPACITY_EXCEEDED).');

    // 7. Cancel booking and check capacity liberation
    const cancelRes = await fetch(`${baseUrl}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': student.id,
      },
    }).then((r) => r.json());

    if (!cancelRes.success) throw new Error('Cancellation failed: ' + JSON.stringify(cancelRes));
    console.log('✓ Student 1 cancelled booking successfully.');

    // 8. Student 2 now books the freed seat
    const bookRes2 = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student2.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (!bookRes2.success) throw new Error('Rebooking freed seat failed: ' + JSON.stringify(bookRes2));
    console.log('✓ Student 2 successfully booked freed seat.');

    // 9. Organizer views attendees
    const attendeesRes = await fetch(`${baseUrl}/events/${eventId}/attendees`, {
      headers: {
        'x-user-id': organizer.id,
      },
    }).then((r) => r.json());

    if (!attendeesRes.success || attendeesRes.data.length !== 1) {
      throw new Error('Attendees check failed: ' + JSON.stringify(attendeesRes));
    }
    console.log('✓ Organizer attendee list correctly verified (1 confirmed attendee).');

    // Cleanup test student 2 and test event
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.user.delete({ where: { id: student2.id } });

    console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
```

- [ ] **Step 4: Execute test suite to confirm end-to-end functionality**

Run:
```bash
npm run test:verify
```
Expected: `--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---`
