# Campus Event Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a polished, responsive, role-aware React web interface for the campus event booking API.

**Architecture:** A separate `web/` React/Vite package consumes the existing Express API through a typed fetch client and authenticates university users through a dedicated Microsoft Entra SPA registration using Authorization Code Flow with PKCE. Nginx serves the compiled SPA at `/` and preserves the existing `/events-api/` reverse proxy, TLS, private PostgreSQL topology, managed identity, and Key Vault flow.

**Tech Stack:** React 19.2.7, TypeScript 5.9, Vite 8.3.0 on Node 22, React Router DOM 7.18.3, `@azure/msal-browser` 5.21.0, Vitest 5, React Testing Library 16.3.3, Testing Library User Event 14.6.7, CSS custom properties, Nginx, Docker BuildKit

**Spec:** `docs/superpowers/specs/2026-09-16-campus-event-web-ui-design.md`

## Global Constraints

- UI language is English only.
- Visual style is minimal academic: white surfaces, sky-blue accents, dark navy text, generous spacing, rounded cards, restrained shadows, and clear typography.
- Local UI is `http://localhost:5173`; local API is `http://localhost:5000/events-api/v1`.
- Azure UI is `https://campus-event-api.eastasia.cloudapp.azure.com/`; Azure API remains under `/events-api/v1` on the same origin.
- The frontend contains no client secret, Key Vault value, peer API key, production JWT secret, database URL, or committed access/refresh token.
- MSAL uses Authorization Code Flow with PKCE and session-backed cache only; application code must not write tokens to local storage.
- The API remains the authority for authentication, authorization, role, ownership, capacity, and validation decisions.
- Public users may browse events and weather; protected actions require Microsoft Entra authentication.
- `STUDENT` and `ADMIN` may book/cancel; `ORGANIZER` and `ADMIN` may create/manage events and view attendees.
- Existing Docker, private PostgreSQL, managed identity, Key Vault, UFW, NSG, TLS, and `/events-api/` behavior must remain intact.
- Every task uses test-driven development and ends with a focused commit after a fresh review gate.
- External actions—Azure app changes, role assignments, secret revocation, public deployment, and push—require explicit action-time confirmation.

## File Structure

The implementation creates or changes these focused units:

```text
web/
  package.json                  frontend dependency and script boundary
  package-lock.json             reproducible frontend dependency graph
  index.html                    Vite document shell
  tsconfig*.json                browser and tooling TypeScript settings
  vite.config.ts                Vite dev proxy and Vitest configuration
  Dockerfile                    Node 22 static build export
  .env.example                  non-secret public configuration keys
  src/
    main.tsx                    MSAL initialization and React bootstrap
    App.tsx                     router and global provider composition
    vite-env.d.ts               typed Vite environment variables
    config/env.ts               fail-fast public configuration parser
    api/types.ts                shared API/domain response contracts
    api/client.ts               typed fetch and normalized errors
    api/events.ts               event endpoint functions
    api/bookings.ts             booking endpoint functions
    api/auth.ts                 authenticated profile endpoint function
    auth/msal.ts                MSAL configuration and login request
    auth/AuthProvider.tsx       account, token, profile, and auth actions
    auth/useAuth.ts             guarded auth-context accessor
    auth/RequireRole.tsx        route-level authentication/role UI guard
    components/                 reusable shell, controls, feedback, dialogs
    features/events/            discovery, detail, weather, and event forms
    features/bookings/          booking list and cancellation
    features/manage/            organizer list and attendees
    routes/                     route components and not-found screen
    styles/tokens.css           design tokens
    styles/global.css           reset, typography, responsive foundations
    test/setup.ts               DOM matchers and test cleanup
    test/render.tsx             provider-aware test render helper
scripts/deploy-web.sh           exact-ref Docker build and atomic web-root release
nginx/default.conf              HTTPS SPA serving plus existing API proxy
tests/deployment-assets.test.ts frontend deployment/static routing assertions
README.md                       local UI, Entra, and production instructions
docs/deployment/azure-runbook.md non-secret deployed evidence
```

---

