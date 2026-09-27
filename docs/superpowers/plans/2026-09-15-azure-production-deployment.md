# Azure Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden and deploy the Campus Event Management & Booking API to its Azure Ubuntu VM with managed-identity Key Vault access, PostgreSQL, Nginx, Let's Encrypt TLS, Entra ID authentication, and repeatable verification.

**Architecture:** Nginx terminates HTTPS on the VM and proxies only `/events-api/` to a loopback-bound Express container. Express loads its database URL, JWT secret, and peer API key from Azure Key Vault through the VM's managed identity before Prisma is imported; PostgreSQL stays on a private Docker network with a persistent volume.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, Prisma 5, PostgreSQL 16, Docker Engine with Compose v2, Ubuntu 24.04, Azure VM Managed Identity, Azure Key Vault, Microsoft Entra ID/OIDC, Nginx, Certbot/Let's Encrypt, Open-Meteo.

**Spec:** `docs/superpowers/specs/2026-09-15-azure-production-deployment-design.md`

## Global Constraints

- Public base URL is exactly `https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1`.
- Target VM is `campus-event-vm` in resource group `campus-event-rg`.
- Create Key Vault `campus-events-kv-2474` with Azure RBAC authorization; stop for user direction if Azure reports that the globally unique name is unavailable.
- Use the VM's system-assigned managed identity and grant only `Key Vault Secrets User` at vault scope.
- Never commit or print the Entra client secret, database password, JWT secret, peer API key, SSH private key, or a production `.env` file.
- Store `DATABASE-URL`, `POSTGRES-PASSWORD`, `JWT-SECRET`, and `PEER-API-KEY` in Key Vault.
- Use Entra tenant `c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f` and API client ID/audience `d16771d8-2e37-476a-be7c-63f4ed09c819`.
- Disable `/auth/dev-token` and `x-user-id` fallback in production.
- PostgreSQL must have no host port in production; Express must bind host loopback only at `127.0.0.1:5000`.
- VM inbound access is limited to SSH 22, HTTP 80, and HTTPS 443.
- Open-Meteo failure must never make event detail unavailable.
- Preserve the untracked proposal documents and never include them in application/deployment commits.
- Use TDD for application behavior changes and run fresh verification before every completion claim.

---

## File Map

**Create:**

- `src/bootstrap.ts` — starts the server only after runtime secrets have loaded.
- `src/config/runtimeSecrets.ts` — pure validation for required production secrets and Entra identifiers.
- `src/config/entra.ts` — creates strict tenant/audience/issuer JWT verification settings.
- `tests/bootstrap.test.ts` — proves application import occurs after secret initialization.
- `tests/runtimeSecrets.test.ts` — proves production fails closed for missing secrets/configuration.
- `tests/entra.test.ts` — proves tenant-specific JWKS issuer/audience settings.
- `tests/production-auth.test.ts` — proves `/auth/dev-token` is absent in production.
- `docker-compose.production.yml` — production-only private PostgreSQL and loopback API topology.
- `nginx/campus-event-http.conf` — ACME/bootstrap HTTP configuration.
- `scripts/start-production.sh` — recreates the runtime PostgreSQL Docker secret and starts the Compose stack after boot.
- `scripts/configure-nginx.sh` — validates DNS, obtains TLS, installs final Nginx configuration.
- `systemd/campus-event.service` — orders runtime-secret creation and containers after network and Docker startup.
- `tests/deployment-assets.test.ts` — executes configuration validation for production Compose and shell scripts.
- `docs/deployment/azure-runbook.md` — operator commands and non-secret production verification record.

**Modify:**

- `package.json` — add focused unit/asset test scripts.
- `src/server.ts` — delegate to the secret-first bootstrap.
- `src/config/env.ts` — remove production secret defaults and expose validated Entra settings.
- `src/services/keyVault.service.ts` — require every production secret and expose no secret values in logs.
- `src/middlewares/auth.middleware.ts` — use strict Entra verification options.
- `src/routes/auth.routes.ts` — mount the development token endpoint only outside production.
- `Dockerfile` — keep the non-root runtime and add production metadata needed by migrations/health checks.
- `nginx/default.conf` — use the East Asia hostname and final TLS proxy configuration.
- `scripts/deploy.sh` — replace the destructive branch-specific deployment with an idempotent managed-identity deployment.
- `README.md` — document the live URL, Key Vault flow, Entra test flow, and deployment commands.
- `postman/campus_events_api.postman_collection.json` — document OAuth2 PKCE variables without storing tokens or secrets.

---

