# Azure Production Deployment Design

## Objective

Deploy the Campus Event Management & Booking API to the existing Ubuntu VM in Azure and make it available at:

`https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1`

The deployment must satisfy the course requirements for a hardened Linux VPS, Docker-based automation, PostgreSQL with Prisma migrations, Nginx reverse proxying, Let's Encrypt TLS, Microsoft Entra ID authentication, Azure Key Vault secret retrieval, and third-party public API consumption.

The teacher's clarification removes the need to consume a classmate's API. The existing API-key-protected endpoint remains available as additional evidence, while Open-Meteo is the required consumed public API.

## Current State

- The API, PostgreSQL schema, Prisma migrations, Dockerfile, Docker Compose file, Nginx configuration, Entra token validation, Key Vault client, Open-Meteo integration, Postman collection, and automated verification script already exist.
- Local tests run against a disposable PostgreSQL container and the event-detail endpoint returns live Open-Meteo weather.
- The target VM, Azure DNS label, resource group, SSH username, and local SSH private key already exist.
- The checked-in Nginx hostname is stale and must be changed from the Southeast Asia hostname to the East Asia hostname.
- The application currently imports Express and Prisma before Key Vault initialization. Production startup must be reordered so `DATABASE-URL` is loaded before Prisma is constructed.
- Development authentication helpers and example secret defaults must not remain usable in production.

## Chosen Approach

Use the VM's system-assigned managed identity to access a new Azure Key Vault in the existing resource group. This is preferred over a client secret because it avoids storing an Entra client secret in GitHub, Docker Compose, the VM filesystem, or container environment variables.

The alternative is a service-principal client secret passed to the container. That is simpler initially but creates another production secret to distribute and rotate, so it is rejected for this deployment.

## Architecture

```text
Internet
   |
   | HTTPS 443
   v
Nginx on Azure Ubuntu VM
   |
   | http://127.0.0.1:5000/events-api/
   v
Node/Express container -----> Open-Meteo public API
   |
   | private Docker network
   v
PostgreSQL container + persistent volume

Node container ----managed identity----> Azure Key Vault
Node authentication ----JWKS----> Microsoft Entra ID
```

Only SSH, HTTP, and HTTPS are exposed by the VM. PostgreSQL is not published to the public network. The API port binds to loopback so public traffic must pass through Nginx.

## Azure Resources and Identity

1. Enable a system-assigned managed identity on `campus-event-vm`.
2. Create a globally unique Key Vault in `campus-event-rg`, using Azure RBAC authorization.
3. Grant the VM identity the minimum `Key Vault Secrets User` role on that vault.
4. Store these secrets:
   - `DATABASE-URL`
   - `POSTGRES-PASSWORD`
   - `JWT-SECRET`
   - `PEER-API-KEY`
5. Do not store or commit the supplied Entra client secret. Rotate that client secret because it was previously shared outside Azure.

The Entra tenant ID, application/client ID, and audience are identifiers rather than credentials. They may be supplied to the API container as production configuration. The API registration will expose an `access_as_user` scope and use Authorization Code with PKCE for the Postman demonstration, avoiding a client secret.

## Application Hardening Changes

### Startup ordering

`server.ts` will initialize Key Vault before dynamically importing the Express application. This guarantees the database connection string and runtime secrets exist before Prisma and authentication modules are constructed.

Key Vault initialization will fail closed in production when the vault is unavailable or any required secret is absent. Development retains `.env` fallback behavior.

### Production authentication

- `/auth/dev-token` will be unavailable in production.
- `x-user-id` fallback remains development-only.
- Entra JWT verification will require the configured tenant, audience, RS256 signature, and expected issuer.
- Internal JWT support may remain for controlled non-production testing, but production will not rely on the example default secret.

### Containers