### Task 1: Frontend Package, Configuration, and Academic Design Foundation

**Files:**
- Create: `web/package.json`
- Create: `web/package-lock.json`
- Create: `web/index.html`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.app.json`
- Create: `web/tsconfig.node.json`
- Create: `web/vite.config.ts`
- Create: `web/.env.example`
- Create: `web/src/vite-env.d.ts`
- Create: `web/src/config/env.ts`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/components/AppShell.tsx`
- Create: `web/src/components/AppShell.test.tsx`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/global.css`
- Create: `web/src/test/setup.ts`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: Node 22 and npm; no backend interface yet.
- Produces: `publicEnv`, `App`, `AppShell`, the design-token contract, and root scripts `web:dev`, `web:build`, and `web:test`.

- [ ] **Step 1: Write the failing shell and configuration tests**

Create `web/src/components/AppShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('presents the academic product identity and public navigation', () => {
    render(<MemoryRouter><AppShell><p>Page body</p></AppShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: /campus events/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
```

Add an env parser test beside `env.ts` that stubs `import.meta.env` through exported `parsePublicEnv` and expects a clear error when `VITE_ENTRA_CLIENT_ID` is empty.

- [ ] **Step 2: Create the package manifest and run the test to prove the package is absent**

Use these exact package versions:

```json
{
  "name": "campus-event-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@azure/msal-browser": "5.21.0",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-router-dom": "7.18.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "27.0.0",
    "typescript": "5.9.2",
    "vite": "8.3.0",
    "vitest": "5.0.0"
  }
}
```

Run `npm install --prefix web`, then `npm run web:test -- src/components/AppShell.test.tsx`.

Expected: FAIL because `AppShell` and frontend configuration do not exist yet.

- [ ] **Step 3: Implement the minimal package and configuration boundary**

`web/src/config/env.ts` exposes:

```ts
export interface PublicEnv {
  apiBaseUrl: string;
  tenantId: string;
  clientId: string;
  apiScope: string;
  redirectUri: string;
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv;
export const publicEnv: PublicEnv;
```

Use empty values in `web/.env.example` for `VITE_ENTRA_CLIENT_ID`; include the known tenant, scope, local API URL, and local redirect URI. Add `web/.env.local` and `web/dist/` to `.gitignore`.

Add root scripts:

```json
"web:dev": "npm --prefix web run dev",
"web:build": "npm --prefix web run build",
"web:test": "npm --prefix web run test"
```

- [ ] **Step 4: Implement the minimal shell and visual tokens**

`AppShell` renders a skip link, header, `Campus Events` brand, primary navigation landmark, `<main id="main-content">`, and footer. Define named CSS tokens including `--color-sky-500`, `--color-navy-900`, `--surface`, `--border`, `--radius-card`, `--shadow-card`, and spacing values. Use a system-font stack and do not depend on a remote font.

- [ ] **Step 5: Run focused and package checks**

Run:

```bash
npm run web:test
npm run web:build
git diff --check
```

Expected: frontend tests and production build pass; generated files are ignored except `web/package-lock.json`.

- [ ] **Step 6: Commit the foundation**

```bash
git add .gitignore package.json web
git commit -m "feat: scaffold campus event web app"
```

---

### Task 2: Typed API Client and Domain Contracts

**Files:**
- Create: `web/src/api/types.ts`
- Create: `web/src/api/client.ts`
- Create: `web/src/api/client.test.ts`
- Create: `web/src/api/events.ts`
- Create: `web/src/api/bookings.ts`
- Create: `web/src/api/auth.ts`

**Interfaces:**
- Consumes: `publicEnv.apiBaseUrl` and an optional `getAccessToken(): Promise<string | null>`.
- Produces: `ApiClient`, `ApiError`, `EventSummary`, `EventDetail`, `Booking`, `UserProfile`, `EventInput`, `EventFilters`, and endpoint functions used by all feature tasks.

- [ ] **Step 1: Define response contracts and a failing API-client test**

Use these central contracts:

```ts
export type Role = 'STUDENT' | 'ORGANIZER' | 'ADMIN';
export interface ApiEnvelope<T> { success: true; data: T }
export interface ApiFailure { success: false; error: { code: string; message: string } }
export interface Organizer { id: string; name: string; email: string }
export interface EventSummary {
  id: string; title: string; description: string; venueName: string;
  venueAddress: string; mapImageUrl: string | null; startTime: string;
  endTime: string; capacity: number; confirmedBookings: number;
  remainingCapacity: number; organizer: Organizer; createdAt: string;
}
export interface Weather {
  source: 'open-meteo'; available: boolean; temperatureC: number | null;
  weatherCode: number | null; observedAt: string | null; reason?: string;
}
export interface EventDetail extends EventSummary { weather: Weather }
export interface Booking {
  id: string; status: 'CONFIRMED' | 'CANCELLED'; bookedAt: string;
  event: Pick<EventSummary, 'id' | 'title' | 'venueName' | 'venueAddress' | 'startTime' | 'endTime'>;
}
export interface UserProfile extends Organizer {
  adOid: string; role: Role; _count: { bookings: number; events: number };
}
```

Test that `request('/auth/me', { auth: true })` injects `Authorization: Bearer token`, parses a successful envelope, and converts a backend `403` envelope into `ApiError` with `status`, `code`, and safe `message`.

- [ ] **Step 2: Run the client test to verify failure**

Run `npm run web:test -- src/api/client.test.ts`.

Expected: FAIL because `createApiClient` and `ApiError` are missing.

- [ ] **Step 3: Implement the fetch boundary**

Expose:

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface ApiClient {
  request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T>;
}
export function createApiClient(options: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
}): ApiClient;
```

Trim one trailing slash from the base URL, set `Accept: application/json`, set `Content-Type` only when a body exists, attach a bearer token only for `auth: true`, handle non-JSON failures safely, and never log headers or tokens.

- [ ] **Step 4: Implement endpoint modules**

Expose these exact functions:

```ts
listEvents(client: ApiClient, filters: EventFilters): Promise<EventSummary[]>
getEvent(client: ApiClient, id: string): Promise<EventDetail>
createEvent(client: ApiClient, input: EventInput): Promise<EventSummary>
updateEvent(client: ApiClient, id: string, input: Partial<EventInput>): Promise<EventSummary>
deleteEvent(client: ApiClient, id: string): Promise<{ message: string }>
getAttendees(client: ApiClient, id: string): Promise<Attendee[]>
getMyBookings(client: ApiClient): Promise<Booking[]>
createBooking(client: ApiClient, eventId: string): Promise<Booking>
cancelBooking(client: ApiClient, id: string): Promise<{ message: string; booking: Booking }>
getMyProfile(client: ApiClient): Promise<UserProfile>
```

Serialize event filters with `URLSearchParams`; omit empty strings and false `upcoming` values.

- [ ] **Step 5: Run tests and commit**

```bash
npm run web:test
npm run web:build
git add web/src/api
git commit -m "feat: add typed campus event API client"
```

---

### Task 3: MSAL Authentication and Role-Aware Application Shell

**Files:**
- Create: `web/src/auth/msal.ts`
- Create: `web/src/auth/AuthProvider.tsx`
- Create: `web/src/auth/AuthProvider.test.tsx`
- Create: `web/src/auth/useAuth.ts`
- Create: `web/src/auth/RequireRole.tsx`
- Create: `web/src/api/ApiProvider.tsx`
- Create: `web/src/api/useApi.ts`
- Create: `web/src/components/ProfileMenu.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Create: `web/src/test/render.tsx`

**Interfaces:**
- Consumes: `publicEnv`, MSAL `PublicClientApplication`, and `getMyProfile()`.
- Produces: `AuthState`, `AuthProvider`, `useAuth()`, `RequireRole`, `ApiProvider`, `useApi()`, and `getAccessToken()` for the API client.

- [ ] **Step 1: Write failing authentication-state tests**

Test these states with a mocked MSAL adapter:

```tsx
expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /sign in with microsoft/i }));
expect(mockLoginPopup).toHaveBeenCalledWith(expect.objectContaining({ scopes: [expectedScope] }));
expect(await screen.findByText('ORGANIZER')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /sign out/i }));
expect(mockLogoutPopup).toHaveBeenCalled();
```

Also test that a failed `/auth/me` request exposes a retryable error and does not claim a role from unverified token data.

- [ ] **Step 2: Run the auth tests to verify failure**

Run `npm run web:test -- src/auth/AuthProvider.test.tsx`.

Expected: FAIL because the provider and auth controls do not exist.

- [ ] **Step 3: Configure MSAL for session-only PKCE**

`web/src/auth/msal.ts` exports `msalInstance` and `loginRequest`. Configure:

```ts
cache: {
  cacheLocation: 'sessionStorage',
  storeAuthStateInCookie: false,
}
```

Use the tenant-specific authority, dedicated SPA client ID, `navigateToLoginRequestUrl: false`, and the one backend API scope. Initialize MSAL before rendering React and process any redirect result before setting the active account.

- [ ] **Step 4: Implement the authentication provider**

Expose:

```ts
export interface AuthState {
  status: 'anonymous' | 'loading' | 'authenticated' | 'error';
  profile: UserProfile | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  retryProfile(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}
```

Attempt `acquireTokenSilent` first and use `acquireTokenPopup` only for MSAL interaction-required errors. Do not catch and print token objects. After sign-in, call `/auth/me`; the returned database role drives navigation.

`AuthProvider` may construct a private `ApiClient` to call `getMyProfile(client)`. Nest `ApiProvider` inside `AuthProvider`; it consumes `getAccessToken`, constructs the feature-facing `ApiClient`, and exposes it through `useApi()`. This avoids shared mutable token state and keeps feature code independent of MSAL.

- [ ] **Step 5: Add role-aware navigation and guards**

Public navigation always shows Events. `STUDENT` and `ADMIN` show My Bookings. `ORGANIZER` and `ADMIN` show Manage Events. `RequireRole` renders a sign-in prompt for anonymous users and a permission explanation for authenticated users outside the allowed roles; it does not replace backend enforcement.

- [ ] **Step 6: Run tests, build, and commit**

```bash
npm run web:test
npm run web:build
git add web/src/auth web/src/components web/src/test web/src/main.tsx web/src/App.tsx
git commit -m "feat: add Entra PKCE authentication shell"
```

---

### Task 4: Public Event Discovery and Weather Details

**Files:**
- Create: `web/src/features/events/EventFilters.tsx`
- Create: `web/src/features/events/EventCard.tsx`
- Create: `web/src/features/events/EventGrid.tsx`
- Create: `web/src/features/events/WeatherCard.tsx`
- Create: `web/src/routes/EventsPage.tsx`
- Create: `web/src/routes/EventsPage.test.tsx`
- Create: `web/src/routes/EventDetailPage.tsx`
- Create: `web/src/routes/EventDetailPage.test.tsx`
- Create: `web/src/components/LoadingSkeleton.tsx`
- Create: `web/src/components/EmptyState.tsx`
- Create: `web/src/components/Notice.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `listEvents`, `getEvent`, `EventSummary`, `EventDetail`, and `useAuth()`.
- Produces: public `/` and `/events/:eventId` routes plus reusable event/weather presentation.

- [ ] **Step 1: Write failing discovery and detail tests**

Cover:

```tsx
expect(await screen.findByText('Cloud Computing Workshop')).toBeInTheDocument();
await user.type(screen.getByLabelText(/search events/i), 'cloud');
await user.click(screen.getByRole('button', { name: /apply filters/i }));
expect(mockListEvents).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'cloud' }));
```

For details, assert capacity, organizer, venue, and temperature render when weather is available; assert `Weather is temporarily unavailable` when `available` is false.

- [ ] **Step 2: Run focused tests to verify failure**

Run `npm run web:test -- src/routes/EventsPage.test.tsx src/routes/EventDetailPage.test.tsx`.

Expected: FAIL because the route components are absent.

- [ ] **Step 3: Implement event discovery**

Use controlled form fields for `search`, `venue`, `date`, and `upcoming`. Fetch only on initial load and explicit Apply/Clear actions, abort or ignore stale requests, and expose loading, empty, success, and error states. Event cards show title, venue, formatted date/time, remaining capacity, organizer, and a Details link.

- [ ] **Step 4: Implement event details and weather fallback**

Fetch by the route parameter. Render a semantic `<article>`, schedule, venue/address, remaining capacity, and `WeatherCard`. Public users see `Sign in to book`; students/admins receive the booking action hook implemented in Task 5; organizers do not receive booking controls.

- [ ] **Step 5: Add responsive academic styling**

Use CSS Grid with `minmax(16rem, 1fr)`, a contained content width, native form controls, visible focus rings, readable status labels, and no remote imagery requirement. Use `mapImageUrl` only when present and provide an accessible venue fallback panel when absent.

- [ ] **Step 6: Verify and commit**

```bash
npm run web:test
npm run web:build
git add web/src/features/events web/src/routes web/src/components web/src/App.tsx
git commit -m "feat: add public event discovery UI"
```

---

### Task 5: Student Booking Experience

**Files:**
- Create: `web/src/features/bookings/BookEventButton.tsx`
- Create: `web/src/features/bookings/BookingCard.tsx`
- Create: `web/src/routes/MyBookingsPage.tsx`
- Create: `web/src/routes/MyBookingsPage.test.tsx`
- Create: `web/src/components/ConfirmDialog.tsx`
- Create: `web/src/components/ToastProvider.tsx`
- Modify: `web/src/routes/EventDetailPage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `createBooking`, `getMyBookings`, `cancelBooking`, `useAuth()`, and event capacity.
- Produces: `/bookings`, booking/cancellation interactions, `ConfirmDialog`, and `useToast()`.

- [ ] **Step 1: Write failing booking tests**

Test confirmed and cancelled cards, cancellation confirmation, success refresh, and error messaging:

```tsx
await user.click(screen.getByRole('button', { name: /cancel booking/i }));
expect(screen.getByRole('dialog', { name: /cancel booking/i })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /^confirm cancellation$/i }));
expect(mockCancelBooking).toHaveBeenCalledWith('booking-1');
expect(await screen.findByText(/booking cancelled/i)).toBeInTheDocument();
```

Test `ALREADY_BOOKED` and `CAPACITY_EXCEEDED` as friendly messages.

- [ ] **Step 2: Run focused tests to verify failure**

Run `npm run web:test -- src/routes/MyBookingsPage.test.tsx`.

Expected: FAIL because booking components are absent.

- [ ] **Step 3: Implement booking and cancellation**

`BookEventButton` disables itself while submitting and when `remainingCapacity === 0`. `MyBookingsPage` fetches authenticated bookings, visually distinguishes `CONFIRMED` and `CANCELLED`, confirms cancellation in an accessible modal, and replaces only the affected booking after success.

- [ ] **Step 4: Implement global feedback**

`ToastProvider` exposes `notify({ tone: 'success' | 'error' | 'info', message: string })`. Toasts use `role="status"` for ordinary updates and `role="alert"` for errors, dismiss automatically after five seconds, and remain manually dismissible.

- [ ] **Step 5: Verify and commit**

```bash
npm run web:test
npm run web:build
git add web/src/features/bookings web/src/routes/MyBookingsPage* web/src/components/ConfirmDialog.tsx web/src/components/ToastProvider.tsx web/src/routes/EventDetailPage.tsx web/src/App.tsx
git commit -m "feat: add student booking workflows"
```

---

### Task 6: Organizer Event Management and Attendees

**Files:**
- Create: `web/src/features/manage/EventForm.tsx`
- Create: `web/src/features/manage/ManagedEventCard.tsx`
- Create: `web/src/features/manage/AttendeeDialog.tsx`
- Create: `web/src/routes/ManageEventsPage.tsx`
- Create: `web/src/routes/ManageEventsPage.test.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: event CRUD and attendee functions from `web/src/api/events.ts`, `useAuth()`, `ConfirmDialog`, and `useToast()`.
- Produces: `/manage/events`, create/edit/delete forms, and authorized attendee viewing.