### Task 1: Checkpoint the Completed Local Weather Integration

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docker-compose.yml`
- Modify: `postman/campus_events_api.postman_collection.json`
- Modify: `src/config/env.ts`
- Modify: `src/services/event.service.ts`
- Modify: `tests/verification.ts`

**Interfaces:**

- Produces: `GET /events/:id` response containing `weather: VenueWeather` with a safe `available: false` fallback.
- Produces: a clean Git commit usable as the deployment branch baseline.

- [ ] **Step 1: Confirm only intended tracked files are modified**

Run:

```bash
git status --short
git diff --check
```

Expected: the seven files listed above are modified; proposal files remain untracked; no secret-bearing `.env` or `.pem` file is staged.

- [ ] **Step 2: Create the isolated deployment branch before committing application changes**

Run:

```bash
git switch -c codex/azure-production-deployment
```

Expected: the new branch starts at the approved design commit and retains the tracked weather changes plus untracked proposal files.

- [ ] **Step 3: Run the completed feature verification**

Run:

```bash
npm run build
DATABASE_URL='postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public' npm run test:verify
docker compose config --quiet
node -e "JSON.parse(require('fs').readFileSync('postman/campus_events_api.postman_collection.json','utf8')); console.log('valid')"
```

Expected: build and integration tests exit 0, Compose configuration is valid, and the final command prints `valid`.

- [ ] **Step 4: Confirm no secret-bearing file will enter the commit**

Run:

```bash
git diff --name-only
git ls-files '*.pem' '.env' '.env.*'
```

Expected: the diff contains only the seven intended tracked files. No `.pem` or `.env` file is tracked except the safe `.env.example` template.

- [ ] **Step 5: Commit only the weather integration files**

```bash
git add .env.example README.md docker-compose.yml postman/campus_events_api.postman_collection.json src/config/env.ts src/services/event.service.ts tests/verification.ts
git commit -m "feat: expose public weather in event details"
```

Expected: proposal documents are still untracked and absent from `git show --stat HEAD`.

---

### Task 2: Load and Validate Production Secrets Before Prisma

**Files:**

- Create: `src/config/runtimeSecrets.ts`
- Create: `src/bootstrap.ts`
- Create: `tests/runtimeSecrets.test.ts`
- Create: `tests/bootstrap.test.ts`
- Modify: `src/config/env.ts`
- Modify: `src/services/keyVault.service.ts`
- Modify: `src/server.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `validateProductionRuntime(config: AppConfig): void` in `src/config/runtimeSecrets.ts`.
- Produces: `startServer(dependencies?: BootstrapDependencies): Promise<Server>` in `src/bootstrap.ts`.
- Consumes: Key Vault secret names `DATABASE-URL`, `JWT-SECRET`, and `PEER-API-KEY`.
- Guarantees: `import('./app')` occurs only after `keyVaultService.initialize()` resolves.

- [ ] **Step 1: Add the unit-test command**

Add to `package.json` scripts:

```json
"test:unit": "node --require ts-node/register --test tests/*.test.ts",
"test": "npm run test:unit && npm run test:verify"
```

Run:

```bash
npm run test:unit
```

Expected: exit 1 because the planned test files do not exist yet.

- [ ] **Step 2: Write failing production-secret validation tests**

Create `tests/runtimeSecrets.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionRuntime } from '../src/config/runtimeSecrets';
import { AppConfig } from '../src/config/env';

function productionConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 5000,
    nodeEnv: 'production',
    databaseUrl: 'postgresql://postgres:secret@postgres:5432/campus_events?schema=public',
    peerApiKey: 'rotated-peer-key',
    jwtSecret: 'rotated-jwt-secret',
    campusCoordinates: { latitude: 13.7563, longitude: 100.5018 },
    keyVaultName: 'campus-events-kv-2474',
    azureAd: {
      clientId: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      tenantId: 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      audience: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
    },
    ...overrides,
  };
}

test('production requires the database, JWT, peer key, vault, and Entra identifiers', () => {
  const config = productionConfig({ databaseUrl: '', jwtSecret: '', peerApiKey: '', keyVaultName: '' });
  config.azureAd = {};

  assert.throws(
    () => validateProductionRuntime(config),
    /DATABASE_URL, JWT_SECRET, PEER_API_KEY, KEY_VAULT_NAME, AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_AUDIENCE/
  );
});

test('development permits local fallback configuration', () => {
  assert.doesNotThrow(() => validateProductionRuntime(productionConfig({
    nodeEnv: 'development', databaseUrl: '', jwtSecret: '', peerApiKey: '', keyVaultName: '',
  })));
});
```

Run:

```bash
npm run test:unit
```

Expected: TypeScript/module failure because `src/config/runtimeSecrets.ts` does not exist.

- [ ] **Step 3: Implement production validation and environment defaults**

Create `src/config/runtimeSecrets.ts` with a pure validator:

```typescript
import { AppConfig } from './env';

export function validateProductionRuntime(config: AppConfig): void {
  if (config.nodeEnv !== 'production') return;

  const missing = [
    ['DATABASE_URL', config.databaseUrl],
    ['JWT_SECRET', config.jwtSecret],
    ['PEER_API_KEY', config.peerApiKey],
    ['KEY_VAULT_NAME', config.keyVaultName],
    ['AZURE_AD_CLIENT_ID', config.azureAd.clientId],
    ['AZURE_AD_TENANT_ID', config.azureAd.tenantId],
    ['AZURE_AD_AUDIENCE', config.azureAd.audience],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
}
```

In `src/config/env.ts`, calculate `nodeEnv` once and permit example secret defaults only in development:

```typescript
const nodeEnv = process.env.NODE_ENV || 'development';
const developmentOnly = (value: string | undefined, fallback: string) =>
  value || (nodeEnv === 'development' ? fallback : '');
```

Use `developmentOnly` for `jwtSecret` and `peerApiKey`; keep `databaseUrl` empty when absent.

- [ ] **Step 4: Write the failing bootstrap-order test**

Create `tests/bootstrap.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { startServer } from '../src/bootstrap';

test('runtime secrets load before the Express application module', async () => {
  const calls: string[] = [];
  const fakeServer = new EventEmitter() as any;
  fakeServer.close = () => undefined;

  await startServer({
    port: 0,
    initializeSecrets: async () => { calls.push('secrets'); },
    loadApp: async () => {
      calls.push('app');
      return {
        default: {
          listen: (_port: number, callback: () => void) => {
            callback();
            return fakeServer;
          },
        } as any,
      };
    },
    log: () => undefined,
  });

  assert.deepEqual(calls, ['secrets', 'app']);
});
```

Run:

```bash
node --require ts-node/register --test tests/bootstrap.test.ts
```

