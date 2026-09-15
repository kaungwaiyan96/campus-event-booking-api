# Campus Event Web UI Design

**Date:** 2026-09-16  
**Status:** Approved for implementation planning

## Objective

Add a polished, responsive web interface to the existing campus event booking backend. The interface will support public event discovery and role-aware authenticated workflows while preserving the backend as the security authority. Development will be verified locally before the same application is deployed to the existing Azure VM.

## Product Scope

The application is a single English-language, role-aware web app with a minimal academic visual style: white surfaces, sky-blue accents, dark navy text, generous spacing, rounded cards, restrained shadows, and clear typography.

The included user experiences are:

- Public event browsing with search, venue and date filters, and an upcoming-events toggle.
- Event details with venue, schedule, capacity, and Open-Meteo weather status.
- Microsoft Entra ID sign-in and sign-out.
- Student and administrator booking creation, booking history, and cancellation.
- Organizer and administrator event creation, editing, deletion, and attendee viewing.
- A profile menu showing the signed-in university identity and effective application role.
- Loading skeletons, empty states, confirmation dialogs, and success/error notifications.

The first release will not add chat, payments, maps, image uploads, analytics, or a separate user-management interface. The existing backend has no user-list endpoint, so administrators will share organizer and student capabilities rather than receive an unsupported user administration screen.

## Architecture

Create a React, Vite, and TypeScript application in a top-level `web/` directory. It remains a distinct frontend package while living in the same repository as the Express API.

### Runtime topology

| Environment | UI | API |
| --- | --- | --- |
| Local | `http://localhost:5173` | `http://localhost:5000/events-api/v1` |
| Azure | `https://campus-event-api.eastasia.cloudapp.azure.com/` | `https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1` |

In production, Nginx serves the compiled React assets at `/`, falls back to `index.html` for client-side routes, and continues to proxy `/events-api/` to the API bound to `127.0.0.1:5000`. PostgreSQL remains private, and the existing Docker, managed identity, Key Vault, firewall, TLS, and API health architecture remains unchanged.

The frontend has no secrets. Environment-specific files contain only public configuration such as the API base URL, Entra tenant ID, SPA client ID, API scope, and redirect URI.

## Microsoft Entra ID Design

Use separate registrations for the resource API and the browser client.

### Backend API registration

The existing `campus-event-booking-api` registration owns:

- Application ID URI `api://d16771d8-2e37-476a-be7c-63f4ed09c819`.
- Delegated scope `access_as_user`.
- Access token version 2.
- User app roles with values `STUDENT`, `ORGANIZER`, and `ADMIN`.

### Frontend SPA registration

Create a separate single-tenant SPA registration for the React application. Configure these redirect URIs:

- `http://localhost:5173`
- `https://campus-event-api.eastasia.cloudapp.azure.com/`

Grant delegated access to the backend `access_as_user` scope. The SPA uses MSAL Browser with Authorization Code Flow and PKCE. It does not create or use a client secret.

Access tokens remain in MSAL's session-backed browser cache and are never committed, logged, embedded in source, or stored in application-managed local storage. On application startup, the client restores the signed-in account, silently acquires a token when possible, and calls `/auth/me` to obtain the database profile and effective role. Interactive sign-in is used only when required.

Frontend role checks control presentation only. Every protected operation remains enforced by the API's JWT, role, and ownership middleware.

## Application Structure

Keep units focused and independently testable:

- `auth/`: MSAL configuration, account lifecycle, token acquisition, and an auth provider hook.
- `api/`: typed request client, bearer-token injection, response parsing, and normalized API errors.
- `features/events/`: event list, filters, cards, details, weather, and organizer forms.
- `features/bookings/`: booking creation, booking list, and cancellation.
- `features/profile/`: profile menu and role display.
- `components/`: reusable layout, navigation, buttons, dialogs, fields, skeletons, empty states, and notifications.
- `routes/`: public and protected route composition with role-aware navigation.