- [ ] **Step 1: Write failing management tests**

Test role-gated rendering, required form fields, time ordering, capacity minimum, successful create/edit, confirmation before deletion, and lazy attendee loading:

```tsx
await user.click(screen.getByRole('button', { name: /view attendees/i }));
expect(mockGetAttendees).toHaveBeenCalledTimes(1);
expect(await screen.findByText('student@campus.edu')).toBeInTheDocument();
```

Assert that an organizer does not see edit/delete controls for an event whose `organizer.id` differs from `profile.id`; an admin sees all controls.

- [ ] **Step 2: Run focused tests to verify failure**

Run `npm run web:test -- src/routes/ManageEventsPage.test.tsx`.

Expected: FAIL because the management route and form do not exist.

- [ ] **Step 3: Implement the event form**

Use one `EventForm` for create and edit. Fields are title, description, venue name, venue address, optional map image URL, start datetime, end datetime, and integer capacity. Convert `datetime-local` values to ISO strings before API submission. Validate required text, `capacity >= 1`, and `startTime < endTime` before sending.

- [ ] **Step 4: Implement management and attendee views**

Reuse the event list response. Organizer controls appear only for owned events; admins may manage every event. Delete uses `ConfirmDialog`. Attendee data is requested only when the dialog opens and shows name, email, and booking time without caching it globally.