Expected: module failure because `src/bootstrap.ts` does not exist.

- [ ] **Step 5: Implement secret-first bootstrap**

Create `src/bootstrap.ts` with these interfaces and order:

```typescript
import { Server } from 'node:http';
import config from './config/env';
import { keyVaultService } from './services/keyVault.service';
import { validateProductionRuntime } from './config/runtimeSecrets';

export interface BootstrapDependencies {
  port: number;
  initializeSecrets: () => Promise<void>;
  loadApp: () => Promise<{ default: { listen: (port: number, callback: () => void) => Server } }>;
  log: (message: string) => void;
}

const defaults: BootstrapDependencies = {
  port: config.port,
  initializeSecrets: () => keyVaultService.initialize(),
  loadApp: () => import('./app'),
  log: console.log,
};

export async function startServer(overrides: Partial<BootstrapDependencies> = {}): Promise<Server> {
  const dependencies = { ...defaults, ...overrides };
  await dependencies.initializeSecrets();
  validateProductionRuntime(config);
  const { default: app } = await dependencies.loadApp();
  return app.listen(dependencies.port, () => dependencies.log(`Server active on port: ${dependencies.port}`));
}
```

Replace `src/server.ts` with a call to `startServer()` and a fatal error handler; it must not statically import `./app`.

- [ ] **Step 6: Make Key Vault fail closed when a required production secret is absent**

In `src/services/keyVault.service.ts`, load all three application secrets, assign them to both `config` and `process.env`, then call `validateProductionRuntime(config)`. In production, do not catch and downgrade a missing secret to an environment fallback. Log only secret names and status, never values.

The production branch must behave as:

```typescript
const value = await this.getSecret(secretName, config.nodeEnv === 'development' ? fallbackEnv : undefined);
if (!value && config.nodeEnv === 'production') {
  throw new Error(`Required Key Vault secret '${secretName}' is missing.`);
}
```

- [ ] **Step 7: Run unit and integration tests**

Run:

```bash
npm run test:unit
npm run build
DATABASE_URL='postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public' npm run test:verify
```

Expected: all commands exit 0; bootstrap test records `secrets` before `app`; current integration behavior remains unchanged.

- [ ] **Step 8: Commit**

```bash
git add package.json src/bootstrap.ts src/server.ts src/config/env.ts src/config/runtimeSecrets.ts src/services/keyVault.service.ts tests/bootstrap.test.ts tests/runtimeSecrets.test.ts
git commit -m "fix: load production secrets before Prisma"
```

---

### Task 3: Enforce Production Entra Authentication

**Files:**

- Create: `src/config/entra.ts`
- Create: `tests/entra.test.ts`
- Create: `tests/production-auth.test.ts`
- Modify: `src/middlewares/auth.middleware.ts`
- Modify: `src/routes/auth.routes.ts`

**Interfaces:**

- Produces: `createEntraVerification(tenantId: string, audience: string)` returning `jwksUri`, `issuer`, `audience`, and algorithms.
- Consumes: `AZURE_AD_TENANT_ID` and `AZURE_AD_AUDIENCE` validated in Task 2.
- Guarantees: production does not register `POST /events-api/v1/auth/dev-token`.

- [ ] **Step 1: Write failing strict-verification tests**

Create `tests/entra.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntraVerification } from '../src/config/entra';

test('Entra verification is locked to the university tenant and API audience', () => {
  assert.deepEqual(
    createEntraVerification(
      'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      'd16771d8-2e37-476a-be7c-63f4ed09c819'
    ),
    {
      jwksUri: 'https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/discovery/v2.0/keys',
      issuer: 'https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/v2.0',
      audience: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      algorithms: ['RS256'],
    }
  );
});
```

Run:

```bash
node --require ts-node/register --test tests/entra.test.ts
```

Expected: module failure because `src/config/entra.ts` does not exist.

- [ ] **Step 2: Implement and use strict Entra settings**

Create `src/config/entra.ts`:

```typescript
export function createEntraVerification(tenantId: string, audience: string) {
  return {
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience,
    algorithms: ['RS256'] as const,
  };
}
```

Update `src/middlewares/auth.middleware.ts` to create the JWKS client from `jwksUri` and pass all of these to `jwt.verify`:

```typescript
{
  algorithms: [...entraVerification.algorithms],
  audience: entraVerification.audience,
  issuer: entraVerification.issuer,
}
```

Never use `common` as the production tenant fallback.

- [ ] **Step 3: Write the failing production-route test**