- The API image continues to run as the non-root `node` user.
- Runtime dependencies will be pruned from the final image where practical.
- The API port will bind to `127.0.0.1:5000` on the VM.
- PostgreSQL remains only on the private Compose network and uses a persistent named volume.
- PostgreSQL receives its password through a Docker secret file populated from Key Vault, not a production `.env` file.

## Deployment Automation

A production Compose override and an Azure deployment script will perform the repeatable server deployment:

1. Authenticate the VM host to Azure using its managed identity.
2. Fetch `POSTGRES-PASSWORD` into a root-readable runtime file under `/run/campus-event/`.
3. Pull the approved Git commit.
4. Build the API image.
5. Start PostgreSQL.
6. Run `prisma migrate deploy`.
7. Start or replace the API container.
8. Verify the internal health endpoint.

The runtime secret file is not stored in the repository and is recreated from Key Vault when deploying. Proposal documents and local `.env` files are excluded from deployment commits.

## Nginx and TLS

The host Nginx configuration will use `campus-event-api.eastasia.cloudapp.azure.com` and proxy `/events-api/` to the loopback-bound API port. Proxy headers preserve the client address and HTTPS scheme.

Before requesting a certificate, DNS resolution and inbound Azure network rules for ports 80 and 443 will be verified. Certbot will then obtain and install a Let's Encrypt certificate and its renewal timer will be tested. HTTP redirects to HTTPS only after certificate issuance succeeds.

## Deployment Sequence

1. Commit and push only the reviewed application/deployment changes; leave proposal files untouched.
2. Verify SSH access and correct the local private-key permissions to owner-read-only.
3. Inspect the VM OS, active services, disk space, firewall, and existing Nginx routes before changing it.
4. Enable managed identity, create/configure Key Vault, add secrets, and assign least-privilege access.
5. Install or verify Docker Engine, Compose, Nginx, Certbot, Azure CLI, Git, and unattended security updates.
6. Configure UFW and the Azure network security group for ports 22, 80, and 443 only.
7. Clone or update the repository and execute the deployment script.
8. Install and validate Nginx first over HTTP, then issue the TLS certificate and enable HTTPS redirect.
9. Configure the Entra API scope and Postman Authorization Code with PKCE flow.
10. Run production verification and record evidence for the presentation.

## Error Handling and Rollback

- Key Vault or required-secret failure stops application startup instead of silently using example values.
- A failed image build or migration leaves the currently running API container untouched where possible.
- Before migrations, record the deployed Git commit and take a PostgreSQL logical backup or volume snapshot.
- Keep the previous image tag so the API can be rolled back to the previous commit.
- Nginx changes are staged, checked with `nginx -t`, and reloaded only after validation.
- Certificate failure leaves HTTP configuration available for diagnosis and does not install a broken HTTPS configuration.

## Verification

### Before deployment

- `npm run build`
- `npm run test:verify` against disposable PostgreSQL
- `docker compose config --quiet`
- production image build
- configuration scan confirming no production secret value is tracked

### On the VM

- PostgreSQL health check passes and has no public port.
- API container health check passes.
- `GET /events-api/v1/health` succeeds through loopback and public HTTPS.
- `GET /events-api/v1/events/:id` returns an event with Open-Meteo `weather` data or its safe fallback.
- Protected routes reject missing credentials.
- A valid Entra access token reaches `/auth/me` and a role-protected operation.
- The peer endpoint rejects a missing/incorrect `x-api-key` and accepts the Key Vault value.
- TLS hostname, certificate chain, HTTP-to-HTTPS redirect, and Certbot renewal dry run pass.
- Reboot persistence is checked for Docker containers, Nginx, and secret/deployment startup procedure.

## Completion Criteria

The deployment is complete only when the public HTTPS base URL is reachable, the API and database survive a controlled restart, secrets are loaded from Key Vault without a production `.env`, Entra authentication is demonstrated with a real university account token, Open-Meteo data appears in event detail, and the final Git commit plus verification commands are documented for the presentation.