- [ ] **Step 5: Verify and commit**

```bash
npm run web:test
npm run web:build
git add web/src/features/manage web/src/routes/ManageEventsPage* web/src/App.tsx
git commit -m "feat: add organizer event management UI"
```

---

### Task 7: Integrated Routing, Accessibility, and Responsive Quality

**Files:**
- Create: `web/src/routes/NotFoundPage.tsx`
- Create: `web/src/App.integration.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/ConfirmDialog.tsx`
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Consumes: all frontend providers, routes, and components from Tasks 1–6.
- Produces: the complete role-aware application and accessibility regression gate.

- [ ] **Step 1: Write failing integration/accessibility tests**

Cover anonymous, student, organizer, and admin navigation; direct forbidden-route handling; skip-link target; dialog focus return; Escape cancellation; and reduced-motion CSS. Include:

```tsx
expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
expect(screen.queryByRole('link', { name: /manage events/i })).not.toBeInTheDocument();
```

Render at narrow width and assert management data retains accessible headings rather than depending on a wide table.

- [ ] **Step 2: Run the integration test to verify failure**

Run `npm run web:test -- src/App.integration.test.tsx`.

Expected: FAIL on incomplete routing/focus/responsive behavior.

- [ ] **Step 3: Complete the route tree**

Configure:

```text
/                    EventsPage
/events/:eventId     EventDetailPage
/bookings            RequireRole(STUDENT, ADMIN) -> MyBookingsPage
/manage/events       RequireRole(ORGANIZER, ADMIN) -> ManageEventsPage
*                    NotFoundPage
```

Wrap the router with `AuthProvider` and `ToastProvider`; keep route components unaware of raw MSAL APIs.

- [ ] **Step 4: Complete focus, motion, and responsive behavior**

Return focus to the trigger when a dialog closes, focus the dialog heading on open, lock background interaction while open, and support Escape for non-submitting dialogs. Add `@media (prefers-reduced-motion: reduce)` and mobile breakpoints that stack filters/actions and preserve 44px touch targets.

- [ ] **Step 5: Run all frontend gates and commit**

```bash
npm run web:test
npm run web:build
git diff --check
git add web/src
git commit -m "feat: polish responsive campus event experience"
```

---

### Task 8: Reproducible Static Build and Nginx SPA Deployment

**Files:**
- Create: `web/Dockerfile`
- Create: `scripts/deploy-web.sh`
- Modify: `nginx/default.conf`
- Modify: `tests/deployment-assets.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: exact approved Git SHA, non-secret Vite build arguments, Docker BuildKit, existing Nginx TLS paths, and `/events-api/` proxy.
- Produces: `/var/www/campus-event/releases/<sha>`, atomic `/var/www/campus-event/current`, and SPA routing at the HTTPS origin.

- [ ] **Step 1: Add failing deployment-asset assertions**

Extend `tests/deployment-assets.test.ts` to assert:

```ts
assert.match(nginxConfig, /root \/var\/www\/campus-event\/current;/);
assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html;/);
assert.match(nginxConfig, /location \/events-api\//);
assert.match(deployWebScript, /docker buildx build/);
assert.match(deployWebScript, /ln -sfn/);
```

Also assert the script requires exactly the Git SHA, SPA client ID, and backend scope as arguments; validates a 40-character lowercase SHA; and never contains secret-variable names.

- [ ] **Step 2: Run the deployment test to verify failure**

Run `npm run test:unit -- --test-name-pattern="frontend deployment"`.

Expected: FAIL because static deployment assets do not exist.

- [ ] **Step 3: Create the BuildKit export image**

`web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_ENTRA_TENANT_ID
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_API_SCOPE
ARG VITE_ENTRA_REDIRECT_URI
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID \
    VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID \
    VITE_ENTRA_API_SCOPE=$VITE_ENTRA_API_SCOPE \
    VITE_ENTRA_REDIRECT_URI=$VITE_ENTRA_REDIRECT_URI
RUN npm run test && npm run build

FROM scratch AS export
COPY --from=build /app/dist /
```

- [ ] **Step 4: Implement atomic deployment**

`scripts/deploy-web.sh` accepts `<40-char-sha> <spa-client-id>`, refuses to run as root, derives the known tenant/scope/origin, verifies `git rev-parse HEAD` exactly matches the SHA, exports the build into a mode-755 staging directory with `docker buildx build --target export --output type=local`, uses narrowly scoped `sudo install`/`sudo ln` commands to move it to `/var/www/campus-event/releases/$SHA`, switches `current` with `ln -sfn`, validates `nginx -t`, reloads Nginx, and removes only its own staging directory on exit. It never deletes earlier releases or modifies API containers.

- [ ] **Step 5: Update Nginx without changing the working TLS setup**

Keep the `/events-api/` location before the SPA location. Replace the HTTPS root 404 with:

```nginx
root /var/www/campus-event/current;
index index.html;

location / {
    try_files $uri $uri/ /index.html;
}
```

Add long immutable caching only for Vite fingerprinted `/assets/` files; keep `index.html` uncached. Preserve the existing certificate paths, TLS protocols, security headers, ACME path, and API proxy verbatim. The previously observed IMDS-empty behavior in `configure-nginx.sh` is a separate hardening concern and is not changed by this UI release.

- [ ] **Step 6: Verify deployment assets and commit**

```bash
bash -n scripts/deploy-web.sh
npm run test:unit
npm run web:test
npm run web:build
git diff --check
git add web/Dockerfile scripts/deploy-web.sh nginx/default.conf tests/deployment-assets.test.ts README.md
git commit -m "feat: deploy static campus event web app"
```

---

### Task 9: Entra Configuration, Local Verification, and Azure Release

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment/azure-runbook.md`
- Modify locally only: `web/.env.local`
- Do not commit: tokens, role-assignment output containing personal details, secrets, or `web/.env.local`

**Interfaces:**
- Consumes: the backend app registration, a new SPA app registration, the reviewed frontend exact SHA, and the deployment script from Task 8.
- Produces: working local and Azure UI, PKCE authentication, role-aware production evidence, and non-secret documentation.

- [ ] **Step 1: Request action-time approval and configure the backend API registration**

After explicit approval, set on `campus-event-booking-api`:

```text
Application ID URI: api://d16771d8-2e37-476a-be7c-63f4ed09c819
Delegated scope: access_as_user
Who can consent: Admins and users
Access token version: 2
Mobile/desktop redirect for Postman: https://oauth.pstmn.io/v1/callback
App roles (Users/Groups): STUDENT, ORGANIZER, ADMIN
```

Use human-readable display names matching each value and descriptions stating the allowed campus-event behavior. Assign the presenting AU account `ORGANIZER` on the backend enterprise application only after explicit permission-change confirmation.

- [ ] **Step 2: Create and configure the dedicated SPA registration**

After explicit account/API-creation confirmation, create a single-tenant app named `campus-event-booking-web`. Configure SPA redirect URIs exactly:

```text
http://localhost:5173
https://campus-event-api.eastasia.cloudapp.azure.com/
```

Add delegated permission `api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user`. Do not create a client secret. Record only the generated SPA Application (client) ID as a non-secret deployment identifier.

- [ ] **Step 3: Verify locally**

Create ignored `web/.env.local` with the generated SPA client ID and the approved public values. Run:

```bash
npm run dev
npm run web:dev
```

Verify public event discovery, detail weather, Microsoft login, `/auth/me`, role-aware navigation, organizer create/edit/delete/attendees, keyboard operation, and mobile/desktop layouts. Use a disposable local database for destructive CRUD verification.

- [ ] **Step 4: Commit and request push/deployment approval**

Run full local gates:

```bash
npm run build
npm run test:unit
npm run test:verify
npm run web:test
npm run web:build
git diff --check
git status --short
```

Commit only reviewed source/configuration/docs changes, request explicit push approval, push the branch, and verify the remote branch resolves to the exact local SHA.

- [ ] **Step 5: Deploy the exact frontend revision**

After explicit public-deployment confirmation, fetch the reviewed branch on the VM, check out the exact 40-character SHA detached, and run:

```bash
./scripts/deploy-web.sh "$DEPLOYED_SHA" "$SPA_CLIENT_ID"
```

Verify the release directory and `current` symlink, `nginx -t`, active Nginx, unchanged healthy API/PostgreSQL containers, no host `5432`, API still bound only to `127.0.0.1:5000`, HTTP redirect, HTTPS UI `200`, SPA deep-link fallback, and API health `200`.

- [ ] **Step 6: Run production role workflows without exposing tokens**

Interactively sign in through the UI. Verify:

1. Public event listing and detail weather.
2. `/auth/me` succeeds and returns the database `ORGANIZER` role.
3. Organizer creates, edits, views attendees for, and deletes one uniquely named test event.
4. Missing bearer token returns `401`; an unauthorized role receives `403` without weakening the API.
5. Browser refresh restores the MSAL session and silently reacquires access.
6. Sign-out clears the application session.

Do not print, copy, export, or commit any token.

- [ ] **Step 7: Revoke the disclosed legacy client secret only after PKCE succeeds**

At the Certificates & secrets blade, identify the existing credential by key ID `af9061ab-9ecb-4ce2-9342-90e329ee3a85`. Request explicit deletion confirmation at action time, delete that credential, and verify the registration reports zero client secrets. Do not create a replacement.

- [ ] **Step 8: Record non-secret deployment evidence and finish**

Update README and `docs/deployment/azure-runbook.md` with frontend SHA, public URL, SPA client ID, API scope, app-role names, build/test results, Nginx/TLS/UI/API health, and workflow status. Exclude personal account details, tokens, secrets, and environment dumps.

Run final gates and commit documentation:

```bash
npm run build
npm run test:unit
npm run test:verify
npm run web:test
npm run web:build
git diff --check
git status --short
git add README.md docs/deployment/azure-runbook.md
git commit -m "docs: record verified campus event web deployment"
```

Request explicit push approval, push the final documentation commit, verify the remote SHA, and capture presentation screenshots containing no secrets or tokens.

---

## Rollback

1. Before switching the UI, record the current `/var/www/campus-event/current` symlink target and deployed Git SHA.
2. If the new UI fails, atomically point `current` back to the preceding release directory, run `sudo nginx -t`, and reload Nginx.
3. Do not delete the PostgreSQL volume, Key Vault, certificate, previous UI releases, or API checkout during a UI rollback.
4. If an Entra SPA configuration is wrong, remove only the incorrect redirect/permission after explicit confirmation; do not weaken token validation or restore a client secret.