Create `tests/production-auth.test.ts` as a child-process test so module caching cannot retain development configuration:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('production does not expose the development token route', () => {
  const script = `
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
    process.env.JWT_SECRET = 'test-only';
    process.env.PEER_API_KEY = 'test-only';
    process.env.KEY_VAULT_NAME = 'test-vault';
    process.env.AZURE_AD_CLIENT_ID = 'd16771d8-2e37-476a-be7c-63f4ed09c819';
    process.env.AZURE_AD_TENANT_ID = 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f';
    process.env.AZURE_AD_AUDIENCE = 'd16771d8-2e37-476a-be7c-63f4ed09c819';
    const http = require('node:http');
    import('./src/app').then(({ default: app }) => {
      const server = http.createServer(app).listen(0, async () => {
        const port = server.address().port;
        const response = await fetch('http://127.0.0.1:' + port + '/events-api/v1/auth/dev-token', { method: 'POST' });
        server.close(() => process.exit(response.status === 404 ? 0 : 2));
      });
    });
  `;
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
```

Run:

```bash
node --require ts-node/register --test tests/production-auth.test.ts
```

Expected: FAIL because the current production app returns a non-404 response for `/auth/dev-token`.

- [ ] **Step 4: Mount the development token route conditionally**

Update `src/routes/auth.routes.ts`:

```typescript
import config from '../config/env';

if (config.nodeEnv !== 'production') {
  authRoutes.post('/dev-token', (req, res, next) => authController.generateDevToken(req, res, next));
}
```

- [ ] **Step 5: Run authentication and regression tests**

Run:

```bash
npm run test:unit
npm run build
DATABASE_URL='postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public' npm run test:verify
```

Expected: all commands exit 0. Development verification can still use its normal auth helpers; production child process receives 404 for the dev-token route.

- [ ] **Step 6: Commit**

```bash
git add src/config/entra.ts src/middlewares/auth.middleware.ts src/routes/auth.routes.ts tests/entra.test.ts tests/production-auth.test.ts
git commit -m "fix: enforce tenant-specific production authentication"
```

---

### Task 4: Create the Production Container Topology

**Files:**

- Create: `docker-compose.production.yml`
- Create: `tests/deployment-assets.test.ts`
- Modify: `Dockerfile`
- Modify: `package.json`

**Interfaces:**

- Consumes non-secret variables: `KEY_VAULT_NAME`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_AUDIENCE`, `CAMPUS_LATITUDE`, `CAMPUS_LONGITUDE`, `POSTGRES_PASSWORD_FILE`.
- Consumes Docker secret: `postgres_password` mounted from `POSTGRES_PASSWORD_FILE`.
- Produces services `postgres` and `api` on private network `campus_network`; only API loopback port 5000 is published.

- [ ] **Step 1: Write a failing production-Compose execution test**

Add this test to `tests/deployment-assets.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('production Compose renders without publishing PostgreSQL', () => {
  const directory = mkdtempSync(join(tmpdir(), 'campus-compose-'));
  const passwordFile = join(directory, 'postgres-password');
  writeFileSync(passwordFile, 'test-password\n', { mode: 0o600 });

  const result = spawnSync('docker', ['compose', '-f', 'docker-compose.production.yml', 'config', '--format', 'json'], {
    cwd: process.cwd(), encoding: 'utf8',
    env: {
      ...process.env,
      POSTGRES_PASSWORD_FILE: passwordFile,
      KEY_VAULT_NAME: 'campus-events-kv-2474',
      AZURE_AD_CLIENT_ID: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
      AZURE_AD_TENANT_ID: 'c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f',
      AZURE_AD_AUDIENCE: 'd16771d8-2e37-476a-be7c-63f4ed09c819',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const compose = JSON.parse(result.stdout);
  assert.equal(compose.services.postgres.ports, undefined);
  assert.equal(compose.services.api.ports[0].host_ip, '127.0.0.1');
  assert.equal(compose.services.api.environment.DATABASE_URL, undefined);
  assert.equal(compose.services.api.environment.JWT_SECRET, undefined);
  assert.equal(compose.services.api.environment.PEER_API_KEY, undefined);
});
```

Run:

```bash
node --require ts-node/register --test tests/deployment-assets.test.ts
```

Expected: FAIL because `docker-compose.production.yml` does not exist.

- [ ] **Step 2: Create the production Compose file**

Create `docker-compose.production.yml` with this contract:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: "on-failure:5"
    environment:
      POSTGRES_USER: campus_events
      POSTGRES_DB: campus_events
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U campus_events -d campus_events"]
      interval: 5s
      timeout: 5s
      retries: 12
    networks: [campus_network]

  api:
    build:
      context: .
      dockerfile: Dockerfile
    image: campus-event-api:current
    restart: "on-failure:5"
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      KEY_VAULT_NAME: ${KEY_VAULT_NAME:?KEY_VAULT_NAME is required}
      AZURE_AD_CLIENT_ID: ${AZURE_AD_CLIENT_ID:?AZURE_AD_CLIENT_ID is required}
      AZURE_AD_TENANT_ID: ${AZURE_AD_TENANT_ID:?AZURE_AD_TENANT_ID is required}
      AZURE_AD_AUDIENCE: ${AZURE_AD_AUDIENCE:?AZURE_AD_AUDIENCE is required}
      CAMPUS_LATITUDE: ${CAMPUS_LATITUDE:-13.7563}
      CAMPUS_LONGITUDE: ${CAMPUS_LONGITUDE:-100.5018}
    depends_on:
      postgres:
        condition: service_healthy
    networks: [campus_network]

secrets:
  postgres_password:
    file: ${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}

volumes:
  postgres_data:

networks:
  campus_network:
    driver: bridge
```

- [ ] **Step 3: Keep the production runtime non-root and buildable**

Update `Dockerfile` only as needed so these commands succeed and the final stage still contains migrations plus the Prisma CLI used by `prisma migrate deploy`:

```bash
docker build --target runner -t campus-event-api:plan-check .
docker run --rm --entrypoint sh campus-event-api:plan-check -c 'test "$(id -u)" != 0 && test -f prisma/schema.prisma && npx prisma --version'
```

Expected: image builds, runtime UID is nonzero, schema exists, and Prisma CLI prints its version.

- [ ] **Step 4: Run the production topology test**

Run:

```bash
npm run test:unit
```

Expected: production Compose renders, PostgreSQL has no published port, API binds loopback, and application secrets are absent from Compose environment.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.production.yml tests/deployment-assets.test.ts package.json
git commit -m "feat: add private production container topology"
```

---

### Task 5: Replace Deployment and Nginx Automation

**Files:**

- Create: `nginx/campus-event-http.conf`
- Create: `scripts/start-production.sh`
- Create: `scripts/configure-nginx.sh`
- Create: `systemd/campus-event.service`
- Modify: `nginx/default.conf`
- Modify: `scripts/deploy.sh`
- Modify: `tests/deployment-assets.test.ts`

**Interfaces:**

- `scripts/deploy.sh <git-ref>` runs as `azureuser` and consumes `/etc/campus-event/config.env`, managed identity, and the four named Key Vault secrets.
- `scripts/start-production.sh` recreates `/run/campus-event/postgres-password` and starts the stack after every boot.
- `scripts/configure-nginx.sh <certbot-email>` consumes the exact production hostname and the two Nginx templates.
- Produces an idempotent deployment without `docker compose down`, ignored migration failures, or a hard-coded stale branch.

- [ ] **Step 1: Add failing shell-interface tests**

Extend `tests/deployment-assets.test.ts` with safe tests for the two new scripts. Do not execute the current legacy `scripts/deploy.sh`, because it does not yet implement `--help` and performs host mutations:

```typescript
for (const script of ['scripts/start-production.sh', 'scripts/configure-nginx.sh']) {
  test(`${script} has valid Bash syntax`, () => {
    const result = spawnSync('bash', ['-n', script], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });

  test(`${script} documents its required arguments`, () => {
    const result = spawnSync('bash', [script, '--help'], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
  });
}
```

Run:

```bash
node --require ts-node/register --test tests/deployment-assets.test.ts
```

Expected: FAIL because both new scripts are absent.

- [ ] **Step 2: Implement the managed-identity deployment script**

Replace `scripts/deploy.sh` with an executable Bash script using `set -Eeuo pipefail`. It must:

```text
Usage: ./scripts/deploy.sh <git-ref>
```

The implementation must perform these exact behaviors:

```bash
CONFIG_FILE=/etc/campus-event/config.env
COMPOSE_FILE=docker-compose.production.yml
RUNTIME_DIR=/run/campus-event
POSTGRES_PASSWORD_FILE=$RUNTIME_DIR/postgres-password

az login --identity --allow-no-subscriptions >/dev/null
sudo install -d -o "$USER" -g "$USER" -m 700 "$RUNTIME_DIR"
az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name POSTGRES-PASSWORD --query value -o tsv > "$POSTGRES_PASSWORD_FILE"
chmod 600 "$POSTGRES_PASSWORD_FILE"
export POSTGRES_PASSWORD_FILE

git fetch --prune origin
git cat-file -e "$1^{commit}"
git checkout --detach "$1"
if docker image inspect campus-event-api:current >/dev/null 2>&1; then
  docker tag campus-event-api:current campus-event-api:previous
fi
docker compose -f "$COMPOSE_FILE" up -d postgres
docker compose -f "$COMPOSE_FILE" build api
DATABASE_URL="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name DATABASE-URL --query value -o tsv)"
export DATABASE_URL
docker compose -f "$COMPOSE_FILE" run --rm -e DATABASE_URL api npx prisma migrate deploy
unset DATABASE_URL
docker compose -f "$COMPOSE_FILE" up -d --no-build api
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:5000/events-api/v1/health
```

Source `CONFIG_FILE` with `set -a`/`set +a`, reject a missing argument or config file, validate all non-secret variables, and install a trap that unsets `DATABASE_URL` and removes the runtime password file on failure. Before migration, create `/var/backups/campus-events`, and when the database already contains the application schema, write a timestamped custom-format `pg_dump` there. Do not echo command tracing or secret values. Do not run database seed in production. After a successful deploy, install and enable `systemd/campus-event.service` so boot ordering recreates the runtime secret before starting containers.

Use this backup behavior before `prisma migrate deploy`:

```bash
sudo install -d -o "$USER" -g "$USER" -m 700 /var/backups/campus-events
if docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U campus_events -d campus_events -tAc "SELECT to_regclass('public.users') IS NOT NULL" | grep -q t; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U campus_events -d campus_events -Fc > "/var/backups/campus-events/predeploy-$(date +%Y%m%d%H%M%S).dump"
fi
```

Use these commands only after the health check succeeds:

```bash
sudo install -m 644 systemd/campus-event.service /etc/systemd/system/campus-event.service
sudo systemctl daemon-reload
sudo systemctl enable campus-event.service
```

After replacing the legacy script, add it to the syntax/help test list:

```typescript
for (const script of ['scripts/deploy.sh', 'scripts/start-production.sh', 'scripts/configure-nginx.sh']) {
  const syntax = spawnSync('bash', ['-n', script], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const help = spawnSync('bash', [script, '--help'], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
}
```

- [ ] **Step 3: Implement reboot-safe stack startup**

Create `scripts/start-production.sh` with `set -Eeuo pipefail` and a non-mutating `--help` branch that prints `Usage: scripts/start-production.sh`. Its normal path must source `/etc/campus-event/config.env`, require that systemd created `/run/campus-event`, authenticate with `az login --identity`, write `POSTGRES-PASSWORD` to `/run/campus-event/postgres-password` under `umask 077`, export `POSTGRES_PASSWORD_FILE`, and run:

```bash
docker compose -f docker-compose.production.yml up -d
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:5000/events-api/v1/health
```

Create `systemd/campus-event.service`:

```ini
[Unit]
Description=Campus Event API containers
Requires=docker.service
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=azureuser
Group=azureuser
WorkingDirectory=/home/azureuser/campus-event-booking-api
EnvironmentFile=/etc/campus-event/config.env
RuntimeDirectory=campus-event
RuntimeDirectoryMode=0700
ExecStart=/home/azureuser/campus-event-booking-api/scripts/start-production.sh
ExecStop=/usr/bin/docker compose -f docker-compose.production.yml stop
RemainAfterExit=yes
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
```

The production Compose services use `restart: "on-failure:5"`, allowing crash recovery without racing systemd at VM boot.

- [ ] **Step 4: Create initial and final Nginx configurations**

`nginx/campus-event-http.conf` must listen on port 80 for `campus-event-api.eastasia.cloudapp.azure.com`, serve `/.well-known/acme-challenge/` from `/var/www/certbot`, and proxy `/events-api/` to `http://127.0.0.1:5000/events-api/`.

`nginx/default.conf` must:

- redirect HTTP to HTTPS except the ACME challenge;
- listen on TLS 443 for the exact East Asia hostname;
- use `/etc/letsencrypt/live/campus-event-api.eastasia.cloudapp.azure.com/fullchain.pem` and `privkey.pem`;
- allow TLS 1.2 and 1.3;
- send HSTS, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers;
- proxy only `/events-api/` to loopback and return 404 for unrelated paths.

- [ ] **Step 5: Implement safe certificate setup**

Create executable `scripts/configure-nginx.sh` with:

```text
Usage: sudo ./scripts/configure-nginx.sh <certbot-email>
```

It must check that the production hostname resolves to the VM public IP, copy the HTTP configuration, run `nginx -t`, reload Nginx, request a certificate with:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d campus-event-api.eastasia.cloudapp.azure.com \
  --email "$1" --agree-tos --non-interactive
```

Only after the certificate files exist may it copy `nginx/default.conf`, run `nginx -t`, reload Nginx, and run `certbot renew --dry-run`. A failed `nginx -t` must never reload the service.

- [ ] **Step 6: Run asset tests**

Run:

```bash
npm run test:unit
bash -n scripts/deploy.sh
bash -n scripts/start-production.sh
bash -n scripts/configure-nginx.sh
```

Expected: every command exits 0 and both scripts print usage with `--help`.

- [ ] **Step 7: Commit**

```bash
git add nginx/campus-event-http.conf nginx/default.conf scripts/deploy.sh scripts/start-production.sh scripts/configure-nginx.sh systemd/campus-event.service tests/deployment-assets.test.ts
git commit -m "feat: automate Azure deployment and TLS setup"
```

---

### Task 6: Complete Local Release Verification and Push the Deployment Branch

**Files:**

- Modify: `README.md`
- Modify: `postman/campus_events_api.postman_collection.json`

**Interfaces:**

- Produces: a reviewed Git ref that the VM deploy script can check out exactly.
- Produces: Postman variables `entraTenantId`, `entraClientId`, `entraAudience`, and `entraScope`; no token or secret values.

- [ ] **Step 1: Update documentation and Postman configuration**

Document:

- production URL and health URL;
- managed-identity Key Vault flow and four secret names;
- `./scripts/deploy.sh <git-ref>`;
- `sudo ./scripts/configure-nginx.sh <certbot-email>`;
- OAuth2 Authorization Code with PKCE endpoints:
  - authorize: `https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/oauth2/v2.0/authorize`
  - token: `https://login.microsoftonline.com/c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f/oauth2/v2.0/token`
  - scope: `api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user openid profile email`
  - callback: `https://oauth.pstmn.io/v1/callback`

Do not export access tokens, refresh tokens, client secrets, or the production peer key in Postman.

- [ ] **Step 2: Run all local release gates**

Run:

```bash
npm run build
npm run test:unit
DATABASE_URL='postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public' npm run test:verify
docker build --target runner -t campus-event-api:release-check .
git diff --check
```

Render `docker-compose.production.yml` with a temporary mode-600 password file and the non-secret production identifiers. Expected: every command exits 0.

- [ ] **Step 3: Scan tracked release content for prohibited artifacts**

Run:

```bash
git ls-files '*.env' '*.pem'
git grep -nE 'AZURE_CLIENT_SECRET=[^"[:space:]]|AZURE_CLIENT_SECRET="[^"]+' -- . ':!.env.example'
```

Expected: no production env/private-key files and no non-empty client-secret assignment are returned.

- [ ] **Step 4: Commit release documentation**

```bash
git add README.md postman/campus_events_api.postman_collection.json
git commit -m "docs: add Azure production runbook"
```

- [ ] **Step 5: Review and push**

Run:

```bash
git status --short
git log --oneline --decorate -6
git diff origin/develop...HEAD --stat
git push -u origin codex/azure-production-deployment
```

Expected: only proposal files remain untracked; the remote branch contains the reviewed commits. Do not push directly to `develop` unless the user explicitly requests that branch.

---

### Task 7: Provision Azure Key Vault and Harden the VM

**Files:**

- Create remotely: `/etc/campus-event/config.env` containing only non-secret identifiers.
- Create remotely at runtime: `/run/campus-event/postgres-password` with mode 600.
- Modify external state: VM managed identity, Key Vault, RBAC, VM packages, UFW, and Azure network security rules.

**Interfaces:**

- Produces: managed-identity access from VM/container to Key Vault.
- Produces non-secret configuration values consumed by Task 5's deploy script.

- [ ] **Step 1: Secure and verify SSH access**

On the local Mac, make the supplied key owner-readable only, then connect without recording a new host key until its fingerprint is shown to the user for confirmation:

```bash
chmod 600 /Users/hailey/Downloads/campus-event-vm_key.pem
ssh-keyscan -t ed25519 campus-event-api.eastasia.cloudapp.azure.com
ssh -i /Users/hailey/Downloads/campus-event-vm_key.pem azureuser@campus-event-api.eastasia.cloudapp.azure.com
```

Expected: the user confirms the Azure VM fingerprint and SSH opens as `azureuser`.

- [ ] **Step 2: Inspect before mutation**

Run remotely:

```bash
uname -a
cat /etc/os-release
df -h
free -h
sudo ss -lntup
sudo ufw status verbose
systemctl --failed
docker --version || true
docker compose version || true
nginx -v || true
```

Record unexpected existing services before changing ports or Nginx.

- [ ] **Step 3: Enable managed identity and create Key Vault**

Using the signed-in Azure Portal:

1. VM `campus-event-vm` → Identity → System assigned → On → Save.
2. Create Key Vault `campus-events-kv-2474` in `campus-event-rg`, East Asia, Standard tier, soft delete enabled, purge protection enabled, Azure RBAC permission model.
3. Key Vault → Access control → add `Key Vault Secrets User` to the VM managed identity.

Keep Key Vault public network access enabled for this class deployment while relying on Entra authentication and vault-scope RBAC. Do not enable anonymous access or grant broader Contributor/Administrator roles to the VM identity.

Expected: the VM Identity page shows an Object/Principal ID and the vault role assignment lists the VM.

- [ ] **Step 4: Generate and store fresh secrets without printing them**

Generate three independent high-entropy hex values for PostgreSQL, local JWT signing, and the peer endpoint. Store them directly as:

- `POSTGRES-PASSWORD`
- `JWT-SECRET`
- `PEER-API-KEY`

Construct `DATABASE-URL` with the same PostgreSQL password and this exact non-secret structure:

```text
postgresql://campus_events:${POSTGRES_PASSWORD}@postgres:5432/campus_events?schema=public
```

Store the completed value as `DATABASE-URL`. Do not put any generated value in terminal output, screenshots, Git, shell history, or this runbook.

- [ ] **Step 5: Install and configure VM prerequisites**

Install security updates, Docker Engine/Compose v2, Azure CLI, Git, Nginx, Certbot, `python3-certbot-nginx`, UFW, and unattended upgrades using official Ubuntu/Microsoft repositories. Add `azureuser` to the Docker group but continue using `sudo` in deployment scripts.

Enable only:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

In Azure Network Security Group inbound rules, retain 22 and add 80/443; do not add 5000 or 5432.

- [ ] **Step 6: Verify managed identity and Key Vault access**

Run remotely without printing secret values:

```bash
az login --identity --allow-no-subscriptions
az keyvault secret show --vault-name campus-events-kv-2474 --name DATABASE-URL --query id -o tsv
az keyvault secret show --vault-name campus-events-kv-2474 --name JWT-SECRET --query id -o tsv
az keyvault secret show --vault-name campus-events-kv-2474 --name PEER-API-KEY --query id -o tsv
az keyvault secret show --vault-name campus-events-kv-2474 --name POSTGRES-PASSWORD --query id -o tsv
```

Expected: four Key Vault secret IDs, never values.

- [ ] **Step 7: Create non-secret server configuration**

Create `/etc/campus-event/config.env`, owned by root and mode 644, containing exactly:

```env
KEY_VAULT_NAME=campus-events-kv-2474
AZURE_AD_CLIENT_ID=d16771d8-2e37-476a-be7c-63f4ed09c819
AZURE_AD_TENANT_ID=c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f
AZURE_AD_AUDIENCE=d16771d8-2e37-476a-be7c-63f4ed09c819
CAMPUS_LATITUDE=13.7563
CAMPUS_LONGITUDE=100.5018
```

Confirm it contains identifiers only.

---

### Task 8: Deploy the Exact Git Revision and Enable HTTPS

**Files:**

- Remote checkout: `/home/azureuser/campus-event-booking-api`
- Remote Nginx site: `/etc/nginx/sites-available/campus-event.conf`
- TLS state: `/etc/letsencrypt/live/campus-event-api.eastasia.cloudapp.azure.com/`

**Interfaces:**

- Consumes: remote branch from Task 6, VM identity/configuration from Task 7, and a user-provided Certbot contact email.
- Produces: live HTTPS API and renewable certificate.

- [ ] **Step 1: Clone the reviewed branch**

Run remotely:

```bash
cd /home/azureuser
git clone --branch codex/azure-production-deployment https://github.com/kaungwaiyan96/campus-event-booking-api.git
cd campus-event-booking-api
git rev-parse HEAD
```

If the directory already exists, fetch the branch instead of deleting the directory. Record the exact commit SHA.

- [ ] **Step 2: Run the deployment script at the exact commit**

From the remote repository:

```bash
./scripts/deploy.sh <recorded-commit-sha>
set -a
. /etc/campus-event/config.env
set +a
export POSTGRES_PASSWORD_FILE=/run/campus-event/postgres-password
docker compose -f docker-compose.production.yml ps
```

Expected: PostgreSQL and API are healthy; migration succeeds; loopback health returns HTTP 200. Substitute the literal SHA recorded in Step 1, not a branch name.

- [ ] **Step 3: Confirm ports before TLS**

Run remotely:

```bash
sudo ss -lntp
curl --fail http://127.0.0.1:5000/events-api/v1/health
```

Expected: 5000 listens only on `127.0.0.1`; 5432 is absent from host listeners; health succeeds.

- [ ] **Step 4: Ask once for the Certbot contact email and configure TLS**

After the user supplies the contact email, run:

```bash
sudo ./scripts/configure-nginx.sh <user-approved-certbot-email>
```

This is the only runtime input not currently available. Do not invent or infer a personal email address.

- [ ] **Step 5: Verify public HTTPS**

Run from the local Mac:

```bash
curl --fail --show-error --location http://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1/health
curl --fail --show-error https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1/health
openssl s_client -connect campus-event-api.eastasia.cloudapp.azure.com:443 -servername campus-event-api.eastasia.cloudapp.azure.com </dev/null
```

Expected: HTTP redirects to HTTPS, HTTPS health is 200, certificate hostname matches, and verification code is 0.

---

### Task 9: Configure Entra PKCE and Perform End-to-End Production Verification

**Files:**

- Modify: `docs/deployment/azure-runbook.md`
- Modify: `README.md`
- Modify locally only: Postman collection variables/token state; do not commit tokens or peer keys.

**Interfaces:**

- Consumes Entra API scope `api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user`.
- Produces presentation evidence for Key Vault, Prisma migrations, Entra user authentication/RBAC, Open-Meteo, HTTPS, health, and restart persistence.

- [ ] **Step 1: Configure the Entra API registration**

In Azure Portal → App registrations → `campus-event-booking-api`:

1. Expose an API → set Application ID URI to `api://d16771d8-2e37-476a-be7c-63f4ed09c819`.
2. Add delegated scope `access_as_user`, enabled for admins and users.
3. Authentication → add Mobile and desktop application redirect URI `https://oauth.pstmn.io/v1/callback`.
4. Manifest/API settings → require access token version 2.
5. Define app roles with values `STUDENT`, `ORGANIZER`, and `ADMIN`; assign the presenting university account the `ORGANIZER` role through the Enterprise Application if tenant permissions allow.
6. After PKCE login succeeds, delete/revoke the previously disclosed client secret under Certificates & secrets; do not create a replacement because this deployment does not use one.

Do not create or use a client secret for the Postman PKCE flow.

- [ ] **Step 2: Obtain a real university access token in Postman**

Configure OAuth 2.0 Authorization Code with PKCE using the exact authorize URL, token URL, client ID, callback, and scope from Task 6. Sign in interactively, store the token only in Postman's local current value, and call:

```text
GET https://campus-event-api.eastasia.cloudapp.azure.com/events-api/v1/auth/me
Authorization: Bearer <local Postman token>
```

Expected: HTTP 200, user auto-provisioned with Entra `oid/sub`, university identity details, and the assigned role. If tenant administration blocks role assignment, record that external blocker and demonstrate student authentication plus database-enforced RBAC rejection; do not weaken production authentication.

- [ ] **Step 3: Verify public and protected functionality**

Use Postman/curl to verify:

1. Health returns 200.
2. Event listing returns seeded or newly created data.
3. Event detail contains `weather.source: "open-meteo"`; `available` may safely be false during an upstream outage.
4. Missing Bearer token on a protected route returns 401.
5. A student token cannot create an event and receives 403.
6. An organizer/admin token can create, update, and delete an event.
7. Booking capacity, duplicate prevention, cancellation, and attendee authorization work.
8. Missing/wrong peer API key returns 401; the correct Key Vault-backed value succeeds.

Never paste production tokens or keys into committed examples.

- [ ] **Step 4: Verify runtime secret source and restart persistence**

Run remotely:

```bash
set -a
. /etc/campus-event/config.env
set +a
export POSTGRES_PASSWORD_FILE=/run/campus-event/postgres-password
docker compose -f docker-compose.production.yml exec api sh -c 'test -z "$AZURE_CLIENT_SECRET" && test -z "$DATABASE_URL" && test -z "$JWT_SECRET" && test -z "$PEER_API_KEY"'
docker compose -f docker-compose.production.yml restart api
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:5000/events-api/v1/health
sudo certbot renew --dry-run
```

Expected: no client/application secrets are statically injected by Compose, restarted API reloads Key Vault and becomes healthy, and certificate renewal succeeds. Do not print the container environment.

- [ ] **Step 5: Record non-secret deployment evidence**

Create `docs/deployment/azure-runbook.md` containing:

- deployed Git SHA and timestamp;
- public base URL;
- Key Vault name and secret names only;
- managed identity role name;
- migration name/status;
- container and health status without environment dumps;
- Nginx and certificate verification results;
- Entra scope and successful endpoint/status, without token contents;
- commands needed for redeployment and rollback.

Update README's verification section with the same non-secret status.

- [ ] **Step 6: Final verification and documentation commit**

Run locally:

```bash
npm run build
npm run test:unit
DATABASE_URL='postgresql://postgres:postgrespassword@localhost:55432/campus_events?schema=public' npm run test:verify
git diff --check
git status --short
```

Run the public health, event-weather, auth rejection, TLS, and renewal checks again. Then commit only documentation:

```bash
git add README.md docs/deployment/azure-runbook.md
git commit -m "docs: record verified Azure deployment"
git push
```

Expected: tests pass, public HTTPS checks pass, proposal files remain untracked, and the deployment branch contains no secret values.

---

## Rollback Procedure

1. Record the currently deployed Git SHA and Docker image ID before each deployment.
2. Create a logical PostgreSQL backup before applying a new migration:

```bash
set -a
. /etc/campus-event/config.env
set +a
export POSTGRES_PASSWORD_FILE=/run/campus-event/postgres-password
sudo install -d -o "$USER" -g "$USER" -m 700 /var/backups/campus-events
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U campus_events -d campus_events -Fc > /var/backups/campus-events/manual-$(date +%Y%m%d%H%M%S).dump
```

3. To roll back application code, check out the previous approved SHA and rebuild only `api`; never delete the PostgreSQL volume.
4. Restore the previous Nginx file from `/etc/nginx/sites-available/campus-event.conf.bak`, run `sudo nginx -t`, and reload only if validation succeeds.
5. Database rollback requires a reviewed reverse migration or restoring the recorded backup; never use `prisma migrate reset` in production.