The API client returns typed domain data and one normalized error shape. Feature components do not construct authorization headers or interpret arbitrary server payloads directly.

## Screens and Behavior

### Events home

The landing page includes a restrained academic hero, search controls, and a responsive card grid. Filters map directly to the existing `search`, `venue`, `date`, and `upcoming` query parameters. Empty and failed results are visually distinct.

### Event details

The page presents schedule, venue, address, capacity, remaining places, and weather. When Open-Meteo is unavailable, the UI states that weather is temporarily unavailable without treating the event request as failed. Booking controls appear only to signed-in `STUDENT` and `ADMIN` users.

### My Bookings

`STUDENT` and `ADMIN` users can view confirmed and cancelled bookings. Cancellation requires confirmation and updates the UI only after the API succeeds.

### Manage Events

`ORGANIZER` and `ADMIN` users can create and edit events through validated forms. Destructive event deletion requires a confirmation dialog. Attendee data is fetched only when an authorized user opens an event's attendee view.

### Authentication states

Public users can browse events and weather. Protected actions prompt Microsoft sign-in. A `401` clears stale UI authentication state and offers sign-in again. A `403` preserves the session but explains that the current role lacks permission. Server, network, and validation failures produce actionable messages without exposing internal details.

## Data Flow

1. The app loads public events without credentials.
2. Microsoft sign-in requests the backend delegated scope through the SPA registration.
3. The auth provider obtains a bearer token and calls `/auth/me`.
4. The UI derives navigation and available actions from the returned database role.
5. Feature services call the existing event, booking, auth, and attendee endpoints.
6. Successful mutations invalidate or refresh the smallest affected query state.
7. Backend authorization remains definitive if frontend state is missing, stale, or manipulated.

The first implementation should use a small, explicit data layer rather than introduce a broad state-management framework. Authentication context plus feature-local query state is sufficient for this scope.

## Accessibility and Responsive Design

- All interactive controls are keyboard accessible and have visible focus indicators.
- Inputs have programmatic labels and errors are associated with their fields.
- Dialogs manage focus and support Escape where cancellation is safe.
- Color contrast remains readable without relying on color alone for status.
- Layouts support mobile, tablet, and desktop widths; tables collapse into readable cards where appropriate.
- Motion is subtle and honors reduced-motion preferences.

## Testing Strategy

- Unit and component tests cover navigation, filters, weather fallback, forms, dialogs, role-specific actions, and error states.
- API-client tests cover successful responses, bearer-token injection, validation errors, `401`, `403`, and server/network failures.
- Authentication tests mock MSAL boundaries rather than use real tokens in automated tests.
- Production TypeScript and Vite builds must pass.
- A local browser smoke test verifies the UI against the local API.
- Azure verification covers public event discovery, Entra login, role-aware navigation, booking, organizer CRUD, HTTPS, and responsive layout.
- Existing backend tests and production health checks remain release gates.

## Deployment

Build the frontend from an approved exact Git SHA on the Azure VM. Install the compiled assets in a versioned or atomically replaceable web root, validate Nginx configuration, and reload Nginx only after validation succeeds. Preserve `/events-api/` proxying and the current Let's Encrypt certificate configuration.

Deployment documentation records the frontend Git SHA, build verification, public URL, Entra registration identifiers that are safe to disclose, and non-secret smoke-test results. No access tokens, client secrets, Key Vault values, or production peer keys are recorded.

## Success Criteria

- The UI runs locally and from the Azure HTTPS origin.
- Public users can browse and filter events and see weather availability.
- AU users can authenticate through Entra PKCE without a client secret.
- Each role sees only relevant navigation and actions.
- Student booking and cancellation work against the deployed API.
- Organizer event CRUD and attendee viewing work against the deployed API.
- Direct unauthorized or forbidden requests still receive backend `401` or `403` responses.
- Responsive, accessibility, frontend test, backend regression, production health, and TLS checks pass.
- No secret or token is committed, logged, or exposed to the frontend build.

