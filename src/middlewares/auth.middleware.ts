import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from './error.middleware';
import config from '../config/env';
import { createEntraVerification } from '../config/entra';
import { AuthUser, DecodedAdToken } from '../types/auth.types';
export { AuthUser };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// JWKS Client for Microsoft Entra ID (Azure AD) public keys
function getEntraVerification() {
  if (config.azureAd.tenantId && config.azureAd.audience) {
    return createEntraVerification(config.azureAd.tenantId, config.azureAd.audience);
  }

  if (config.nodeEnv === 'development') {
    return createEntraVerification('common', 'development');
  }

  throw new Error('AZURE_AD_TENANT_ID and AZURE_AD_AUDIENCE are required for Entra verification.');
}

const entraVerification = getEntraVerification();
const jwks = jwksClient({
  jwksUri: entraVerification.jwksUri,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getAzureSigningKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error('JWT header missing key ID (kid)'));
  }
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Authentication Middleware
 * Supports:
 * 1. Microsoft Active Directory (Entra ID) OIDC/OAuth2 Bearer tokens
 * 2. Internal HMAC JWT tokens signed with JWT_SECRET
 * 3. Local development fallback (x-user-id header or default user)
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // 1. In development mode: Allow x-user-id header or default user if no Bearer token provided
    if (config.nodeEnv === 'development' && (!authHeader || !authHeader.startsWith('Bearer '))) {
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

    const token = authHeader.split(' ')[1];
    let decodedPayload: DecodedAdToken | null = null;

    // 2. First attempt: Verify as internal/local JWT (useful for lab testing and demo tokens)
    try {
      const localDecoded = jwt.verify(token, config.jwtSecret) as any;
      if (localDecoded && (localDecoded.id || localDecoded.oid || localDecoded.sub)) {
        decodedPayload = {
          oid: localDecoded.oid || localDecoded.adOid || localDecoded.id,
          sub: localDecoded.sub || localDecoded.id,
          name: localDecoded.name,
          email: localDecoded.email,
          roles: localDecoded.role ? [localDecoded.role] : localDecoded.roles,
        };
      }
    } catch (localJwtError) {
      // Not an internal JWT, proceed to Microsoft Entra ID verification
    }

    // 3. Second attempt: Verify as Microsoft Active Directory (Azure AD) Token
    if (!decodedPayload) {
      try {
        decodedPayload = await new Promise<DecodedAdToken>((resolve, reject) => {
          jwt.verify(
            token,
            getAzureSigningKey,
            {
              algorithms: [...entraVerification.algorithms],
              audience: entraVerification.audience,
              issuer: entraVerification.issuer,
            },
            (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded as DecodedAdToken);
            }
          );
        });
      } catch (adError: any) {
        throw new AppError(401, 'UNAUTHORIZED', `Invalid authentication token: ${adError.message}`);
      }
    }

    if (!decodedPayload) {
      throw new AppError(401, 'UNAUTHORIZED', 'Failed to decode identity token.');
    }

    const adOid = decodedPayload.oid || decodedPayload.sub;
    if (!adOid) {
      throw new AppError(401, 'UNAUTHORIZED', 'Token does not contain valid identity identifier (oid/sub).');
    }

    const email = decodedPayload.email || decodedPayload.preferred_username || `${adOid}@university.edu`;
    const name = decodedPayload.name || 'University Member';

    // 4. Sync / find user in PostgreSQL database
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ adOid }, { email }],
      },
    });

    // Auto-provision user if first time logging in via Microsoft AD
    if (!user) {
      // Determine initial role from AD groups/roles claim if present
      let initialRole: Role = Role.STUDENT;
      if (decodedPayload.roles?.includes('ADMIN') || decodedPayload.roles?.includes('Administrator')) {
        initialRole = Role.ADMIN;
      } else if (decodedPayload.roles?.includes('ORGANIZER') || decodedPayload.roles?.includes('Faculty')) {
        initialRole = Role.ORGANIZER;
      }

      user = await prisma.user.create({
        data: {
          adOid,
          name,
          email,
          role: initialRole,
        },
      });
    }

    req.user = {
      id: user.id,
      adOid: user.adOid,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
