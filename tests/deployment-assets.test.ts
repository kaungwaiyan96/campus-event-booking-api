import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

for (const script of ['scripts/deploy.sh', 'scripts/deploy-web.sh', 'scripts/start-production.sh', 'scripts/configure-nginx.sh']) {
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

test('frontend deployment assets preserve the HTTPS API and serve a cache-safe SPA release', () => {
  const nginxConfig = readFileSync('nginx/default.conf', 'utf8');
  const deployWebScript = readFileSync('scripts/deploy-web.sh', 'utf8');
  const dockerfile = readFileSync('web/Dockerfile', 'utf8');
  const httpsServer = nginxConfig.slice(nginxConfig.indexOf('listen 443 ssl'));
  const locationBody = (location: string) => {
    const locationStart = nginxConfig.indexOf(location);
    const locationEnd = nginxConfig.indexOf('\n    }', locationStart);
    return nginxConfig.slice(locationStart, locationEnd);
  };
  const assetsLocation = locationBody('location ~* ^/assets/');
  const indexLocation = locationBody('location = /index.html');

  assert.match(nginxConfig, /root \/var\/www\/campus-event\/current;/);
  assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(nginxConfig, /location \/events-api\//);
  assert.ok(httpsServer.indexOf('location /events-api/') < httpsServer.indexOf('location / {'));
  assert.match(nginxConfig, /location ~\* \^\/assets\//);
  assert.match(nginxConfig, /max-age=31536000, immutable/);
  assert.match(nginxConfig, /location = \/index\.html/);
  assert.match(nginxConfig, /no-cache, no-store, must-revalidate/);
  for (const header of [
    'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header X-Frame-Options "DENY" always;',
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
  ]) {
    assert.ok(assetsLocation.includes(header));
    assert.ok(indexLocation.includes(header));
  }

  assert.match(dockerfile, /FROM node:22-alpine AS build/);
  assert.match(dockerfile, /RUN npm run test && npm run build/);
  assert.match(dockerfile, /FROM scratch AS export/);
  assert.match(dockerfile, /COPY --from=build \/app\/dist \/$/m);

  assert.match(deployWebScript, /Usage: \.\/scripts\/deploy-web\.sh <40-char-sha> <spa-client-id>/);
  assert.match(deployWebScript, /\[\[ \$# -ne 2 \]\]/);
  assert.match(deployWebScript, /\[\[ \$EUID -eq 0 \]\]/);
  assert.match(deployWebScript, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(deployWebScript, /git rev-parse HEAD/);
  assert.match(deployWebScript, /docker buildx build/);
  assert.match(deployWebScript, /--target export/);
  assert.match(deployWebScript, /--output "type=local,dest=\$STAGING_DIR"/);
  assert.match(deployWebScript, /chmod 755 "\$STAGING_DIR"/);
  assert.match(deployWebScript, /sudo install -d -m 755/);
  assert.match(deployWebScript, /sudo ln -sfnT/);
  assert.match(deployWebScript, /nginx -t/);
  assert.match(deployWebScript, /systemctl reload nginx/);
  assert.match(deployWebScript, /PREVIOUS_TARGET=""/);
  assert.match(deployWebScript, /readlink -e -- "\$CURRENT_LINK"/);
  assert.match(deployWebScript, /trap rollback_release ERR/);
  assert.match(deployWebScript, /RELEASE_SWITCHED=true/);
  assert.match(deployWebScript, /sudo ln -sfnT "\$PREVIOUS_TARGET" "\$CURRENT_LINK"/);
  assert.match(deployWebScript, /sudo rm -f -- "\$CURRENT_LINK"/);
  const newReleaseLink = deployWebScript.indexOf('sudo ln -sfnT "$RELEASE_DIR" "$CURRENT_LINK"');
  const nginxCheck = deployWebScript.indexOf('sudo nginx -t', newReleaseLink);
  const nginxReload = deployWebScript.indexOf('sudo systemctl reload nginx', nginxCheck);
  const completedSwitch = deployWebScript.indexOf('RELEASE_SWITCHED=false', nginxReload);
  assert.ok(newReleaseLink >= 0 && nginxCheck > newReleaseLink && nginxReload > nginxCheck && completedSwitch > nginxReload);
  assert.match(deployWebScript, /ENTRA_API_SCOPE=api:\/\/d16771d8-2e37-476a-be7c-63f4ed09c819\/access_as_user/);
  assert.doesNotMatch(deployWebScript, /docker compose/);
  assert.doesNotMatch(deployWebScript, /(?:CLIENT_SECRET|JWT_SECRET|PEER_API_KEY|DATABASE_URL|POSTGRES_PASSWORD|KEY_VAULT)/);
});
