export function createEntraVerification(tenantId: string, audience: string) {
  return {
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience,
    algorithms: ['RS256'] as const,
  };
}
